// The three lifecycle tools: submit, status, result.

import test from 'node:test';
import assert from 'node:assert/strict';

import { handleStatus, handleResult } from '../src/simulation-tools.ts';
import { makeTestDeps, scriptedFetch, jsonResponse, connectedServer, jsonOf, textOf } from './helpers.js';

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

test('submit_simulation returns the id, the queue position and the time budget', async () => {
  const fetchImpl = statusSequence([COMPLETED]);
  const harness = await connectedServer({ apiKey: 'rfc_k', baseUrl: 'https://api.test/py', fetchImpl });
  try {
    const out = jsonOf(
      await harness.client.callTool({
        name: 'submit_simulation',
        arguments: { jobType: 'pdn_impedance', params: { boardWidth_mm: 100 } },
      }),
    );
    assert.equal(out.jobId, 'job-42');
    assert.equal(out.status, 'queued');
    assert.equal(out.queuePosition, 2);
    assert.equal(out.queueTotal, 5);
    assert.equal(out.timeBudgetSeconds, 360); // from index.json
    assert.match(out.webUrl, /tools\/pdn-impedance\/results\?jobId=job-42/);
    assert.equal(fetchImpl.callsTo('/v1/jobs').length, 1); // submitted, not waited on
  } finally {
    await harness.close();
  }
});

test('get_simulation_status reports progress, stage and queue position', async () => {
  const fetchImpl = statusSequence([
    {
      jobId: 'job-42',
      jobType: 'pdn_impedance',
      status: 'processing',
      progress: 0.4,
      stage: 'optimising decoupling',
      startedAt: '2026-09-21T09:59:00Z',
      queuePosition: null,
    },
  ]);
  const deps = makeTestDeps({ fetchImpl });
  const out = JSON.parse(textOf(await handleStatus(deps, 'job-42')));
  assert.equal(out.status, 'processing');
  assert.equal(out.progress, 0.4);
  assert.equal(out.stage, 'optimising decoupling');
  assert.equal(out.resultReady, false);
  assert.match(out.webUrl, /pdn-impedance/);
});

test('get_simulation_result summarises by default and returns everything on request', async () => {
  const fetchImpl = statusSequence([COMPLETED]);
  const deps = makeTestDeps({ fetchImpl });

  const summarised = JSON.parse(textOf(await handleResult(deps, 'job-42', false)));
  assert.equal(summarised.summarised, true);
  assert.deepEqual(summarised.result.summary, RESULT.summary);
  assert.deepEqual(summarised.result.warnings, RESULT.warnings);
  assert.deepEqual(summarised.result.provenance, RESULT.provenance);
  assert.equal(summarised.result.freqs_hz.length, 400);
  assert.equal(summarised.result.freqs_hz.first, 1e6);
  assert.equal(summarised.result.nPorts, 1);
  assert.equal(summarised.resultUrl, COMPLETED.resultUrl);
  assert.equal(summarised.resultUrlExpiresIn, 900);

  const full = JSON.parse(textOf(await handleResult(deps, 'job-42', true)));
  assert.equal(full.full, true);
  assert.deepEqual(full.result, RESULT);
});

test('a result asked for before the job finishes says so rather than failing', async () => {
  const fetchImpl = statusSequence([{ jobId: 'job-42', jobType: 'pdn_impedance', status: 'queued', queuePosition: 3 }]);
  const deps = makeTestDeps({ fetchImpl });
  const out = await handleResult(deps, 'job-42', false);
  assert.notEqual(out.isError, true);
  const body = JSON.parse(textOf(out));
  assert.equal(body.status, 'queued');
  assert.equal(body.queuePosition, 3);
});
