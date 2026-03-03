#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getAllCalculators, getCalculator, getCalculatorsByCategory } from '@/lib/calculators/registry';
import type { CalculatorCategory } from '@/lib/calculators/types';
import { CATEGORIES } from '@/lib/calculators/types';

const VALID_CATEGORIES = Object.keys(CATEGORIES) as CalculatorCategory[];

const server = new McpServer({
  name: 'rftools',
  version: '1.0.0',
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
    const calcs = category
      ? getCalculatorsByCategory(category as CalculatorCategory)
      : getAllCalculators();

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
      'Run an RF/electronics calculator with the given inputs. Use get_calculator_info first to see required inputs.',
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
      const result = calc.calculate(inputs);

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
      if (result.warnings?.length) response.warnings = result.warnings;
      if (result.errors?.length) response.errors = result.errors;

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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('rftools MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
