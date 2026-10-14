// The manifest: what this server lists, as one JSON document (openspec
// agent-surface, design D1).
//
// It is produced by asking the built server itself — an in-memory client
// calls tools/list, resources/list and resources/templates/list — never by
// reading the sources, which could describe a server the published bundle
// does not serve. `node dist/mcp-server.cjs --manifest` prints it;
// scripts/sync_mcp_manifest.ts (monorepo root) writes it to
// shared/mcp/manifest.json and mirrors it to the frontend, which builds the
// /agents page from it.
//
// Shape (every field is derived; nothing here is typed by hand):
//   server       name, version, package, mcpName: as initialize and package.json state them
//   counts       tools by group, resources, templates, calculators, job
//                types, and the description length bound and listing budget
//                beside what is actually used
//   statements   the server's own sentences about tiers, keys and results
//   tools[]      name, group, title, question, description, annotations,
//                inputSchema — in tools/list order
//   resources[], resourceTemplates[]  as listed

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DESCRIPTION_MAX_CHARS, LISTING_BUDGET_BYTES, TOOL_NAME_MAX_CHARS, questionOf } from './tool-copy.ts';

export type ToolGroup = 'calculator' | 'simulate' | 'job';

/**
 * The same split `scripts/inventory.py` makes when it counts the bundle's
 * tools for CLAUDE.md: `simulate_*`, then anything about calculators, then the
 * job lifecycle tools.
 */
export function toolGroup(name: string): ToolGroup {
  if (name.startsWith('simulate_')) return 'simulate';
  if (name.includes('calculat')) return 'calculator';
  return 'job';
}

export interface ManifestInfo {
  packageName: string;
  mcpName: string;
  calculators: number;
  jobTypes: number;
  statements: Record<string, string | number>;
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

async function listAll<T>(fetchPage: (cursor?: string) => Promise<{ nextCursor?: string } & Record<string, unknown>>, key: string): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    out.push(...((page[key] as T[]) ?? []));
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

export async function buildManifest(server: McpServer, info: ManifestInfo): Promise<Record<string, unknown>> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'rftools-manifest', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const serverInfo = client.getServerVersion();
    type Tool = { name: string; title?: string; description?: string; inputSchema: unknown; annotations?: unknown };
    const tools = await listAll<Tool>((cursor) => client.listTools(cursor ? { cursor } : {}) as never, 'tools');
    const resources = await listAll<Record<string, unknown>>(
      (cursor) => client.listResources(cursor ? { cursor } : {}) as never,
      'resources',
    );
    const templates = await listAll<Record<string, unknown>>(
      (cursor) => client.listResourceTemplates(cursor ? { cursor } : {}) as never,
      'resourceTemplates',
    );

    const byGroup: Record<ToolGroup, number> = { calculator: 0, simulate: 0, job: 0 };
    for (const t of tools) byGroup[toolGroup(t.name)] += 1;
    const descriptionLengths = tools.map((t) => (t.description ?? '').length);
    const byDomain: Record<string, number> = {};
    for (const r of resources) {
      const domain = String(r.uri).split('/')[3] ?? '';
      byDomain[domain] = (byDomain[domain] ?? 0) + 1;
    }

    return {
      server: {
        name: serverInfo?.name ?? null,
        version: serverInfo?.version ?? null,
        package: info.packageName,
        mcpName: info.mcpName,
      },
      counts: {
        tools: tools.length,
        toolsByGroup: byGroup,
        calculators: info.calculators,
        jobTypes: info.jobTypes,
        resources: resources.length,
        resourcesByDomain: byDomain,
        resourceTemplates: templates.length,
        toolNameMaxChars: TOOL_NAME_MAX_CHARS,
        descriptionMaxChars: DESCRIPTION_MAX_CHARS,
        longestDescriptionChars: Math.max(0, ...descriptionLengths),
        descriptionChars: descriptionLengths.reduce((a, b) => a + b, 0),
        listingBudgetBytes: LISTING_BUDGET_BYTES,
        listingBytes: utf8Bytes(JSON.stringify(tools)),
      },
      statements: info.statements,
      tools: tools.map((t) => ({
        name: t.name,
        group: toolGroup(t.name),
        title: t.title ?? null,
        question: questionOf(t.description ?? ''),
        description: t.description ?? '',
        annotations: t.annotations ?? null,
        inputSchema: t.inputSchema,
      })),
      resources,
      resourceTemplates: templates,
    };
  } finally {
    await client.close();
    await server.close();
  }
}
