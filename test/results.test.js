// What a result looks like by the time it reaches an agent.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

test('the summarised JSON is compact, not pretty-printed', () => {
  const shaped = shapeResult('pdn_impedance', 'job-1', { status: 'completed' }, { summary: { a: 1 } });
  const text = JSON.stringify(shaped);
  assert.ok(!text.includes('\n  '), 'expected compact JSON');
});
