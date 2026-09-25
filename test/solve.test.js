// solve_calculation: POST /v1/calculate/solve. Unlike run_calculation, this
// is a genuine metered network call under the same key /calculate itself
// requires, so it is tested the way the job tools' network handling is
// (errors.test.js, upload-key.test.js), not the way run_calculation is
// (which never touches the network at all).

import test from 'node:test';
import assert from 'node:assert/strict';

import { RftoolsApi } from '../src/api.ts';
import { buildSolveBody, handleSolve, SOLVE_NEEDS_KEY } from '../src/solve.ts';
import { API_BASE_URL, jsonResponse, errorResponse, scriptedFetch, textOf, jsonOf } from './helpers.js';

const ARGS = {
  slug: 'microstrip-impedance',
  inputs: { substrateHeight: 1.6, dielectricConstant: 4.2, copperThickness: 35 },
  solveFor: 'traceWidth',
  target: { output: 'impedance', value: 50 },
};

function api(fetchImpl, apiKey = 'rfc_test') {
  return new RftoolsApi({ baseUrl: API_BASE_URL, apiKey, fetchImpl });
}

function solveRoute(respond) {
  return scriptedFetch([['/v1/calculate/solve', respond]]);
}

function solveResult(overrides = {}) {
  return {
    slug: ARGS.slug,
    solveFor: ARGS.solveFor,
    target: ARGS.target,
    grid: null,
    value: 3.052,
    unrounded: 3.0523862,
    reached: true,
    evaluations: 12,
    warnings: [],
    result: {
      slug: ARGS.slug,
      values: { impedance: 50.0 },
      warnings: [],
      errors: [],
      provenance: { method: `calculator:${ARGS.slug}` },
    },
    ...overrides,
  };
}

// ── The body carries only the fields the caller named ──────────────────────

test('buildSolveBody omits grid and range when the caller left them out', () => {
  const body = buildSolveBody(ARGS);
  assert.deepEqual(Object.keys(body).sort(), ['inputs', 'slug', 'solveFor', 'target']);
  assert.deepEqual(body, {
    slug: ARGS.slug,
    inputs: ARGS.inputs,
    solveFor: ARGS.solveFor,
    target: ARGS.target,
  });
});

test('buildSolveBody adds grid only when the caller gave one', () => {
  const body = buildSolveBody({ ...ARGS, grid: 0.001 });
  assert.equal(body.grid, 0.001);
  assert.ok(!('range' in body));
});

test('buildSolveBody adds range only when the caller gave one', () => {
  const body = buildSolveBody({ ...ARGS, range: [0.1, 10] });
  assert.deepEqual(body.range, [0.1, 10]);
  assert.ok(!('grid' in body));
});

test('buildSolveBody carries both when the caller gave both', () => {
  const body = buildSolveBody({ ...ARGS, grid: 0.001, range: [0.1, 10] });
  assert.deepEqual(Object.keys(body).sort(), ['grid', 'inputs', 'range', 'slug', 'solveFor', 'target']);
});

// ── The request itself: path, method, auth, and exactly that body ──────────

test('handleSolve posts the built body to /calculate/solve, authenticated', async () => {
  const fetchImpl = solveRoute(() => jsonResponse(solveResult()));
  const out = await handleSolve(api(fetchImpl, 'rfc_live'), ARGS);
  assert.notEqual(out.isError, true);

  const call = fetchImpl.apiCalls()[0];
  assert.equal(call.method, 'POST');
  assert.equal(call.pathname, '/py/v1/calculate/solve');
  assert.equal(call.init.headers.Authorization, 'Bearer rfc_live');
  assert.deepEqual(call.body, buildSolveBody(ARGS));
});

test('a call without a key is refused locally, before anything is sent', async () => {
  const fetchImpl = solveRoute(() => jsonResponse(solveResult()));
  const out = await handleSolve(api(fetchImpl, ''), ARGS);
  assert.equal(out.isError, true);
  assert.equal(textOf(out), SOLVE_NEEDS_KEY);
  assert.match(SOLVE_NEEDS_KEY, /RFTOOLS_API_KEY/);
  assert.equal(fetchImpl.calls.length, 0);
});

// ── Success: the response is relayed, reached: false included ──────────────

test('a reached: true response carries the grid value and the forward result', async () => {
  const fetchImpl = solveRoute(() => jsonResponse(solveResult()));
  const out = await handleSolve(api(fetchImpl), ARGS);
  const json = jsonOf(out);
  assert.equal(json.reached, true);
  assert.equal(json.value, 3.052);
  assert.equal(json.result.values.impedance, 50.0);
});

test('a reached: false response is reported as such, not hidden as an error', async () => {
  const fetchImpl = solveRoute(() =>
    jsonResponse(
      solveResult({
        reached: false,
        value: 0.01,
        unrounded: 0.01,
        result: {
          slug: ARGS.slug,
          values: { impedance: 210.4 },
          warnings: [],
          errors: [],
          provenance: { method: `calculator:${ARGS.slug}` },
        },
      }),
    ),
  );
  const out = await handleSolve(api(fetchImpl), { ...ARGS, target: { output: 'impedance', value: 5 } });
  assert.notEqual(out.isError, true, 'an unreached target is still a successful call, per the spec');
  const json = jsonOf(out);
  assert.equal(json.reached, false);
  assert.equal(json.value, 0.01);
  assert.equal(json.result.values.impedance, 210.4);
});

// ── Failure: refusals are classified the same way the job tools' are ───────

test('a 401 is an authentication failure', async () => {
  const fetchImpl = solveRoute(() => errorResponse(401, 'Invalid API key'));
  const out = await handleSolve(api(fetchImpl, 'rfc_bad'), ARGS);
  assert.equal(out.isError, true);
  assert.match(textOf(out), /API key was refused/);
});

test('a 402 is a quota failure, described the way every other metered call describes it', async () => {
  const fetchImpl = solveRoute(() => errorResponse(402, 'Monthly allowance spent'));
  const out = await handleSolve(api(fetchImpl), ARGS);
  assert.equal(out.isError, true);
  assert.match(textOf(out), /allowance is spent/);
  assert.match(textOf(out), /5 runs\/month/);
});

test('a 400 names the field the service refused', async () => {
  const fetchImpl = solveRoute(() =>
    errorResponse(400, [{ param: 'range', reason: 'lies outside the stated bounds' }]),
  );
  const out = await handleSolve(api(fetchImpl), { ...ARGS, range: [-5, -1] });
  assert.equal(out.isError, true);
  assert.match(textOf(out), /range: lies outside the stated bounds/);
});

test('a 429 carries the retry-after the service sent', async () => {
  const fetchImpl = solveRoute(() => errorResponse(429, 'Too many requests', { 'Retry-After': '7' }));
  const out = await handleSolve(api(fetchImpl), ARGS);
  assert.equal(out.isError, true);
  assert.match(textOf(out), /Retry after 7 s/);
});

test('a 500 is a service fault', async () => {
  const fetchImpl = solveRoute(() => errorResponse(500, 'boom'));
  const out = await handleSolve(api(fetchImpl), ARGS);
  assert.equal(out.isError, true);
  assert.match(textOf(out), /service failed \(HTTP 500\)/);
});
