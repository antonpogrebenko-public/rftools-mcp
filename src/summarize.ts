// Turning a result envelope into something an agent can read in one breath.
//
// A finished job's payload is a plot's worth of data: tens of thousands of
// points, several megabytes for a sweep. The default a caller gets is the
// headline — the envelope's `summary`, its warnings and provenance, the scalar
// values, and links — with every series described rather than listed. The whole
// payload is one `full: true` (or one fetch of `resultUrl`) away.

/** Keys whose content is the headline, never elided while anything else remains. */
const HEADLINE_KEYS = new Set([
  'summary',
  'warnings',
  'provenance',
  'advisories',
  'status',
  'label',
  'op',
  'reason',
  'decision',
  'error',
]);

export interface SummariseOptions {
  /** Arrays longer than this are described rather than listed. */
  maxSeries?: number;
  /** Arrays whose compact JSON is larger than this are described too. */
  maxSeriesChars?: number;
  /** Ceiling for the whole summarised object's compact JSON. */
  budgetChars?: number;
}

const DEFAULTS = {
  maxSeries: 50,
  maxSeriesChars: 2048,
  budgetChars: 6000,
};

function isScalar(v: unknown): boolean {
  return v === null || (typeof v !== 'object' && typeof v !== 'function');
}

function size(v: unknown): number {
  try {
    return JSON.stringify(v)?.length ?? 0;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/** A short stand-in for a value that was left out. */
function elide(v: unknown): Record<string, unknown> {
  if (Array.isArray(v)) return { elided: 'array', length: v.length };
  const keys = Object.keys(v as Record<string, unknown>);
  return { elided: 'object', keys: keys.slice(0, 12), ...(keys.length > 12 ? { more: keys.length - 12 } : {}) };
}

/** The description of a series: how long it is and where it runs. */
export function describeSeries(arr: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = { length: arr.length };
  const numbers = arr.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  if (numbers.length === arr.length && arr.length > 0) {
    out.min = Math.min(...numbers);
    out.max = Math.max(...numbers);
  }
  if (arr.length > 0) {
    out.first = cap(arr[0]);
    out.last = cap(arr[arr.length - 1]);
  }
  return out;
}

/** Keep a sample small: a scalar as-is, anything larger as its shape. */
function cap(v: unknown, limit = 300): unknown {
  if (isScalar(v)) return v;
  const reduced = reduce(v, DEFAULTS.maxSeries, DEFAULTS.maxSeriesChars);
  return size(reduced) <= limit ? reduced : elide(v);
}

/**
 * Phase one: every array that is long, or merely large, becomes its
 * description. Applied at every depth, so a series buried in a per-stage
 * object is reduced the same way a top-level one is.
 */
export function reduce(value: unknown, maxSeries: number, maxSeriesChars: number): unknown {
  if (isScalar(value)) return value;

  if (Array.isArray(value)) {
    // A series is a long list, or a list of plain values too big to print.
    // A short list of objects — the stages of a pipeline, say — is structure,
    // not a series: it keeps its shape, and the budget below prunes inside it.
    const allScalar = value.every(isScalar);
    if (value.length > maxSeries || (allScalar && size(value) > maxSeriesChars)) {
      return describeSeries(value);
    }
    return value.map((v) => reduce(v, maxSeries, maxSeriesChars));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = reduce(v, maxSeries, maxSeriesChars);
  }
  return out;
}

interface Candidate {
  parent: Record<string, unknown> | unknown[];
  key: string | number;
  value: unknown;
  size: number;
  depth: number;
  headline: boolean;
}

function collect(node: unknown, headlineAbove: boolean, depth: number, out: Candidate[]): void {
  if (isScalar(node)) return;
  const entries: Array<[string | number, unknown]> = Array.isArray(node)
    ? node.map((v, i) => [i, v] as [number, unknown])
    : Object.entries(node as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (isScalar(value)) continue;
    const isElided = !Array.isArray(value) && 'elided' in (value as Record<string, unknown>);
    const headline = headlineAbove || (typeof key === 'string' && HEADLINE_KEYS.has(key));
    if (!isElided) {
      out.push({
        parent: node as Record<string, unknown>,
        key,
        value,
        size: size(value),
        depth,
        headline,
      });
    }
    collect(value, headline, depth + 1, out);
  }
}

/**
 * Phase two: while the object is over budget, elide one branch at a time —
 * the deepest bulky one first, so breadth survives depth. A pipeline keeps all
 * of its stages and loses their waveforms, rather than keeping one stage whole
 * and losing the other seven.
 *
 * Headline keys (`summary`, `warnings`, `provenance`, …) go last, and only if
 * nothing else is left. Every step removes a branch, so this terminates.
 */
export function fitToBudget(root: Record<string, unknown>, budget: number, allowHeadline = false): boolean {
  let elidedAny = false;
  const bulky = Math.max(200, Math.floor(budget / 10));
  for (let guard = 0; guard < 2000; guard += 1) {
    if (size(root) <= budget) break;
    const candidates: Candidate[] = [];
    collect(root, false, 0, candidates);
    if (candidates.length === 0) break;
    const plain = candidates.filter((c) => !c.headline);
    // Headline branches are not touched here: when the bulk is elsewhere —
    // a huge log string, say — eliding `summary` costs the caller the one
    // thing it came for and frees nothing. enforceBudget comes back for them
    // as a last resort, after everything else has been tried.
    const pool = plain.length > 0 ? plain : allowHeadline ? candidates : [];
    if (pool.length === 0) break;
    const large = pool.filter((c) => c.size > bulky);
    const from = large.length > 0 ? large : pool;
    let target = from[0];
    for (const c of from) {
      if (c.depth > target.depth || (c.depth === target.depth && c.size > target.size)) target = c;
    }
    (target.parent as Record<string | number, unknown>)[target.key] = elide(target.value);
    elidedAny = true;
  }
  return elidedAny;
}

/** The keys that survive to the last resort. */
const LAST_RESORT_KEYS = ['summary', 'warnings', 'provenance', 'webUrl', 'resultUrl'];

/** Longest string the summary will print once it is fighting for room. */
const MAX_STRING_CHARS = 500;

function truncateStrings(node: unknown, limit: number): boolean {
  let cut = false;
  if (isScalar(node) || node === null) return false;
  const entries: Array<[string | number, unknown]> = Array.isArray(node)
    ? node.map((v, i) => [i, v] as [number, unknown])
    : Object.entries(node as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      if (value.length > limit) {
        (node as Record<string | number, unknown>)[key] =
          `${value.slice(0, limit)}… [+${value.length - limit} characters, use full: true]`;
        cut = true;
      }
    } else if (!isScalar(value)) {
      cut = truncateStrings(value, limit) || cut;
    }
  }
  return cut;
}

/**
 * The budget, enforced rather than hoped for. Containers go first, deepest
 * bulky branch first; then long strings are cut; then whole non-headline keys
 * are dropped, largest first; and if even that is not enough, only the
 * headline keys are kept. The result is always within the budget.
 */
export function enforceBudget(
  root: Record<string, unknown>,
  budget: number,
): { elided: boolean; truncated: boolean } {
  const elided = fitToBudget(root, budget);
  if (size(root) <= budget) return { elided, truncated: false };

  // A single enormous string defeats container elision: cut it.
  let truncated = truncateStrings(root, MAX_STRING_CHARS);
  if (size(root) <= budget) return { elided, truncated };

  // Width, not depth: drop whole keys the caller did not come for. Scalars
  // first, then what is left of the containers, largest first each time.
  for (const scalarsOnly of [true, false]) {
    for (let pass = 0; pass < 8; pass += 1) {
      const total = size(root);
      if (total <= budget) break;
      const droppable = Object.entries(root)
        .filter(([k, v]) => !LAST_RESORT_KEYS.includes(k) && (scalarsOnly ? isScalar(v) : true))
        .map(([k, v]) => ({ key: k, cost: size(v) + k.length + 4 }))
        .sort((a, b) => b.cost - a.cost);
      if (droppable.length === 0) break;
      // Drop enough of the largest to clear the overrun in one pass, rather
      // than re-measuring the whole object per key: a wide result would make
      // that quadratic. The loop re-measures and goes again if it was short.
      let freed = 0;
      for (const { key, cost } of droppable) {
        delete root[key];
        truncated = true;
        freed += cost;
        if (total - freed <= budget) break;
      }
    }
  }
  if (size(root) <= budget) return { elided, truncated };

  // Last resort: the headline and nothing else — and if the headline itself
  // is the bulk, elide inside it too.
  for (const key of Object.keys(root)) {
    if (!LAST_RESORT_KEYS.includes(key)) delete root[key];
  }
  if (size(root) > budget) fitToBudget(root, budget, true);
  return { elided, truncated: true };
}

export interface SummarisedResult {
  /** The summarised payload: headline keys first, then everything else reduced. */
  value: Record<string, unknown>;
  /** True when something was left out beyond the series reduction. */
  elided: boolean;
  /** True when a string was cut or a whole key dropped to stay within the budget. */
  truncated: boolean;
}

/**
 * The default form of a result: `summary`, `warnings` and `provenance` when the
 * envelope carries them, every scalar, and everything else described rather
 * than listed.
 */
export function summariseResult(payload: unknown, opts: SummariseOptions = {}): SummarisedResult {
  const maxSeries = opts.maxSeries ?? DEFAULTS.maxSeries;
  const maxSeriesChars = opts.maxSeriesChars ?? DEFAULTS.maxSeriesChars;
  const budget = opts.budgetChars ?? DEFAULTS.budgetChars;

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    const value = { result: reduce(payload, maxSeries, maxSeriesChars) } as Record<string, unknown>;
    const { elided, truncated } = enforceBudget(value, budget);
    return { value, elided, truncated };
  }

  const source = payload as Record<string, unknown>;
  const value: Record<string, unknown> = {};

  // The envelope's own keys lead, when the worker wrote them.
  for (const key of ['summary', 'warnings', 'provenance'] as const) {
    if (source[key] !== undefined) value[key] = reduce(source[key], maxSeries, maxSeriesChars);
  }
  // Then every other key: scalars verbatim, containers described.
  for (const [k, v] of Object.entries(source)) {
    if (k in value) continue;
    value[k] = isScalar(v) ? v : reduce(v, maxSeries, maxSeriesChars);
  }

  const { elided, truncated } = enforceBudget(value, budget);
  return { value, elided, truncated };
}
