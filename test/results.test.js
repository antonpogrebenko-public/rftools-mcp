// What a result looks like by the time it reaches an agent.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import { summariseResult, describeSeries } from '../src/summarize.ts';
import { shapeResult } from '../src/simulation-tools.ts';

const FIXTURE_DIR = '../../frontend/src/components/async-tool/results/__tests__/fixtures/';

function fixture(name) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(FIXTURE_DIR + name, import.meta.url)), 'utf8'));
}

test('a series longer than 50 points is described, not listed', () => {
  const payload = { trace: Array.from({ length: 400 }, (_, i) => i * 0.5) };
  const { value } = summariseResult(payload);
  assert.deepEqual(value.trace, { length: 400, min: 0, max: 199.5, first: 0, last: 199.5 });
});

test('a short series is kept as it is', () => {
  const payload = { pts: [1, 2, 3] };
  const { value } = summariseResult(payload);
  assert.deepEqual(value.pts, [1, 2, 3]);
});

test('a long series of non-numbers keeps its ends', () => {
  const arr = Array.from({ length: 80 }, (_, i) => ({ name: `s${i}` }));
  const described = describeSeries(arr);
  assert.equal(described.length, 80);
  assert.deepEqual(described.first, { name: 's0' });
  assert.deepEqual(described.last, { name: 's79' });
  assert.equal(described.min, undefined);
});

test('the envelope keys lead and survive', () => {
  const payload = {
    bulk: Array.from({ length: 5000 }, (_, i) => i),
    summary: { gainMax_db: 12.4 },
    warnings: [{ code: 'coarse_mesh', message: 'mesh is coarse' }],
    provenance: { method: 'openEMS', version: '0.0.36', seed: 1, elapsedSeconds: 88 },
  };
  const { value } = summariseResult(payload);
  assert.deepEqual(Object.keys(value).slice(0, 3), ['summary', 'warnings', 'provenance']);
  assert.deepEqual(value.summary, { gainMax_db: 12.4 });
  assert.equal(value.warnings.length, 1);
  assert.equal(value.provenance.method, 'openEMS');
});

/**
 * A job's provenance as a worker writes it after api-metering 6.3: all nine
 * members, and an `inputs` holding a list longer than a series (an antenna's
 * wires) and an assumption longer than the summary's string limit — the two
 * things the reduction would otherwise have described or cut.
 */
function jobProvenance() {
  const wires = Array.from({ length: 120 }, (_, i) => ({
    tag: i + 1, segments: 11, x1: 0, y1: 0, z1: i * 0.01, x2: 0, y2: 0, z2: (i + 1) * 0.01, radius: 0.001,
  }));
  return {
    method: 'nec2',
    version: 'worker@3f2c1a9b04de',
    formulaRef: 'Burke & Poggio, "Numerical Electromagnetics Code (NEC)", LLNL 1981',
    assumptions: [
      { code: 'thin-wire', text: `Thin-wire kernel: ${'every wire radius is small against the wavelength and the segment length, '.repeat(10)}` },
      { code: 'perfect-ground', text: 'Perfect ground plane below the structure.' },
    ],
    validRange: {
      status: 'inside',
      bounds: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`p${i}`, { min: 0, max: 100 + i, unit: 'mm' }])),
      outside: [],
      model: null,
    },
    computedAt: '2026-09-24T12:00:01.234Z',
    inputs: { solveMode: 'sweep', freqStart_mhz: 100, freqStop_mhz: 200, wires },
    seed: null,
    elapsedSeconds: 41.2,
  };
}

test('a summarised job result keeps its provenance whole (spec result-provenance)', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(
    fileURLToPath(new URL('../../shared/result-provenance.schema.json', import.meta.url)), 'utf8',
  )));
  const provenance = jobProvenance();
  assert.ok(validate(provenance), ajv.errorsText(validate.errors));

  const payload = {
    summary: { gainMax_dbi: 7.1 },
    warnings: [],
    provenance,
    frequencies_mhz: Array.from({ length: 2001 }, (_, i) => 100 + i * 0.05),
    swr: Array.from({ length: 2001 }, (_, i) => 1 + (i % 17) / 10),
    log: 'x'.repeat(50_000),
  };
  const shaped = shapeResult('antenna_sim', 'job-9', { status: 'completed' }, payload);

  // Everything else is still summarised, the long log cut to fit...
  assert.equal(shaped.summarised, true);
  assert.equal(shaped.truncated, true);
  assert.ok(!Array.isArray(shaped.result.swr), 'the series is described, not listed');
  assert.ok(shaped.result.log === undefined || shaped.result.log.length <= 600);
  // ...but the provenance is exactly what the worker wrote, and still valid.
  assert.deepEqual(shaped.result.provenance, jobProvenance());
  assert.ok(validate(shaped.result.provenance), ajv.errorsText(validate.errors));
  assert.deepEqual(Object.keys(shaped.result).slice(0, 3), ['summary', 'warnings', 'provenance']);
  // The budget bounds the rest: the result minus its provenance still fits.
  const { provenance: _whole, ...rest } = shaped.result;
  assert.ok(JSON.stringify({ ...shaped, result: rest }).length < 8192);
});

test('a legacy provenance is returned as it was written, members missing and all', () => {
  const legacy = { method: 'cavity+GA', version: '3.1.0', seed: 7, inputs: { turns: [1, 2, 3] }, elapsedSeconds: 41.2 };
  const { value } = summariseResult({ provenance: legacy, bulk: Array.from({ length: 900 }, (_, i) => i) });
  assert.deepEqual(value.provenance, legacy);
});

