// The bounded wait: it polls at once, reports progress, and never holds a
// call open past its bound.

import test from 'node:test';
import assert from 'node:assert/strict';

import { runAndWait } from '../src/simulation-tools.ts';
import { API_BASE_URL, makeTestDeps, scriptedFetch, jsonResponse, fakeClock, connectedServer, textOf } from './helpers.js';

const RESULT = {
  summary: { zMin_mohm: 4.1, zMax_mohm: 31.7, capCount: 12 },
  warnings: [{ code: 'target_not_met', message: 'target impedance not met above 400 MHz' }],
  provenance: { method: 'cavity+GA', version: '3.1.0', seed: 7, elapsedSeconds: 41.2 },
  freqs_hz: Array.from({ length: 400 }, (_, i) => 1e6 * (i + 1)),
  z_mohm: Array.from({ length: 400 }, (_, i) => 4 + i * 0.07),
  nPorts: 1,
};

function statusSequence(statuses, { result = RESULT } = {}) {
  let i = 0;
  return scriptedFetch([
    [(url, init) => url.endsWith('/v1/jobs') && init?.method === 'POST', () =>
      jsonResponse({ jobId: 'job-42', status: 'queued', queuePosition: 2, queueTotal: 5 })],
    ['/v1/jobs/job-42', () => {
      const next = statuses[Math.min(i, statuses.length - 1)];
      i += 1;
      return jsonResponse(next);
    }],
    ['results.test', () => jsonResponse(result)],
  ]);
}

const COMPLETED = {
  jobId: 'job-42',
  jobType: 'pdn_impedance',
  status: 'completed',
  progress: 1,
  resultUrl: 'https://results.test/job-42.json?sig=x',
  resultUrlExpiresIn: 900,
  finishedAt: '2026-09-21T10:00:00Z',
};

test('run_simulation polls immediately and returns the result when the job is already done', async () => {
  const clock = fakeClock();
  const fetchImpl = statusSequence([COMPLETED]);
  const deps = makeTestDeps({ fetchImpl, clock });

  const out = await runAndWait(deps, 'pdn_impedance', { boardWidth_mm: 100 }, { waitSeconds: 90 });
  assert.notEqual(out.isError, true);
  const body = JSON.parse(textOf(out));
  assert.equal(body.jobId, 'job-42');
  assert.equal(body.status, 'completed');
  // No sleep before the first poll: an instant job costs no wait.
  assert.deepEqual(clock.sleeps, []);
});

test('a job still running at the bound returns the id and the progress, not an error', async () => {
  const clock = fakeClock();
  const fetchImpl = statusSequence([
    { jobId: 'job-42', jobType: 'pdn_impedance', status: 'queued', queuePosition: 2, queueTotal: 4 },
    { jobId: 'job-42', jobType: 'pdn_impedance', status: 'processing', progress: 0.2, stage: 'meshing' },
    { jobId: 'job-42', jobType: 'pdn_impedance', status: 'processing', progress: 0.5, stage: 'solving' },
  ]);
  const deps = makeTestDeps({ fetchImpl, clock });

  const out = await runAndWait(deps, 'pdn_impedance', {}, { waitSeconds: 3 });
  assert.notEqual(out.isError, true);
  const body = JSON.parse(textOf(out));
  assert.equal(body.jobId, 'job-42');
  assert.equal(body.status, 'processing');
  assert.equal(body.progress, 0.5);
  assert.equal(body.stage, 'solving');
  assert.equal(body.waitedSeconds, 3);
  assert.match(body.note, /continues/);
  // It stopped at the bound rather than polling forever.
  assert.ok(fetchImpl.callsTo('/v1/jobs/job-42').length <= 4);
});

test('waitSeconds: 0 submits and returns at once', async () => {
  const fetchImpl = statusSequence([COMPLETED]);
  const deps = makeTestDeps({ fetchImpl });
  const out = await runAndWait(deps, 'pdn_impedance', {}, { waitSeconds: 0 });
  const body = JSON.parse(textOf(out));
  assert.equal(body.jobId, 'job-42');
  assert.equal(body.status, 'queued');
  assert.equal(fetchImpl.callsTo('/v1/jobs/job-42').length, 0);
});

test('the wait is clamped to the maximum', async () => {
  const clock = fakeClock();
  const fetchImpl = statusSequence([{ jobId: 'job-42', jobType: 'pdn_impedance', status: 'processing', progress: 0.1 }]);
  const deps = makeTestDeps({ fetchImpl, clock, waitMax: 5 });
  const body = JSON.parse(textOf(await runAndWait(deps, 'pdn_impedance', {}, { waitSeconds: 9999 })));
  assert.equal(body.waitedSeconds, 5);
});

test('a waiting call reports progress to a host that asked for it', async () => {
  const fetchImpl = statusSequence([
    { jobId: 'job-42', jobType: 'pdn_impedance', status: 'processing', progress: 0.25, stage: 'meshing' },
    { jobId: 'job-42', jobType: 'pdn_impedance', status: 'processing', progress: 0.75, stage: 'solving' },
    COMPLETED,
  ]);
  const clock = fakeClock();
  const harness = await connectedServer({
    apiKey: 'rfc_k',
    baseUrl: API_BASE_URL,
    fetchImpl,
    sleep: clock.sleep,
    now: clock.now,
    pollIntervalMs: 10,
  });
  try {
    const seen = [];
    const result = await harness.client.callTool(
      { name: 'simulate_pdn_impedance', arguments: { boardWidth_mm: 100, waitSeconds: 60 } },
      undefined,
      { onprogress: (p) => seen.push(p) },
    );
    assert.notEqual(result.isError, true);
    assert.ok(seen.length >= 2, `expected progress notifications, saw ${seen.length}`);
    assert.match(seen[0].message, /processing/);
    assert.equal(seen[0].progress, 0.25);
  } finally {
    await harness.close();
  }
});
