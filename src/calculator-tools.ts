// The calculator surface: list, search, describe, schema, run and solve.
//
// run_calculation computes in this process against the frontend's own
// calculator registry, bundled at build time; it needs no key and makes no
// network call. solve_calculation is the exception: it runs on rftools.io and
// spends a metered call (src/solve.ts).
//
// This module imports the frontend through the `@` alias, which only
// scripts/build.sh resolves, so it is tested through the built bundle
// (test/calculators.test.js, test/discovery.test.js).

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAllCalculators, getCalculator, getCalculatorsByCategory } from '@/lib/calculators/registry';
import type { CalculatorCategory, CalculatorDefinition } from '@/lib/calculators/types';
import { CATEGORIES } from '@/lib/calculators/types';
import {
  appliedInputs,
  buildCalculatorProvenance,
  calculatorFormulaRef,
  outOfRangeWarnings,
} from '@/lib/provenance/build';
// Written by scripts/build.sh just before bundling: the translated titles,
// short titles and keywords, without the translated descriptions.
import CALCULATOR_TERMS from '../.build/calculator-terms.json' with { type: 'json' };
import type { RftoolsApi } from './api.ts';
import { CalculatorIndex, DEFAULT_LIMIT, MAX_LIMIT, type SearchDocument } from './calculator-search.ts';
import { SOLVE_NEEDS_KEY, handleSolve } from './solve.ts';
import { READS, SPENDS_ALLOWANCE, annotate, composeDescription } from './tool-copy.ts';

export const VALID_CATEGORIES = Object.keys(CATEGORIES) as CalculatorCategory[];

/** The languages search reads translated titles and keywords from. */
export const SEARCH_LANGUAGES = Object.keys(CALCULATOR_TERMS as Record<string, unknown>).sort();

const SITE = 'https://rftools.io';

/** A calculator's page: the canonical URL, trailing slash included. */
export function calculatorUrl(calc: Pick<CalculatorDefinition, 'category' | 'slug'>): string {
  return `${SITE}/calculators/${calc.category}/${calc.slug}/`;
}

/** The first sentence of a description, for a one-line listing. */
function oneLine(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^.*?[.!?](?=\s+[A-Z0-9(]|$)/s);
  return (match ? match[0] : trimmed).trim();
}

