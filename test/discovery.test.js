// What an agent can find and read without the website (openspec
// agent-surface, tasks 2.5 and 2.7–2.11; spec mcp-discovery): calculator
// search, the input contract, what a calculation assumed, the reference
// tables as resources, and the manifest the server publishes of itself.
//
// Drives the built bundle (see connectBundle in helpers.js).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { connectBundle, loadBundle } from './helpers.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

let s;
test.before(async () => {
  s = await connectBundle();
});
test.after(async () => {
  await s.close();
});

// ── search_calculators (task 2.5) ───────────────────────────────────────────

test('every Search Console query in the fixture finds its calculator in the top three', async () => {
  const { queries } = fixture('search-queries.json');
  assert.ok(queries.length >= 40, 'the fixture is the top-50 list less the brand queries');
  const misses = [];
  for (const { query, expected } of queries) {
    const r = await s.call('search_calculators', { query });
    const top = r.isError ? [] : r.json.results.slice(0, 3).map((x) => x.slug);
    if (!top.includes(expected)) misses.push(`${query} → ${top.join(', ') || r.text} (wanted ${expected})`);
  }
  assert.deepEqual(misses, []);
});

test("the spec's phrasing: trace impedance on FR4 microstrip", async () => {
  const r = await s.call('search_calculators', { query: 'trace impedance on FR4 microstrip' });
  assert.ok(r.json.results.slice(0, 3).some((x) => x.slug === 'microstrip-impedance'));
});

test('a Japanese query finds the calculator through its translated title', async () => {
  const r = await s.call('search_calculators', { query: 'マイクロストリップ インピーダンス' });
  assert.equal(r.isError, false);
  assert.ok(r.json.results.some((x) => x.slug === 'microstrip-impedance'));
  const ko = await s.call('search_calculators', { query: '마이크로스트립 임피던스' });
  assert.ok(ko.json.results.slice(0, 3).some((x) => x.slug === 'microstrip-impedance'), ko.text);
});

test('each result has identifier, title, category, one-line description and page URL', async () => {
  const r = await s.call('search_calculators', { query: 'smith chart' });
  const top = r.json.results[0];
  assert.deepEqual(Object.keys(top), ['slug', 'title', 'category', 'description', 'url', 'score']);
  assert.equal(top.slug, 'smith-chart');
  assert.equal(top.url, 'https://rftools.io/calculators/rf/smith-chart/');
  assert.doesNotMatch(top.description, /\.\s+[A-Z]/, 'one sentence');
  assert.ok(r.json.matched >= r.json.results.length);
  assert.ok(r.json.results.length <= 10, 'ten by default');
});

test('a category filter keeps every result in it; an unknown category is refused naming the valid ones', async () => {
  const pcb = await s.call('search_calculators', { query: 'impedance', category: 'pcb', limit: 25 });
  assert.ok(pcb.json.results.length > 3);
  assert.ok(pcb.json.results.every((x) => x.category === 'pcb'));
  const optics = await s.call('search_calculators', { query: 'impedance', category: 'optics' });
  assert.equal(optics.isError, true);
  assert.match(optics.text, /Unknown category "optics"\. Valid categories: rf, pcb, /);
});

test('a search that matches nothing says so instead of returning an empty success', async () => {
  const r = await s.call('search_calculators', { query: 'zzqx flurbish' });
  assert.equal(r.isError, true);
  assert.match(r.text, /^No calculator matches "zzqx flurbish"\./);
});

test('limit runs from 1 to 25', async () => {
  const one = await s.call('search_calculators', { query: 'filter', limit: 1 });
  assert.equal(one.json.results.length, 1);
  const tooMany = await s.client.callTool({ name: 'search_calculators', arguments: { query: 'filter', limit: 26 } });
  assert.equal(tooMany.isError, true);
});

// ── get_calculator_schema (task 2.7) ────────────────────────────────────────

