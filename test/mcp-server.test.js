'use strict';

// Tests for mcp-server.ts's static tool metadata.
//
// mcp-server.ts calls `main()` (which connects a StdioServerTransport and
// blocks on stdio) unconditionally at module load, with no
// `require.main === module` guard — importing it here would hang the test
// run waiting on stdin. There's also no TypeScript loader wired into this
// package (no ts-node/tsx/vitest dependency), so nothing here could import
// the .ts file directly anyway. Instead we read mcp-server.ts as plain text
// and assert against it with regexes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_PATH = path.join(__dirname, '..', 'mcp-server.ts');
const source = fs.readFileSync(SOURCE_PATH, 'utf8');

// Registry keys for the pdn-impedance tool's inputSchema, from
// frontend/src/lib/tools/registry.ts (~lines 777-816), confirmed against
// what backend/worker/handlers/pdn_impedance.py actually reads via
// `params.get(...)` / `_f(...)`.
const PDN_IMPEDANCE_REGISTRY_KEYS = [
  'boardWidth_mm',
  'boardLength_mm',
  'dielectricEr',
  'lossTangent',
  'boardThickness_mm',
  'portX_mm',
  'portY_mm',
  'vrmBandwidth_hz',
  'vrmDcr_mohm',
  'targetImpedance_mohm',
  'freqMin_hz',
  'freqMax_hz',
  'maxCapCount',
];

function extractSimulationToolsBlock(text) {
  const match = text.match(/const SIMULATION_TOOLS = \[([\s\S]*?)\]\s*as const;/);
  assert.ok(match, 'expected to find `const SIMULATION_TOOLS = [ ... ] as const;` in mcp-server.ts');
  return match[1];
}

function countSimulationTools(text) {
  const block = extractSimulationToolsBlock(text);
  const jobTypeMatches = block.match(/\bjobType:\s*'/g) || [];
  return jobTypeMatches.length;
}

function extractPdnImpedanceParams(text) {
  const block = extractSimulationToolsBlock(text);
  const entryMatch = block.match(/slug:\s*'pdn-impedance'[\s\S]*?params:\s*'([^']*)'/);
  assert.ok(entryMatch, 'expected to find a pdn-impedance entry with a params string');
  return entryMatch[1];
}

test('SIMULATION_TOOLS has exactly 13 entries', () => {
  assert.equal(countSimulationTools(source), 13);
});

test('list_simulation_tools description reflects SIMULATION_TOOLS.length dynamically', () => {
  assert.match(source, /\$\{SIMULATION_TOOLS\.length\} server-side/);
});

test('pdn_impedance params string mentions every registry key', () => {
  const params = extractPdnImpedanceParams(source);
  for (const key of PDN_IMPEDANCE_REGISTRY_KEYS) {
    assert.ok(
      params.includes(key),
      `expected pdn_impedance params string to mention "${key}", got: ${params}`,
    );
  }
});
