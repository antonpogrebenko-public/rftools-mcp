import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getAllCalculators, getCalculator, getCalculatorsByCategory } from '@/lib/calculators/registry';
import type { CalculatorCategory } from '@/lib/calculators/types';
import { CATEGORIES } from '@/lib/calculators/types';
import { appliedInputs, buildCalculatorProvenance, outOfRangeWarnings } from '@/lib/provenance/build';
import packageJson from './package.json' with { type: 'json' };
import { assertContractConsistent } from './src/job-schemas.ts';
import { registerSimulationTools } from './src/simulation-tools.ts';

const VALID_CATEGORIES = Object.keys(CATEGORIES) as CalculatorCategory[];

/**
 * `provenance.version` on a calculator result: `mcp@<package version>`, read
 * from package.json when the bundle is built, so it is derived, never typed
 * (openspec api-metering, design Decision 6). The server's own `version` below
 * stays a literal because the publish workflow reads it from this file and
 * checks it against package.json; `test/calculators.test.js` checks the two
 * agree in the built bundle.
 */
export const ENGINE_VERSION = `mcp@${packageJson.version}`;

/**
 * Build the server. Nothing here touches stdio, so this module can be imported
 * — by a test, or by a host that embeds the server — without starting anything.
 */
export function createServer(): McpServer {
  assertContractConsistent();

  const server = new McpServer({
    name: 'rftools',
    version: '2.1.0',
  });

  // --- list_calculators ---
  server.registerTool(
    'list_calculators',
    {
      title: 'List Calculators',
      description:
        'List available RF & electronics calculators. Optionally filter by category: rf, pcb, power, signal, antenna, general, motor, protocol, emc, thermal, sensor, unit-conversion, audio.',
      inputSchema: z.object({
        category: z
          .string()
          .optional()
          .describe('Calculator category to filter by (e.g. rf, pcb, power)'),
      }),
    },
    async ({ category }) => {
      if (category && !VALID_CATEGORIES.includes(category as CalculatorCategory)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Unknown category "${category}". Valid categories: ${VALID_CATEGORIES.join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      const calcs = category
        ? getCalculatorsByCategory(category as CalculatorCategory)
        : getAllCalculators();

      const listing = calcs.map((c) => ({
        slug: c.slug,
        title: c.title,
        category: c.category,
        description: c.description,
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(listing, null, 2),
          },
        ],
      };
    },
  );

  // --- get_calculator_info ---
  server.registerTool(
    'get_calculator_info',
    {
      title: 'Get Calculator Info',
      description:
        'Get detailed information about a specific calculator including its inputs, outputs, and formula. Use this to understand what parameters a calculator needs before running it.',
      inputSchema: z.object({
        slug: z.string().describe('Calculator slug (e.g. "microstrip-impedance")'),
      }),
    },
    async ({ slug }) => {
      const calc = getCalculator(slug);
      if (!calc) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Calculator "${slug}" not found. Use list_calculators to see available calculators.`,
            },
          ],
          isError: true,
        };
      }

      const info = {
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
        outputs: calc.outputs.map((o) => ({
          key: o.key,
          label: o.label,
          unit: o.unit,
          tooltip: o.tooltip,
        })),
        formula: calc.formula.primary,
        keywords: calc.keywords,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    },
  );

  // --- run_calculation ---
  server.registerTool(
    'run_calculation',
    {
      title: 'Run Calculation',
      description:
        'Run an RF/electronics calculator with the given inputs. Use get_calculator_info first to see its inputs; an ' +
        'input left out takes its default. The result carries provenance: the formula source, assumptions, whether ' +
        'the inputs lie inside the range the calculator is stated for, the inputs used and the engine version.',
      inputSchema: z.object({
        slug: z.string().describe('Calculator slug (e.g. "microstrip-impedance")'),
        inputs: z
          .record(z.string(), z.number())
          .describe('Input values keyed by input name (e.g. {"traceWidth": 1.2, "substrateHeight": 1.6})'),
      }),
    },
    async ({ slug, inputs }) => {
      const calc = getCalculator(slug);
      if (!calc) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Calculator "${slug}" not found. Use list_calculators to see available calculators.`,
            },
          ],
          isError: true,
        };
      }

      try {
        // Computed on exactly the inputs the provenance reports: every declared
        // input, the caller's value or else its default. A left-out input used
        // to reach calculate() as undefined.
        const applied = appliedInputs(calc, inputs);
        const startedAt = Date.now();
        const result = calc.calculate(applied);
        const provenance = buildCalculatorProvenance(calc, applied, {
          engineVersion: ENGINE_VERSION,
          startedAt,
          values: result.values,
        });

        const results = calc.outputs.map((o) => ({
          key: o.key,
          label: o.label,
          value: result.values[o.key],
          unit: o.unit,
        }));

        const webUrl = `https://rftools.io/calculators/${calc.category}/${calc.slug}`;

        const response: Record<string, unknown> = {
          slug: calc.slug,
          results,
          webUrl,
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

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Calculation error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // --- the simulation surface: one typed tool per job type, generated from
  //     shared/job-schemas, plus the lifecycle tools ---
  registerSimulationTools(server);

  return server;
}

async function main() {
  const transport = new StdioServerTransport();
  await createServer().connect(transport);
  console.error('rftools MCP server running on stdio');
}

// Only start when run as a program. Importing this module must not touch stdio.
// The published artefact is the CommonJS bundle, where `require.main` is the
// entry module; in any other loader both identifiers are simply absent.
const runningAsProgram =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeof require !== 'undefined' && typeof module !== 'undefined' && (require as any).main === module;

if (runningAsProgram) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