test('the schema of microstrip-impedance: JSON Schema 2020-12 inputs, outputs, formula and URL', async () => {
  const r = await s.call('get_calculator_schema', { slug: 'microstrip-impedance' });
  assert.deepEqual(r.json, fixture('microstrip-impedance.schema.json'));
  const { properties } = r.json.inputSchema;
  assert.equal(r.json.inputSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  for (const prop of Object.values(properties)) {
    assert.equal(prop.type, 'number');
    for (const key of ['default', 'minimum', 'maximum', 'description']) assert.ok(key in prop, key);
  }
});

test('the schema agrees with get_calculator_info for every calculator', async () => {
  const { json: listing } = await s.call('list_calculators', {});
  for (const { slug } of listing) {
    const [schema, info] = await Promise.all([
      s.call('get_calculator_schema', { slug }),
      s.call('get_calculator_info', { slug }),
    ]);
    const props = schema.json.inputSchema.properties;
    assert.deepEqual(Object.keys(props), info.json.inputs.map((i) => i.key), slug);
    for (const input of info.json.inputs) {
      assert.equal(props[input.key].default, input.defaultValue, `${slug}.${input.key}`);
      assert.equal(props[input.key].minimum, input.min, `${slug}.${input.key}`);
      assert.equal(props[input.key].maximum, input.max, `${slug}.${input.key}`);
    }
    assert.deepEqual(schema.json.outputs.map((o) => o.key), info.json.outputs.map((o) => o.key), slug);
  }
});

test('a misspelt identifier is refused, naming the closest ones', async () => {
  const r = await s.call('get_calculator_schema', { slug: 'microstrip-impedence' });
  assert.equal(r.isError, true);
  assert.match(r.text, /Closest identifiers: microstrip-impedance,/);
});

// ── run_calculation: what it assumed (task 2.8) ─────────────────────────────

test('an omitted input takes its default and is listed in defaultedInputs', async () => {
  const r = await s.call('run_calculation', {
    slug: 'microstrip-impedance',
    inputs: { traceWidth: 3, substrateHeight: 1.6, dielectricConstant: 4.3 },
  });
  assert.deepEqual(r.json.defaultedInputs, ['copperThickness']);
  assert.equal(r.json.provenance.inputs.copperThickness, 35);
  const none = await s.call('run_calculation', { slug: 'microstrip-impedance', inputs: {} });
  assert.deepEqual(none.json.defaultedInputs, ['traceWidth', 'substrateHeight', 'dielectricConstant', 'copperThickness']);
  const all = await s.call('run_calculation', {
    slug: 'microstrip-impedance',
    inputs: { traceWidth: 3, substrateHeight: 1.6, dielectricConstant: 4.3, copperThickness: 35 },
  });
  assert.deepEqual(all.json.defaultedInputs, []);
});

test('an undeclared key is not read and is named in the REST API wording; it is not refused', async () => {
  const r = await s.call('run_calculation', { slug: 'microstrip-impedance', inputs: { traceWidht: 3 } });
  assert.equal(r.isError, false);
  assert.ok(r.json.warnings.includes("Input 'traceWidht' is not read by this calculator and was ignored."));
  assert.ok(r.json.defaultedInputs.includes('traceWidth'));
});

test('a value above its maximum is computed, with a warning naming the input and its range', async () => {
  const r = await s.call('run_calculation', { slug: 'microstrip-impedance', inputs: { traceWidth: 100 } });
  assert.ok(Number.isFinite(r.json.results[0].value));
  assert.ok(r.json.warnings.some((w) => w.startsWith("Input 'traceWidth' = 100 is outside the range") && w.includes('0.01 to 50 mm')));
});

test('a 2.3.0-style call with declared keys returns what 2.3.0 returned', async () => {
  const { calls } = fixture('run-calculation-2.3.0.json');
  assert.ok(Object.keys(calls).length >= 3);
  for (const [slug, { inputs, results, warnings }] of Object.entries(calls)) {
    const r = await s.call('run_calculation', { slug, inputs });
    assert.deepEqual(r.json.results, results, slug);
    assert.deepEqual(r.json.warnings ?? [], warnings, slug);
  }
});

// ── Reference resources (task 2.9) ──────────────────────────────────────────

test('each domain lists one resource per page the site publishes', async () => {
  const { resources } = await s.client.listResources();
  const counts = {};
  for (const r of resources) {
    const [, , , domain] = r.uri.split('/');
    counts[domain] = (counts[domain] ?? 0) + 1;
    assert.equal(r.mimeType, 'application/json', r.uri);
  }
  assert.deepEqual(counts, loadBundle().referenceSlugCounts());
  assert.deepEqual(Object.keys(counts).sort(), ['bands', 'codes', 'connectors', 'pcb', 'values']);
  const { resourceTemplates } = await s.client.listResourceTemplates();
  assert.deepEqual(
    resourceTemplates.map((t) => t.uriTemplate).sort(),
    ['bands', 'codes', 'connectors', 'pcb', 'values'].map((d) => `rftools://reference/${d}/{id}`),
  );
});

test('reading a band returns its values, the source it cites and its page URL', async () => {
  const { contents } = await s.client.readResource({ uri: 'rftools://reference/bands/ism-2-4-ghz' });
  assert.equal(contents.length, 1);
  assert.equal(contents[0].mimeType, 'application/json');
  const band = JSON.parse(contents[0].text);
  assert.equal(band.id, 'ism-2-4-ghz');
  assert.equal(band.url, 'https://rftools.io/reference/bands/ism-2-4-ghz/');
  assert.ok(band.freqMinHz > 2.3e9 && band.freqMaxHz < 2.6e9);
  assert.equal(typeof band.source.note, 'string');
  assert.ok(Array.isArray(band.source.standards));
});

test('every listed resource reads back, and a table carries its rows', async () => {
  const { resources } = await s.client.listResources();
  for (const r of resources) {
    const { contents } = await s.client.readResource({ uri: r.uri });
    const body = JSON.parse(contents[0].text);
    assert.equal(body.name, r.title, r.uri);
  }
  const e24 = JSON.parse((await s.client.readResource({ uri: 'rftools://reference/values/e24-resistor-values' })).contents[0].text);
  assert.equal(e24.rows.length, 24);
  assert.deepEqual(e24.source.standards, ['E24 series']);
  const codes = JSON.parse((await s.client.readResource({ uri: 'rftools://reference/codes/smd-resistor-codes' })).contents[0].text);
  const eia = codes.sections.find((x) => /EIA-96/.test(x.title));
  assert.deepEqual(eia.columns, ['code', 'resistanceOhm', 'tolerancePercent']);
  // The values are the site's, served as they are: this checks the shape, not
  // the arithmetic, which belongs to frontend/src/lib/reference/component-codes.ts.
  assert.ok(eia.rows.some(([code, ohms, tol]) => code === '01C' && typeof ohms === 'number' && tol === 1));
});

test('an unknown identifier fails with invalid params, naming the lookup template', async () => {
  await assert.rejects(
    s.client.readResource({ uri: 'rftools://reference/bands/no-such-band' }),
    (err) => err.code === -32602 && /rftools:\/\/reference\/bands\/\{id\}/.test(err.message),
  );
});

// ── Nothing 2.3.0 accepted is narrowed ──────────────────────────────────────

test('every 2.3.0 tool is still listed, takes every argument it took, and requires nothing new', async () => {
  const { tools: before } = fixture('tools-2.3.0.json');
  assert.equal(Object.keys(before).length, 22);
  const { tools } = await s.client.listTools();
  const now = new Map(tools.map((t) => [t.name, t.inputSchema]));
  for (const [name, { arguments: args, required }] of Object.entries(before)) {
    assert.ok(now.has(name), `${name} is gone`);
    const schema = now.get(name);
    for (const arg of args) assert.ok(arg in (schema.properties ?? {}), `${name}.${arg} is gone`);
    for (const req of schema.required ?? []) assert.ok(required.includes(req), `${name} now requires ${req}`);
  }
});

// ── The manifest (tasks 2.10, 2.11) ─────────────────────────────────────────

test('the manifest lists 24 tools in a fixed order, the resources and the templates, with counts', async () => {
  const m = await loadBundle().manifest();
  const { tools } = await s.client.listTools();
  assert.equal(m.counts.tools, 24);
  assert.deepEqual(m.tools.map((t) => t.name), tools.map((t) => t.name));
  assert.deepEqual(m.counts.toolsByGroup, { calculator: 6, simulate: 13, job: 5 });
  assert.deepEqual(m.tools.slice(0, 6).map((t) => t.name), [
    'list_calculators',
    'search_calculators',
    'get_calculator_info',
    'get_calculator_schema',
    'run_calculation',
    'solve_calculation',
  ]);
  assert.equal(m.counts.resources, m.resources.length);
  assert.equal(m.counts.resourceTemplates, 5);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(m.server, { name: 'rftools', version: pkg.version, package: pkg.name, mcpName: pkg.mcpName });
  for (const key of ['tiers', 'keyless', 'fileToolsNeedKey', 'calculatorsRunLocally', 'solveNeedsKey']) {
    assert.equal(typeof m.statements[key], 'string', key);
  }
});

test('two manifests from two servers are identical', async () => {
  const bundle = loadBundle();
  assert.deepEqual(await bundle.manifest(), await bundle.manifest());
});
