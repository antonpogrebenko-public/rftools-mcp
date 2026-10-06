import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getAllCalculators } from '@/lib/calculators/registry';
import packageJson from './package.json' with { type: 'json' };
import { RftoolsApi, UPLOAD_NEEDS_KEY } from './src/api.ts';
import { CALCULATOR_STATEMENTS, registerCalculatorTools } from './src/calculator-tools.ts';
import { JOB_TYPES, assertContractConsistent } from './src/job-schemas.ts';
import { buildManifest } from './src/manifest.ts';
import { registerReferenceResources } from './src/reference-resources.ts';

// For the tests, which drive the bundle: what the /reference/ routes publish.
export { referenceSlugCounts } from './src/reference-resources.ts';
import {
  DEDUP_WINDOW_SECONDS,
  KEYLESS_STATEMENT,
  RESULT_URL_LIFETIME,
  TIER_LIMITS,
  registerSimulationTools,
} from './src/simulation-tools.ts';

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
 *
 * Registration order is the tools/list order, and it is fixed: the calculator
 * tools, then one simulate_* tool per job type in index order, then the job
 * lifecycle tools. The manifest and the /agents page list them in this order.
 */
export function createServer(): McpServer {
  assertContractConsistent();

  const server = new McpServer({
    name: 'rftools',
    version: '2.5.0',
  });

  // Shared with the simulation tools below, so a test that overrides the
  // fetch or the key for one overrides it for both.
  const api = new RftoolsApi();

  // list, search, describe, schema, run (locally) and solve (on rftools.io).
  registerCalculatorTools(server, { api, engineVersion: ENGINE_VERSION });

  // --- the simulation surface: one typed tool per job type, generated from
  //     shared/job-schemas, plus the lifecycle tools ---
  registerSimulationTools(server, { api });

  // --- the /reference/ tables as resources ---
  registerReferenceResources(server);

  return server;
}

/** The manifest of what this build lists (openspec agent-surface, design D1). */
export async function manifest(): Promise<Record<string, unknown>> {
  return buildManifest(createServer(), {
    packageName: packageJson.name,
    mcpName: packageJson.mcpName,
    calculators: getAllCalculators().length,
    jobTypes: JOB_TYPES.length,
    statements: {
      tiers: TIER_LIMITS,
      keyless: KEYLESS_STATEMENT,
      // The key list_simulation_tools answers with, so both say it the same way.
      fileToolsNeedKey: UPLOAD_NEEDS_KEY,
      calculatorsRunLocally: CALCULATOR_STATEMENTS.calculatorsRunLocally,
      solveNeedsKey: CALCULATOR_STATEMENTS.solveNeedsKey,
      resultLinkLifetime: RESULT_URL_LIFETIME,
      dedupWindowSeconds: DEDUP_WINDOW_SECONDS,
    },
  });
}

async function main() {
  // `--manifest`: print what this build lists, as JSON, and exit without
  // serving. scripts/sync_mcp_manifest.ts in the monorepo runs this.
  if (process.argv.includes('--manifest')) {
    process.stdout.write(`${JSON.stringify(await manifest(), null, 2)}\n`);
    return;
  }
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
