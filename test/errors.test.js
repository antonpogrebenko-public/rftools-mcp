// Failures are classified by status and by the service's own error kind —
// never by matching text — and polling gives up rather than spinning.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError, RftoolsApi, describeApiError, describeJobError, kindForStatus, renderDetail } from '../src/api.ts';
import { runAndWait, handleResult, waitForJob } from '../src/simulation-tools.ts';
import { makeTestDeps, scriptedFetch, jsonResponse, errorResponse, fakeClock } from './helpers.js';

function submitFailing(response) {
  return scriptedFetch([[(url, init) => url.endsWith('/v1/jobs') && init?.method === 'POST', () => response()]]);
}

async function submitAndCatch(response) {
  const fetchImpl = submitFailing(response);
  const deps = makeTestDeps({ fetchImpl });
  const out = await runAndWait(deps, 'pdn_impedance', {}, { waitSeconds: 10 });
  assert.equal(out.isError, true);
  return out.content.map((c) => c.text).join('\n');
}

test('401 is an authentication failure, not a quota one', async () => {
  const text = await submitAndCatch(() => errorResponse(401, 'Invalid API key or monthly quota exceeded'));
  assert.match(text, /API key was refused/);
  assert.match(text, /Invalid API key or monthly quota exceeded/);
  assert.doesNotMatch(text, /Too many requests/);
});

test('402 is a quota failure with the allowances stated', async () => {
  const text = await submitAndCatch(() => errorResponse(402, 'Monthly allowance spent'));
  assert.match(text, /allowance is spent/);
  assert.match(text, /5 runs\/month/);
});

test('429 carries the retry-after the service sent', async () => {
  const text = await submitAndCatch(() => errorResponse(429, 'Too many jobs', { 'Retry-After': '42' }));
  assert.match(text, /Too many requests/);
  assert.match(text, /42 s/);
});

test('a 400 validation refusal is rendered parameter by parameter, verbatim', async () => {
  const detail = [
    { param: 'freqStop', value: 1e6, reason: 'must be above freqStart', allowed: null },
    { param: 'topology', value: 'zig', reason: 'not a known topology', allowed: ['L', 'Pi', 'T'] },
  ];
  const text = await submitAndCatch(() => errorResponse(400, detail));
  assert.match(text, /refused the request as invalid/);
  assert.match(text, /freqStop: must be above freqStart \(given 1000000\)/);
  assert.match(text, /topology: not a known topology \(given "zig"\); allowed: L, Pi, T/);
});

test("a 422 in FastAPI's own shape is rendered too", () => {
  const rendered = renderDetail([{ loc: ['body', 'params', 'freqStart'], msg: 'value is not a valid float' }]);
  assert.match(rendered, /params\.freqStart: value is not a valid float/);
});

test('a 500 is a service fault', async () => {
  const text = await submitAndCatch(() => errorResponse(500, 'boom'));
  assert.match(text, /service failed \(HTTP 500\)/);
});

test('an unreachable service is transient, not a fault', async () => {
  const fetchImpl = () => {
    throw new TypeError('fetch failed');
  };
  const api = new RftoolsApi({ baseUrl: 'https://api.test/py', apiKey: 'k', fetchImpl });
  await assert.rejects(
    () => api.submitJob('pdn_impedance', {}),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.kind, 'transient');
      assert.equal(err.status, 0);
      return true;
    },
  );
});

test('every job error kind has its own sentence', () => {
  const kinds = [
    'invalid_request',
    'too_large',
    'not_available',
    'timeout',
    'interrupted',
    'result_expired',
    'rate_limited',
    'transient',
    'fault',
  ];
  const seen = new Set();
  for (const kind of kinds) {
    const sentence = describeJobError(kind, 'service words');
    assert.ok(sentence.includes('service words'), kind);
    const head = sentence.split('\n')[0];
    assert.ok(!seen.has(head), `${kind} shares a sentence with another kind`);
    seen.add(head);
  }
  assert.match(describeJobError('too_large', 'mesh too fine'), /larger than its lane/);
  assert.match(describeJobError('not_available', 'fine mode is Pro'), /not available on this tier/);
  // An unknown kind still says what the service said.
  assert.match(describeJobError('brand_new_kind', 'something'), /brand_new_kind: something/);
  // No kind at all: the message is complete on its own.
  assert.equal(describeJobError(undefined, 'plain message'), 'plain message');
});

test('a failed job is reported with its kind, not as a timeout', async () => {
  const fetchImpl = scriptedFetch([
    [(url, init) => url.endsWith('/v1/jobs') && init?.method === 'POST', () => jsonResponse({ jobId: 'j1', status: 'queued' })],
    ['/v1/jobs/j1', () =>
      jsonResponse({
        jobId: 'j1',
        jobType: 'fdtd_sparam',
        status: 'failed',
        errorKind: 'too_large',
        errorMessage: 'the fine mesh needs 40 GB',
      })],
  ]);
  const deps = makeTestDeps({ fetchImpl });
  const out = await runAndWait(deps, 'fdtd_sparam', {}, { waitSeconds: 60 });
  assert.equal(out.isError, true);
  const text = out.content[0].text;
  assert.match(text, /larger than its lane/);
  assert.match(text, /40 GB/);
  assert.match(text, /j1/);
});