test('a result without summary, warnings or provenance still summarises', () => {
  const payload = { nPorts: 4, filename: 'dut.s4p', freqs: Array.from({ length: 200 }, (_, i) => i) };
  const { value } = summariseResult(payload);
  assert.equal(value.nPorts, 4);
  assert.equal(value.filename, 'dut.s4p');
  assert.equal(value.freqs.length, 200);
});

test('the 100 kB S-parameter result summarises to under 8 kB, keeping every stage summary', () => {
  const payload = fixture('sparam-4port.json');
  const raw = JSON.stringify(payload).length;
  assert.ok(raw > 50_000, `fixture should be large, is ${raw}`);

  const status = { status: 'completed', resultUrl: 'https://results.test/x.json' };
  const shaped = shapeResult('sparam_pipeline', 'job-7', status, payload);
  const text = JSON.stringify(shaped);
  assert.ok(text.length < 8192, `default output is ${text.length} bytes, expected under 8192`);

  // The headline of every stage survives the reduction.
  assert.equal(shaped.result.stages.length ?? shaped.result.stages.length, 8);
  const stages = Array.isArray(shaped.result.stages) ? shaped.result.stages : [];
  assert.equal(stages.length, 8);
  for (const stage of stages) {
    assert.ok(stage.op, `a stage lost its op: ${JSON.stringify(stage)}`);
    assert.ok(stage.status, 'a stage lost its status');
  }
  assert.ok(stages[1].summary.nViolations !== undefined, JSON.stringify(stages[1]));
  assert.ok(stages[3].summary.zMean_ohm !== undefined, JSON.stringify(stages[3]));

  // And the links are there.
  assert.equal(shaped.webUrl, 'https://rftools.io/tools/sparam-pipeline/results?jobId=job-7');
  assert.equal(shaped.resultUrl, status.resultUrl);
});

test('full: true returns the whole payload', () => {
  const payload = fixture('sparam-4port.json');
  const shaped = shapeResult('sparam_pipeline', 'job-7', { status: 'completed' }, payload, { full: true });
  assert.deepEqual(shaped.result, payload);
  assert.ok(JSON.stringify(shaped).length > 50_000);
});

test('other large fixtures also fit the budget', () => {
  for (const name of ['antenna-sweep.json', 'eye-lossy-line.json', 'smps-subharmonic.json', 'magnetics-verified.json']) {
    const payload = fixture(name);
    const shaped = shapeResult('antenna_sim', 'job-1', { status: 'completed' }, payload);
    const text = JSON.stringify(shaped);
    assert.ok(text.length < 8192, `${name} summarised to ${text.length} bytes`);
  }
});

test('a single enormous string cannot defeat the bound', () => {
  const payload = { summary: { ok: true }, log: 'x'.repeat(200_000) };
  const shaped = shapeResult('pdn_impedance', 'job-1', { status: 'completed' }, payload);
  const text = JSON.stringify(shaped);
  assert.ok(text.length < 8192, `output is ${text.length} bytes`);
  assert.equal(shaped.truncated, true);
  // The headline survives, and the caller is told where the rest went.
  assert.deepEqual(shaped.result.summary, { ok: true });
  if (shaped.result.log !== undefined) {
    assert.ok(shaped.result.log.length <= 600, 'a kept string must be cut to its limit');
    assert.match(shaped.result.log, /use full: true/);
  }
});

test('a very wide result cannot defeat the bound either', () => {
  const payload = Object.fromEntries(
    Array.from({ length: 400 }, (_, i) => [`k${i}`, { a: i, b: `value ${i}`, c: [1, 2, 3] }]),
  );
  const shaped = shapeResult('pdn_impedance', 'job-1', { status: 'completed' }, payload);
  const text = JSON.stringify(shaped);
  assert.ok(text.length < 8192, `output is ${text.length} bytes`);
  assert.ok(shaped.elided || shaped.truncated);
});

test('thousands of scalar keys are dropped down to the budget, quickly', () => {
  const payload = Object.fromEntries(Array.from({ length: 20_000 }, (_, i) => [`s${i}`, i * 1.5]));
  payload.summary = { peak: 42 };
  const started = Date.now();
  const shaped = shapeResult('pdn_impedance', 'job-1', { status: 'completed' }, payload);
  const text = JSON.stringify(shaped);
  assert.ok(text.length < 8192, `output is ${text.length} bytes`);
  assert.deepEqual(shaped.result.summary, { peak: 42 }, 'the headline is never what gets dropped');
  assert.ok(Date.now() - started < 2000, 'summarising must not take seconds');
});

test('when even the headline is too large, only the headline is returned', () => {
  const payload = {
    summary: Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`m${i}`, { v: i, note: `n${i}` }])),
    extra: 'more',
  };
  const shaped = shapeResult('pdn_impedance', 'job-1', { status: 'completed' }, payload);
  const text = JSON.stringify(shaped);
  assert.ok(text.length < 8192, `output is ${text.length} bytes`);
  assert.equal(shaped.truncated, true);
  assert.deepEqual(Object.keys(shaped.result), ['summary']);
});

test('the summarised JSON is compact, not pretty-printed', () => {
  const shaped = shapeResult('pdn_impedance', 'job-1', { status: 'completed' }, { summary: { a: 1 } });
  const text = JSON.stringify(shaped);
  assert.ok(!text.includes('\n  '), 'expected compact JSON');
});
