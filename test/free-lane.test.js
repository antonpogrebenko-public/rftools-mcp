// A key is not required to try the free lane, and when there is none the
// caller is told which limits apply.

import test from 'node:test';
import assert from 'node:assert/strict';

import { freeLaneBounds, freeLaneNote, runAndWait, handleListTools } from '../src/simulation-tools.ts';
import { JOB_TYPES } from '../src/job-schemas.ts';
import { makeTestDeps, scriptedFetch, jsonResponse, connectedServer, textOf, jsonOf } from './helpers.js';

function completedJob() {
  return scriptedFetch([
    [(url, init) => url.endsWith('/v1/jobs') && init?.method === 'POST', () =>
      jsonResponse({ jobId: 'free-1', status: 'queued', queuePosition: 1, queueTotal: 1 })],
    ['/v1/jobs/free-1', () =>
      jsonResponse({
        jobId: 'free-1',
        jobType: 'pdn_impedance',
        status: 'completed',
        resultUrl: 'https://r.test/free-1',
      })],
    ['r.test', () => jsonResponse({ summary: { zMax_mohm: 30 } })],
  ]);
}

test('with no key the job is still submitted, and unauthenticated', async () => {
  const fetchImpl = completedJob();
  const deps = makeTestDeps({ fetchImpl, apiKey: '' });
  const out = await runAndWait(deps, 'pdn_impedance', { boardWidth_mm: 100 }, { waitSeconds: 30 });
  assert.notEqual(out.isError, true);

  const submit = fetchImpl.callsTo('/v1/jobs')[0];
  assert.equal(submit.method, 'POST');
  assert.equal(submit.init.headers.Authorization, undefined);
});

test('the response states the free limits when there is no key', async () => {
  const fetchImpl = completedJob();
  const deps = makeTestDeps({ fetchImpl, apiKey: '' });
  const text = textOf(await runAndWait(deps, 'pdn_impedance', {}, { waitSeconds: 30 }));
  assert.match(text, /free lane/);
  assert.match(text, /5 runs\/month/);
  assert.match(text, /100\/month/);
  // The result is still there, after the note.
  const body = JSON.parse(text.slice(text.indexOf('{')));
  assert.equal(body.jobId, 'free-1');
});

test('with a key there is no note and the request is authenticated', async () => {
  const fetchImpl = completedJob();
  const deps = makeTestDeps({ fetchImpl, apiKey: 'rfc_live' });
  const text = textOf(await runAndWait(deps, 'pdn_impedance', {}, { waitSeconds: 30 }));
  assert.doesNotMatch(text, /free lane/);
  assert.ok(text.startsWith('{'), text.slice(0, 80));
  assert.equal(fetchImpl.callsTo('/v1/jobs')[0].init.headers.Authorization, 'Bearer rfc_live');
});

test('the note names the bounds the contract puts on the free lane', () => {
  const trials = freeLaneBounds('filter_monte_carlo');
  assert.ok(trials.join(' ').includes('monteCarloIterations'), trials.join(' '));
  assert.ok(trials.join(' ').includes('500'), trials.join(' '));

  const fdtd = freeLaneBounds('fdtd_sparam');
  assert.ok(fdtd.join(' ').includes('normal'), fdtd.join(' '));
  assert.ok(fdtd.join(' ').includes('fine'), fdtd.join(' '));

  const antenna = freeLaneBounds('antenna_sim');
  assert.ok(antenna.join(' ').includes('optimize'), antenna.join(' '));

  // A job type the contract puts no tier bound on says nothing extra.
  assert.deepEqual(freeLaneBounds('emi_radiated'), []);

  assert.match(freeLaneNote('filter_monte_carlo'), /monteCarloIterations/);
});

test('list_simulation_tools states the counts, the limits and the lifetimes from the contract', () => {
  const listed = JSON.parse(textOf(handleListTools()));
  assert.equal(listed.count, JOB_TYPES.length);
  assert.match(listed.tiers, /5 runs\/month/);
  assert.match(listed.keyless, /free lane/);
  assert.match(listed.resultLifetime, /15 minutes/);
  assert.equal(listed.dedupWindowSeconds, 60);
  const fdtd = listed.tools.find((t) => t.jobType === 'fdtd_sparam');
  assert.ok(fdtd.freeLaneBounds.join(' ').includes('fine'));
});

test('a keyless server still registers every tool', async () => {
  const harness = await connectedServer({ apiKey: '' });
  try {
    const { tools } = await harness.client.listTools();
    assert.equal(tools.length, JOB_TYPES.length + 5);
    const listed = jsonOf(await harness.client.callTool({ name: 'list_simulation_tools', arguments: {} }));
    assert.equal(listed.count, JOB_TYPES.length);
  } finally {
    await harness.close();
  }
});