test('polling stops at once on a 4xx', async () => {
  const fetchImpl = scriptedFetch([['/v1/jobs/gone', () => errorResponse(404, "Job 'gone' not found")]]);
  const deps = makeTestDeps({ fetchImpl });
  await assert.rejects(
    () => waitForJob(deps, 'gone', 120),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 404);
      return true;
    },
  );
  assert.equal(fetchImpl.calls.length, 1, 'a 404 must not be retried');
});

test('polling stops after five failures in a row that are not 4xx', async () => {
  const fetchImpl = scriptedFetch([['/v1/jobs/j2', () => errorResponse(503, 'gateway')]]);
  const deps = makeTestDeps({ fetchImpl });
  await assert.rejects(
    () => waitForJob(deps, 'j2', 600),
    (err) => {
      assert.match(err.message, /five status checks/);
      return true;
    },
  );
  assert.equal(fetchImpl.calls.length, 5);
});

test('a run of failures that recovers keeps polling', async () => {
  let n = 0;
  const fetchImpl = scriptedFetch([
    ['/v1/jobs/j3', () => {
      n += 1;
      if (n <= 3) return errorResponse(502, 'bad gateway');
      return jsonResponse({ jobId: 'j3', status: 'completed', resultUrl: 'https://r.test/j3' });
    }],
  ]);
  const deps = makeTestDeps({ fetchImpl });
  const outcome = await waitForJob(deps, 'j3', 600);
  assert.equal(outcome.timedOut, false);
  assert.equal(outcome.status.status, 'completed');
});

test('a completed job with no result link is reported, never spun on', async () => {
  const fetchImpl = scriptedFetch([
    ['/v1/jobs/j4', () => jsonResponse({ jobId: 'j4', jobType: 'pdn_impedance', status: 'completed' })],
  ]);
  const deps = makeTestDeps({ fetchImpl });
  const out = await handleResult(deps, 'j4', false);
  assert.equal(out.isError, true);
  assert.match(out.content[0].text, /no result link|no longer stored/);
  assert.equal(fetchImpl.calls.length, 1);
});

test('a completed job whose kind says the result expired says so', async () => {
  const fetchImpl = scriptedFetch([
    ['/v1/jobs/j5', () =>
      jsonResponse({
        jobId: 'j5',
        jobType: 'pdn_impedance',
        status: 'completed',
        errorKind: 'result_expired',
        errorMessage: 'stored result removed',
      })],
  ]);
  const deps = makeTestDeps({ fetchImpl });
  const out = await handleResult(deps, 'j5', false);
  assert.equal(out.isError, true);
  assert.match(out.content[0].text, /no longer stored/);
});

test('an expired result link is reported as such, with what to do next', async () => {
  const fetchImpl = scriptedFetch([
    ['/v1/jobs/j6', () =>
      jsonResponse({ jobId: 'j6', jobType: 'pdn_impedance', status: 'completed', resultUrl: 'https://r.test/j6' })],
    ['r.test', () => new Response('expired', { status: 403 })],
  ]);
  const deps = makeTestDeps({ fetchImpl });
  const out = await handleResult(deps, 'j6', false);
  assert.equal(out.isError, true);
  assert.match(out.content[0].text, /no longer valid/);
  assert.match(out.content[0].text, /status again/);
});

test('a locally invalid call never reaches the service', async () => {
  const fetchImpl = scriptedFetch([]);
  const deps = makeTestDeps({ fetchImpl });
  const out = await runAndWait(deps, 'sat_link_budget', { frequency_ghz: 12 }, { waitSeconds: 10 });
  assert.equal(out.isError, true);
  assert.match(out.content[0].text, /latitude_deg/);
  assert.equal(fetchImpl.calls.length, 0);
});

test('an unknown job type names the job types that exist', async () => {
  const fetchImpl = scriptedFetch([]);
  const deps = makeTestDeps({ fetchImpl });
  const out = await runAndWait(deps, 'not_a_job', {}, { waitSeconds: 10 });
  assert.equal(out.isError, true);
  assert.match(out.content[0].text, /pdn_impedance/);
  assert.equal(fetchImpl.calls.length, 0);
});

test('each status maps to its own kind and its own message', () => {
  const expected = {
    401: 'auth',
    402: 'quota',
    403: 'forbidden',
    404: 'not_found',
    413: 'too_large',
    429: 'rate_limited',
    400: 'invalid_request',
    422: 'invalid_request',
    503: 'unavailable',
    500: 'fault',
  };
  for (const [status, kind] of Object.entries(expected)) {
    assert.equal(kindForStatus(Number(status)), kind, `HTTP ${status}`);
  }
  const openings = new Set(
    Object.entries(expected).map(([status, kind]) =>
      describeApiError(new ApiError(Number(status), kind, 'detail')).split('\n')[0],
    ),
  );
  // 400 and 422 share a kind; every other kind reads differently.
  assert.equal(openings.size, new Set(Object.values(expected)).size);
});