function text(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function refuse(message: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

// ── Closest identifiers ─────────────────────────────────────────────────────

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** The three registered slugs nearest a misspelt one, nearest first, ties in registry order. */
export function closestSlugs(slug: string, count = 3): string[] {
  const wanted = slug.trim().toLowerCase();
  return getAllCalculators()
    .map((c, index) => ({ slug: c.slug, index, distance: editDistance(wanted, c.slug) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, count)
    .map((c) => c.slug);
}

function notFound(slug: string) {
  return refuse(
    `Calculator "${slug}" not found. Closest identifiers: ${closestSlugs(slug).join(', ')}. ` +
      'search_calculators finds one by words; list_calculators lists them all.',
  );
}

// ── Search ──────────────────────────────────────────────────────────────────

type Terms = Record<string, Record<string, [string, string, string[]]>>;

function searchDocument(calc: CalculatorDefinition): SearchDocument {
  const terms = CALCULATOR_TERMS as unknown as Terms;
  const translatedTitle: string[] = [];
  const translatedKeywords: string[] = [];
  for (const lang of SEARCH_LANGUAGES) {
    const entry = terms[lang]?.[calc.slug];
    if (!entry) continue;
    translatedTitle.push(entry[0], entry[1]);
    translatedKeywords.push(...entry[2]);
  }
  return {
    slug: calc.slug,
    category: calc.category,
    fields: {
      title: [calc.title, calc.shortTitle],
      slug: [calc.slug.replace(/-/g, ' ')],
      keywords: calc.keywords ?? [],
      labels: [...calc.inputs.map((i) => i.label), ...calc.outputs.map((o) => o.label)],
      description: [calc.description],
      translatedTitle,
      translatedKeywords,
    },
  };
}

let index: CalculatorIndex | undefined;

/** Built on first use: the registry does not change while the server runs. */
export function calculatorIndex(): CalculatorIndex {
  index ??= new CalculatorIndex(getAllCalculators().map(searchDocument));
  return index;
}

export function searchCalculators(query: string, opts: { category?: string; limit?: number } = {}) {
  const { hits, matched } = calculatorIndex().search(query, opts);
  return {
    matched,
    results: hits.map(({ slug, score }) => {
      const calc = getCalculator(slug)!;
      return {
        slug,
        title: calc.title,
        category: calc.category,
        description: oneLine(calc.description),
        url: calculatorUrl(calc),
        score: Math.round(score * 1000) / 1000,
      };
    }),
  };
}

// ── Schema ──────────────────────────────────────────────────────────────────

/** A calculator's input contract as JSON Schema 2020-12, with its outputs and formula. */
export function calculatorSchema(calc: CalculatorDefinition): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {};
  for (const input of calc.inputs) {
    const unit = input.unit?.trim();
    const prop: Record<string, unknown> = {
      type: 'number',
      title: input.label,
      description: [`${input.label} (${unit || 'dimensionless'}).`, input.tooltip?.trim()].filter(Boolean).join(' '),
      default: input.defaultValue,
    };
    if (input.min !== undefined) prop.minimum = input.min;
    if (input.max !== undefined) prop.maximum = input.max;
    if (unit) prop['x-unit'] = unit;
    properties[input.key] = prop;
  }
  return {
    slug: calc.slug,
    title: calc.title,
    category: calc.category,
    url: calculatorUrl(calc),
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties,
    },
    outputs: calc.outputs.map((o) => ({
      key: o.key,
      label: o.label,
      unit: o.unit,
      ...(o.tooltip ? { description: o.tooltip } : {}),
    })),
    formula: {
      primary: calc.formula.primary,
      ...(calc.formula.latex ? { latex: calc.formula.latex } : {}),
      reference: calculatorFormulaRef(calc),
    },
  };
}

// ── Registration ────────────────────────────────────────────────────────────

export interface CalculatorToolOptions {
  api: RftoolsApi;
  /** `provenance.version` on every result: `mcp@<package version>`. */
  engineVersion: string;
}

export const CALCULATOR_TOOL_NAMES = [
  'list_calculators',
  'search_calculators',
  'get_calculator_info',
  'get_calculator_schema',
  'run_calculation',
  'solve_calculation',
] as const;

export function registerCalculatorTools(server: McpServer, opts: CalculatorToolOptions): string[] {
  const total = getAllCalculators().length;
  const categories = VALID_CATEGORIES.join(', ');
  const slugField = z.string().describe('Calculator identifier, its slug (e.g. "microstrip-impedance")');

  // --- list_calculators ---
  server.registerTool(
    'list_calculators',
    {
      title: 'List Calculators',
      description: composeDescription({
        // No count in the question: it is translated on /agents in six languages,
        // and a count would make every catalogue change a retranslation. The
        // count stays in `returns`, which is English only.
        question: 'List the RF and electronics calculators on rftools.io, or those in one category.',
        inputs: `category, optional: one of ${categories}. An unknown category is refused with this list.`,
        example: { category: 'pcb' },
        returns:
          "A JSON array with each calculator's slug, title, category and description. " +
          `search_calculators finds one by words instead of listing all ${total}.`,
      }),
      inputSchema: z.object({
        category: z.string().optional().describe(`Calculator category to filter by: ${categories}`),
      }),
      annotations: annotate('List Calculators', READS),
    },
    async ({ category }) => {
      if (category && !VALID_CATEGORIES.includes(category as CalculatorCategory)) {
        return refuse(`Unknown category "${category}". Valid categories: ${categories}`);
      }
      const calcs = category ? getCalculatorsByCategory(category as CalculatorCategory) : getAllCalculators();
      return text(calcs.map((c) => ({ slug: c.slug, title: c.title, category: c.category, description: c.description })));
    },
  );

  // --- search_calculators ---
  server.registerTool(
    'search_calculators',
    {
      title: 'Search Calculators',
      description: composeDescription({
        question:
          'Find the calculators that fit a task described in words, in English or in any of the languages ' +
          'rftools.io is published in.',
        inputs:
          `query, the words to match (required; English, ${SEARCH_LANGUAGES.join(', ')}); ` +
          `category, optional: one of ${categories}; limit, optional, 1 to ${MAX_LIMIT} results (default ${DEFAULT_LIMIT}).`,
        example: { query: 'trace impedance on FR4 microstrip', limit: 5 },
        returns:
          'The matches, highest score first, each with slug, title, category, a one-line description, the page URL and its ' +
          'score, plus how many calculators matched in all. A search that matches nothing is reported as an error ' +
          'saying so, not as an empty list. Pass a slug to get_calculator_schema or run_calculation.',
      }),
      inputSchema: z.object({
        query: z.string().min(1).describe('What to look for, in words (e.g. "trace impedance on FR4 microstrip")'),
        category: z.string().optional().describe(`Only calculators in this category: ${categories}`),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .describe(`How many results to return, 1 to ${MAX_LIMIT} (default ${DEFAULT_LIMIT})`),
      }),
      annotations: annotate('Search Calculators', READS),
    },
    async ({ query, category, limit }) => {
      if (category && !VALID_CATEGORIES.includes(category as CalculatorCategory)) {
        return refuse(`Unknown category "${category}". Valid categories: ${categories}`);
      }
      const found = searchCalculators(query, { category, limit });
      if (found.results.length === 0) {
        return refuse(
          `No calculator matches "${query}"${category ? ` in category ${category}` : ''}. ` +
            `Try other words${category ? ', another category or none' : ''}, or list_calculators.`,
        );
      }
      return text({ query, category: category ?? null, matched: found.matched, results: found.results });
    },
  );

  // --- get_calculator_info ---
  server.registerTool(
    'get_calculator_info',
    {
      title: 'Get Calculator Info',
      description: composeDescription({
        question: 'Describe one calculator: its inputs with units, defaults and bounds, its outputs, formula and keywords.',
        inputs: 'slug, a calculator identifier from list_calculators or search_calculators.',
        example: { slug: 'microstrip-impedance' },
        returns:
          "The calculator's slug, title, category and description; its inputs (key, label, unit, defaultValue, min, " +
          'max, tooltip); its outputs (key, label, unit, tooltip); the formula and keywords. get_calculator_schema ' +
          'returns the same inputs as a JSON Schema.',
      }),
      inputSchema: z.object({ slug: slugField }),
      annotations: annotate('Get Calculator Info', READS),
    },
    async ({ slug }) => {
      const calc = getCalculator(slug);
      if (!calc) return notFound(slug);
      return text({
        slug: calc.slug,
        title: calc.title,
        category: calc.category,
        description: calc.description,
        inputs: calc.inputs.map((i) => ({
          key: i.key,
          label: i.label,
          unit: i.unit,
          defaultValue: i.defaultValue,
          min: i.min,
          max: i.max,
          tooltip: i.tooltip,
        })),
        outputs: calc.outputs.map((o) => ({ key: o.key, label: o.label, unit: o.unit, tooltip: o.tooltip })),
        formula: calc.formula.primary,
        keywords: calc.keywords,
      });
    },
  );

  // --- get_calculator_schema ---
  server.registerTool(
    'get_calculator_schema',
    {
      title: 'Get Calculator Schema',
      description: composeDescription({
        question:
          'Give the exact input contract of one calculator as a JSON Schema, with its outputs, formula reference ' +
          'and page URL.',
        inputs: 'slug, a calculator identifier. A misspelt one is refused, naming the closest identifiers.',
        example: { slug: 'microstrip-impedance' },
        returns:
          'inputSchema, a JSON Schema 2020-12 object whose properties are the input keys, each a number with its ' +
          'unit (x-unit), minimum, maximum, default and description; outputs (key, label, unit); formula (primary ' +
          'text, LaTeX where there is one, and the reference it comes from); and url.',
      }),
      inputSchema: z.object({ slug: slugField }),
      annotations: annotate('Get Calculator Schema', READS),
    },
    async ({ slug }) => {
      const calc = getCalculator(slug);
      if (!calc) return notFound(slug);
      return text(calculatorSchema(calc));
    },
  );

  // --- run_calculation ---
  server.registerTool(
    'run_calculation',
    {
      title: 'Run Calculation',
      description: composeDescription({
        question: "Compute a calculator's outputs for given inputs, locally in this server, with no API key.",
        inputs:
          "slug, and inputs keyed by the calculator's input names in the units get_calculator_schema reports. An " +
          'input left out takes its declared default and is listed in defaultedInputs; a key the calculator does ' +
          'not declare is not read and is named in a warning; a value outside the declared range is still ' +
          'computed, with a warning naming the range.',
        example: {
          slug: 'microstrip-impedance',
          inputs: { traceWidth: 3, substrateHeight: 1.6, dielectricConstant: 4.3 },
        },
        returns:
          'slug; results, one per output with key, label, value and unit; webUrl; defaultedInputs; warnings and ' +
          'errors when there are any; and provenance: the formula source, assumptions, whether the inputs lie in ' +
          'the range the calculator is stated for, the inputs used and the engine version.',
      }),
      inputSchema: z.object({
        slug: slugField,
        inputs: z
          .record(z.string(), z.number())
          .describe('Input values keyed by input name (e.g. {"traceWidth": 1.2, "substrateHeight": 1.6})'),
      }),
      annotations: annotate('Run Calculation', READS),
    },
    async ({ slug, inputs }) => {
      const calc = getCalculator(slug);
      if (!calc) return notFound(slug);

      try {
        // Computed on exactly the inputs the provenance reports: every declared
        // input, the caller's value or else its default.
        const applied = appliedInputs(calc, inputs);
        // The same rule appliedInputs uses: anything but a number takes the default.
        const defaultedInputs = calc.inputs.filter((i) => typeof inputs[i.key] !== 'number').map((i) => i.key);
        const startedAt = Date.now();
        const result = calc.calculate(applied);
        const provenance = buildCalculatorProvenance(calc, applied, {
          engineVersion: opts.engineVersion,
          startedAt,
          values: result.values,
        });

        const response: Record<string, unknown> = {
          slug: calc.slug,
          results: calc.outputs.map((o) => ({ key: o.key, label: o.label, value: result.values[o.key], unit: o.unit })),
          webUrl: calculatorUrl(calc),
          defaultedInputs,
        };
        // The API's order: the calculator's own, then inputs it does not read,
        // then any input outside its stated range (same wording as the API).
        const warnings = [
          ...(result.warnings ?? []),
          ...Object.keys(inputs)
            .filter((key) => !Object.hasOwn(applied, key))
            .map((key) => `Input '${key}' is not read by this calculator and was ignored.`),
          ...outOfRangeWarnings(provenance),
        ];
        if (warnings.length) response.warnings = warnings;
        if (result.errors?.length) response.errors = result.errors;
        response.provenance = provenance;
        return text(response);
      } catch (err) {
        return refuse(`Calculation error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // --- solve_calculation ---
  // Unlike run_calculation, this runs on rftools.io's own calculators: a
  // genuine network call, metered like /calculate itself (openspec
  // kicad-plugin, design Decision 10). See src/solve.ts.
  server.registerTool(
    'solve_calculation',
    {
      title: 'Solve Calculation',
      description: composeDescription({
        question:
          'Find the value of one calculator input that makes an output equal a target, such as the trace width ' +
          'that gives 50 Ω on microstrip-impedance.',
        inputs:
          "slug; inputs, the calculator's other inputs keyed by name in its units; solveFor, the input to solve; " +
          'target {output, value}; grid, optional, a step to round the answer to; range [low, high], required when ' +
          'solveFor states no bound. get_calculator_schema states every input and output key, unit and bound.',
        example: {
          slug: 'microstrip-impedance',
          inputs: { substrateHeight: 1.6, dielectricConstant: 4.2, copperThickness: 35 },
          solveFor: 'traceWidth',
          target: { output: 'impedance', value: 50 },
        },
        returns:
          'The solved value (rounded to the grid when one is given, with the unrounded value), reached, which is ' +
          'false when no value in the range meets the target and the nearest value found is returned instead, the ' +
          'number of evaluations, warnings, and the full calculator result at that value with its provenance.',
        notes:
          'Runs on rftools.io, not locally: it needs RFTOOLS_API_KEY and spends one metered call from the ' +
          "account's monthly allowance, like POST /calculate.",
      }),
      inputSchema: z.object({
        slug: slugField,
        inputs: z
          .record(z.string(), z.number())
          .describe(
            "The calculator's other inputs, keyed by input name (the input named by solveFor is not one of " +
              'these — e.g. {"substrateHeight": 1.6, "dielectricConstant": 4.2, "copperThickness": 35})',
          ),
        solveFor: z.string().describe('Which declared numeric input to solve for (e.g. "traceWidth")'),
        target: z
          .object({
            output: z.string().describe('The output key to bring to a value (e.g. "impedance")'),
            value: z.number().describe('The value that output should equal'),
          })
          .describe('What to solve for'),
        grid: z
          .number()
          .positive()
          .optional()
          .describe(
            'Round the solved value to the nearest multiple of this manufacturing grid, e.g. 0.001 (mm). Omit for the unrounded solution.',
          ),
        range: z
          .tuple([z.number(), z.number()])
          .optional()
          .describe(
            "[low, high], narrowing the search inside solveFor's stated bound. Required when get_calculator_schema " +
              'shows no minimum or maximum for solveFor.',
          ),
      }),
      annotations: annotate('Solve Calculation', SPENDS_ALLOWANCE),
    },
    async ({ slug, inputs, solveFor, target, grid, range }) => {
      return (await handleSolve(opts.api, { slug, inputs, solveFor, target, grid, range })) as never;
    },
  );

  return [...CALCULATOR_TOOL_NAMES];
}

/** What the server states about calculators and keys, for the manifest. */
export const CALCULATOR_STATEMENTS = {
  calculatorsRunLocally:
    'run_calculation computes in this server against the bundled calculator registry: no key, no network call, ' +
    'no allowance spent.',
  solveNeedsKey: SOLVE_NEEDS_KEY,
} as const;
