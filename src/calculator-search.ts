// search_calculators: a deterministic token index over the calculator
// catalogue (openspec agent-surface, design D3).
//
// No library and no model: weighted token overlap, scored by inverse document
// frequency, ties broken by registry order. That is deliberate. The hosted
// endpoint (agent-remote-mcp) must return the same ranking from Python, so
// every rule below is written to be reproduced there exactly:
//
//   normalise   NFKC, then lower case.
//   classify    each code point is CJK (the ranges in CJK_RANGES), a word
//               character (Unicode letter or number, general category L* or
//               N*, that is not CJK), or a separator. A "." or "," between
//               two digits is a word character, so "2.4" stays one token.
//   tokens      a run of word characters is one token, with diacritics
//               removed (NFD, drop category M*, NFC) and one trailing "s"
//               dropped when the token is 4+ characters and does not end
//               in "ss"; tokens of one letter are dropped (one digit is
//               kept). A run of CJK characters becomes its character
//               bigrams — Japanese and Korean have no reliable word
//               spacing — or the character itself when the run is one long.
//   weight      each calculator field has a weight (FIELD_WEIGHTS); a token
//               found in several fields of one calculator counts once, at
//               the highest weight.
//   idf         ln(1 + N / df), N the number of calculators, df the number
//               containing the token in any field.
//   score       the sum over the query's distinct tokens of weight × idf,
//               rounded to 6 decimals before comparing; equal scores keep
//               registry order. A score of 0 is no match.

/** Field weights: English title first, translated titles next, prose last. */
export const FIELD_WEIGHTS = {
  title: 10,
  slug: 10,
  translatedTitle: 8,
  keywords: 6,
  translatedKeywords: 5,
  labels: 3,
  description: 2,
} as const;

export type FieldName = keyof typeof FIELD_WEIGHTS;

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 25;

/** Inclusive code-point ranges indexed as CJK bigrams. */
export const CJK_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x11ff], // Hangul Jamo
  [0x3005, 0x3007], // 々 〆 〇
  [0x3041, 0x309f], // Hiragana
  [0x30a1, 0x30fa], // Katakana (without ゠ U+30A0)
  [0x30fc, 0x30ff], // ー and the Katakana marks (without ・ U+30FB)
  [0x3131, 0x318e], // Hangul Compatibility Jamo
  [0x31f0, 0x31ff], // Katakana Phonetic Extensions
  [0x3400, 0x4dbf], // CJK Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xac00, 0xd7af], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0x20000, 0x2fa1f], // CJK Extensions B–F and Compatibility Supplement
];

function isCjk(cp: number): boolean {
  for (const [lo, hi] of CJK_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

const WORD_CHAR = /^[\p{L}\p{N}]$/u;
const DIGIT = /^\p{N}$/u;
const MARK = /\p{M}/gu;

type CharClass = 'cjk' | 'word' | 'sep';

export function normalise(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

function foldWord(run: string): string {
  let word = run.normalize('NFD').replace(MARK, '').normalize('NFC');
  if (word.length >= 4 && word.endsWith('s') && !word.endsWith('ss')) word = word.slice(0, -1);
  return word;
}

/** Every token of a text, in order; a token may repeat. */
export function tokenize(text: string): string[] {
  const chars = Array.from(normalise(text));
  const classes: CharClass[] = chars.map((ch) => {
    const cp = ch.codePointAt(0)!;
    if (isCjk(cp)) return 'cjk';
    if (WORD_CHAR.test(ch)) return 'word';
    return 'sep';
  });
  // A decimal point or thousands comma between two digits belongs to the number.
  for (let i = 1; i < chars.length - 1; i += 1) {
    if ((chars[i] === '.' || chars[i] === ',') && DIGIT.test(chars[i - 1]) && DIGIT.test(chars[i + 1])) {
      classes[i] = 'word';
    }
  }

  const tokens: string[] = [];
  let i = 0;
  while (i < chars.length) {
    const cls = classes[i];
    let j = i;
    while (j < chars.length && classes[j] === cls) j += 1;
    const run = chars.slice(i, j);
    if (cls === 'word') {
      const word = foldWord(run.join(''));
      if (word.length >= 2 || (word.length === 1 && DIGIT.test(word))) tokens.push(word);
    } else if (cls === 'cjk') {
      if (run.length === 1) tokens.push(run[0]);
      for (let k = 0; k + 1 < run.length; k += 1) tokens.push(run[k] + run[k + 1]);
    }
    i = j;
  }
  return tokens;
}

/** One calculator as the index sees it. */
export interface SearchDocument {
  slug: string;
  category: string;
  fields: Partial<Record<FieldName, string[]>>;
}

export interface SearchHit {
  slug: string;
  score: number;
}

export interface SearchOptions {
  category?: string;
  limit?: number;
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

export class CalculatorIndex {
  private readonly docs: SearchDocument[];
  /** Per document: token → the highest weight of any field holding it. */
  private readonly weights: Array<Map<string, number>>;
  private readonly idf = new Map<string, number>();

  constructor(docs: SearchDocument[]) {
    this.docs = docs;
    const df = new Map<string, number>();
    this.weights = docs.map((doc) => {
      const best = new Map<string, number>();
      for (const [field, texts] of Object.entries(doc.fields) as Array<[FieldName, string[] | undefined]>) {
        const weight = FIELD_WEIGHTS[field];
        for (const text of texts ?? []) {
          for (const token of tokenize(text)) {
            if ((best.get(token) ?? 0) < weight) best.set(token, weight);
          }
        }
      }
      for (const token of best.keys()) df.set(token, (df.get(token) ?? 0) + 1);
      return best;
    });
    const n = docs.length;
    for (const [token, count] of df) this.idf.set(token, Math.log(1 + n / count));
  }

  get size(): number {
    return this.docs.length;
  }

  /** Every match, best first; `limit` cuts the list, it does not change the order. */
  search(query: string, opts: SearchOptions = {}): { hits: SearchHit[]; matched: number } {
    const queryTokens = [...new Set(tokenize(query))];
    const scored: Array<{ index: number; score: number }> = [];
    this.docs.forEach((doc, index) => {
      if (opts.category && doc.category !== opts.category) return;
      let score = 0;
      for (const token of queryTokens) {
        const weight = this.weights[index].get(token);
        if (weight) score += weight * (this.idf.get(token) ?? 0);
      }
      score = round6(score);
      if (score > 0) scored.push({ index, score });
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    return {
      matched: scored.length,
      hits: scored.slice(0, limit).map(({ index, score }) => ({ slug: this.docs[index].slug, score })),
    };
  }
}
