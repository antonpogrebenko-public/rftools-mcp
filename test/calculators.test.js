// The calculator tools, as an agent meets them: run_calculation's result and
// the provenance envelope it carries (openspec api-metering, task 11.1; spec
// result-provenance, "Results computed by the MCP server SHALL carry the
// envelope").
//
// These tests drive the built bundle, dist/mcp-server.cjs, because the
// calculator tools live in mcp-server.ts, which imports the frontend registry
// through the `@` alias that only the build resolves. The bundle is what npm
// ships, and `npm run build:check` (run by the monorepo's
// scripts/pre-deploy-check.sh) fails whenever it is not what the sources
// produce — so after `npm run build`, testing the bundle tests the sources.
//
// The schema is shared/result-provenance.schema.json, the canonical copy. Ajv
// is the one the MCP SDK already depends on, so no package is added for it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const BUNDLE = here('../dist/mcp-server.cjs');
const pkg = JSON.parse(readFileSync(here('../package.json'), 'utf8'));
const schema = JSON.parse(readFileSync(here('../../shared/result-provenance.schema.json'), 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function loadBundle() {
  assert.ok(existsSync(BUNDLE), 'dist/mcp-server.cjs is missing: run `npm run build` in the rfhub monorepo');
  return createRequire(import.meta.url)(BUNDLE);
}

async function connect() {
  const { createServer } = loadBundle();
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    async call(name, args) {
      const result = await client.callTool({ name, arguments: args });
      const text = result.content.map((c) => c.text).join('\n');
      return { isError: Boolean(result.isError), text, json: result.isError ? null : JSON.parse(text) };
    },
    async close() {
      await client.close();
      await server.close();
    },
  };
}

function schemaErrors(envelope) {
  return validate(envelope) ? null : ajv.errorsText(validate.errors);
}

test('run_calculation carries the provenance envelope, naming this release as the engine', async () => {
  const s = await connect();
  try {
    const { json } = await s.call('run_calculation', { slug: 'microstrip-impedance', inputs: {} });
    const p = json.provenance;
    assert.equal(schemaErrors(p), null);
    assert.equal(p.method, 'calculator:microstrip-impedance');
    assert.equal(p.version, `mcp@${pkg.version}`);
    assert.match(p.formulaRef, /Hammerstad/);
    assert.ok(p.assumptions.length > 0, 'microstrip-impedance states its assumptions');
    assert.equal(p.validRange.status, 'inside');
    assert.equal(p.seed, null);
    assert.ok(Date.now() - Date.parse(p.computedAt) < 60_000, 'computedAt is the clock at computation');

    // The literal the publish workflow reads, the package version and the
    // engine name all agree in what was built.
    assert.equal(s.client.getServerVersion().version, pkg.version);
    assert.equal(loadBundle().ENGINE_VERSION, `mcp@${pkg.version}`);
  } finally {
    await s.close();
  }
});

test('every calculator result validates against the provenance schema', async () => {
  const s = await connect();
  try {
    const { json: listing } = await s.call('list_calculators', {});
    assert.ok(listing.length > 200, `only ${listing.length} calculators listed`);
    const failures = [];
    for (const { slug } of listing) {
      const r = await s.call('run_calculation', { slug, inputs: {} });
      if (r.isError) { failures.push(`${slug}: ${r.text}`); continue; }
      const p = r.json.provenance;
      if (!p) { failures.push(`${slug}: no provenance`); continue; }
      const errors = schemaErrors(p);
      if (errors) failures.push(`${slug}: ${errors}`);
      if (p.method !== `calculator:${slug}`) failures.push(`${slug}: method ${p.method}`);
      if (p.version !== `mcp@${pkg.version}`) failures.push(`${slug}: version ${p.version}`);
    }
    assert.deepEqual(failures, []);
  } finally {
    await s.close();
  }
});

test('a left-out input takes its default, an unread one is named, and the values are what the defaults give', async () => {
  const s = await connect();
  try {
    const { json: info } = await s.call('get_calculator_info', { slug: 'microstrip-impedance' });
    const defaults = Object.fromEntries(info.inputs.map((i) => [i.key, i.defaultValue]));

    const explicit = await s.call('run_calculation', { slug: 'microstrip-impedance', inputs: defaults });
    const omitted = await s.call('run_calculation', { slug: 'microstrip-impedance', inputs: {} });
    assert.deepEqual(omitted.json.results, explicit.json.results);
    assert.ok(omitted.json.results.every((r) => Number.isFinite(r.value)), 'defaults give finite values');
    assert.deepEqual(omitted.json.provenance.inputs, defaults);

    const partial = await s.call('run_calculation', {
      slug: 'microstrip-impedance',
      inputs: { traceWidth: 2.5, notAnInput: 7 },
    });
    assert.deepEqual(partial.json.provenance.inputs, { ...defaults, traceWidth: 2.5 });
    assert.ok(!('notAnInput' in partial.json.provenance.inputs));
    assert.deepEqual(partial.json.warnings, [
      "Input 'notAnInput' is not read by this calculator and was ignored.",
    ]);
  } finally {
    await s.close();
  }
});

test('an input outside its stated range is still computed, and flagged in validRange and a warning', async () => {
  const s = await connect();
  try {
    const { json } = await s.call('run_calculation', { slug: 'microstrip-impedance', inputs: { traceWidth: 100 } });
    assert.ok(Number.isFinite(json.results[0].value), 'still computed');
    const { validRange } = json.provenance;
    assert.equal(validRange.status, 'outside');
    assert.deepEqual(validRange.outside, ['traceWidth']);
    assert.equal(schemaErrors(json.provenance), null);
    assert.deepEqual(json.warnings, [
      "Input 'traceWidth' = 100 is outside the range this calculator is stated for (0.01 to 50 mm); "
        + 'the result is extrapolated.',
    ]);
  } finally {
    await s.close();
  }
});

test('a fitted model reports its range and whether the inputs lie inside it', async () => {
  const s = await connect();
  try {
    const { json } = await s.call('run_calculation', { slug: 'differential-pair', inputs: {} });
    const { model, status } = json.provenance.validRange;
    assert.ok(model, 'differential-pair has a fitted model');
    assert.equal(typeof model.description, 'string');
    assert.ok(model.worstCaseError > 0);
    assert.equal(model.inside, true, 'the defaults lie inside the validated range');
    assert.equal(status, 'inside');
    assert.equal(schemaErrors(json.provenance), null);
  } finally {
    await s.close();
  }
});
