// Print the translated calculator titles, short titles and keywords that
// search_calculators indexes, as JSON on stdout. scripts/build.sh runs this
// before bundling and the bundle imports the result from .build/.
//
// Why a separate step: the six translation modules also carry every
// calculator's translated description, which search does not index (design
// D3). Importing the modules would put about 330 KB of descriptions nobody
// reads into the published bundle; extracting the three fields first keeps
// the bundle to what search uses.
//
// Built and run by scripts/build.sh from the frontend, which resolves `@`.

import { DE_TRANSLATIONS } from '@/lib/i18n/de-translations';
import { ES_TRANSLATIONS } from '@/lib/i18n/es-translations';
import { FR_TRANSLATIONS } from '@/lib/i18n/fr-translations';
import { JA_TRANSLATIONS } from '@/lib/i18n/ja-translations';
import { KO_TRANSLATIONS } from '@/lib/i18n/ko-translations';
import { PT_TRANSLATIONS } from '@/lib/i18n/pt-translations';

type Meta = { title: string; shortTitle: string; keywords: string[] };

const BY_LANG: Record<string, Record<string, Meta>> = {
  de: DE_TRANSLATIONS,
  es: ES_TRANSLATIONS,
  fr: FR_TRANSLATIONS,
  ja: JA_TRANSLATIONS,
  ko: KO_TRANSLATIONS,
  pt: PT_TRANSLATIONS,
};

/** lang → slug → [title, shortTitle, keywords], keys sorted so the output is stable. */
const out: Record<string, Record<string, [string, string, string[]]>> = {};
for (const lang of Object.keys(BY_LANG).sort()) {
  const table = BY_LANG[lang];
  out[lang] = {};
  for (const slug of Object.keys(table).sort()) {
    const { title, shortTitle, keywords } = table[slug];
    out[lang][slug] = [title, shortTitle, [...(keywords ?? [])]];
  }
}

process.stdout.write(`${JSON.stringify(out)}\n`);
