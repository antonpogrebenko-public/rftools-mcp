// Every tool declares what it does through annotations (openspec
// agent-surface, task 2.3; spec mcp-discovery, "Every tool declares its
// behaviour through annotations"; design D7). A host reads these to decide
// what to run without asking: a tool wrongly marked read-only can spend a free
// account's five runs unprompted, and a missing hint is a common reason a
// directory rejects a server.

import test from 'node:test';
import assert from 'node:assert/strict';

import { connectBundle } from './helpers.js';

const HINTS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'];

/** Design D7, plus solve_calculation (which spends a metered call). */
const READ_ONLY = new Set([
  'list_calculators',
  'search_calculators',
  'get_calculator_info',
  'get_calculator_schema',
  'run_calculation',
  'list_simulation_tools',
  'get_simulation_status',
  'get_simulation_result',
]);

/** Each tool's missing annotations, named — the check the suite runs on the real listing. */
function missingAnnotations(tools) {
  const problems = [];
  for (const tool of tools) {
    const a = tool.annotations ?? {};
    if (!tool.title && !a.title) problems.push(`${tool.name}: no title`);
    for (const hint of HINTS) {
      if (typeof a[hint] !== 'boolean') problems.push(`${tool.name}: no ${hint}`);
    }
  }
  return problems;
}

let listing;
test.before(async () => {
  const s = await connectBundle();
  try {
    listing = (await s.client.listTools()).tools;
  } finally {
    await s.close();
  }
});

test('every tool has a title and all four hints', () => {
  assert.equal(listing.length, 24);
  assert.deepEqual(missingAnnotations(listing), []);
  for (const tool of listing) assert.equal(tool.annotations.title, tool.title, tool.name);
});

test('the check names a tool registered without annotations', () => {
  const problems = missingAnnotations([
    { name: 'bare_tool' },
    { name: 'half_tool', title: 'Half', annotations: { readOnlyHint: true } },
  ]);
  assert.ok(problems.includes('bare_tool: no title'));
  assert.ok(problems.includes('bare_tool: no readOnlyHint'));
  assert.ok(problems.includes('half_tool: no destructiveHint'));
  assert.ok(!problems.some((p) => p.startsWith('half_tool: no title')));
});

test('tools that only list, search, describe, calculate locally or read a job are read-only and idempotent', () => {
  for (const tool of listing.filter((t) => READ_ONLY.has(t.name))) {
    assert.equal(tool.annotations.readOnlyHint, true, tool.name);
    assert.equal(tool.annotations.idempotentHint, true, tool.name);
  }
  assert.equal(listing.filter((t) => READ_ONLY.has(t.name)).length, READ_ONLY.size);
});

test('tools that start a job or spend a metered call are neither read-only nor idempotent', () => {
  const spending = listing.filter((t) => !READ_ONLY.has(t.name));
  assert.deepEqual(
    spending.map((t) => t.name).filter((n) => !n.startsWith('simulate_')).sort(),
    ['run_simulation', 'solve_calculation', 'submit_simulation'],
  );
  assert.equal(spending.filter((t) => t.name.startsWith('simulate_')).length, 13);
  for (const tool of spending) {
    assert.equal(tool.annotations.readOnlyHint, false, tool.name);
    assert.equal(tool.annotations.idempotentHint, false, tool.name);
  }
});

test('nothing is destructive and nothing reaches beyond rftools.io', () => {
  for (const tool of listing) {
    assert.equal(tool.annotations.destructiveHint, false, tool.name);
    assert.equal(tool.annotations.openWorldHint, false, tool.name);
  }
});

test('the spec scenario: run_calculation and simulate_fdtd_sparam as a host reads them', () => {
  const run = listing.find((t) => t.name === 'run_calculation').annotations;
  assert.equal(run.readOnlyHint, true);
  assert.equal(run.idempotentHint, true);
  const fdtd = listing.find((t) => t.name === 'simulate_fdtd_sparam').annotations;
  assert.equal(fdtd.readOnlyHint, false);
  assert.equal(fdtd.destructiveHint, false);
});
