// File-input job types: inline content and local paths both reach the service
// as uploaded keys, and the bounds are checked before anything is sent.

import test from 'node:test';
import assert from 'node:assert/strict';

import { submitJob, checkFiles, MAX_INLINE_BYTES } from '../src/simulation-tools.ts';
import { fileSchemaFor } from '../src/job-schemas.ts';
import { makeTestDeps, scriptedFetch, jsonResponse } from './helpers.js';

/** Every call to the API itself must be under /v1/ — the routes live there. */
function assertVersionedPaths(fetchImpl) {
  const api = fetchImpl.apiCalls();
  assert.ok(api.length > 0, 'expected at least one API call');
  for (const call of api) {
    assert.ok(
      call.pathname.startsWith('/py/v1/'),
      `${call.method} ${call.pathname} is not under /v1/`,
    );
  }
}

const TOUCHSTONE = '# HZ S RI R 50\n1e9 0.1 0.0 0.9 0.0 0.9 0.0 0.1 0.0\n';

function uploadRoutes(extra = []) {
  let n = 0;
  return scriptedFetch([
    ['/v1/upload', () => {
      n += 1;
      return jsonResponse({
        uploadUrl: 'https://s3.test/bucket',
        key: `uploads/abc-${n}/file${n}.s4p`,
        fields: { key: `uploads/abc-${n}/file${n}.s4p`, policy: 'p', 'Content-Type': 'application/octet-stream' },
      });
    }],
    ['s3.test', () => new Response(null, { status: 204 })],
    ['/v1/jobs', () => jsonResponse({ jobId: 'job-1', status: 'queued', queuePosition: 1, queueTotal: 1 })],
    ...extra,
  ]);
}

test('inline file content is uploaded and the job body carries the key', async () => {
  const fetchImpl = uploadRoutes();
  const deps = makeTestDeps({ fetchImpl });

  const { submit } = await submitJob(deps, 'eye_diagram', { dataRate: 1e10 }, [
    { name: 'channel.s4p', content: TOUCHSTONE },
  ]);
  assert.equal(submit.jobId, 'job-1');

  // 1: the presigned ticket, 2: the S3 POST, 3: the job.
  const upload = fetchImpl.callsTo('/v1/upload')[0];
  assert.equal(upload.method, 'POST');
  assert.equal(upload.body.filename, 'channel.s4p');

  const s3 = fetchImpl.callsTo('s3.test')[0];
  assert.equal(s3.method, 'POST');
  assert.ok(s3.init.body instanceof FormData);
  assert.equal(s3.init.body.get('policy'), 'p');
  const sent = s3.init.body.get('file');
  assert.equal(await sent.text(), TOUCHSTONE);

  const job = fetchImpl.callsTo('/v1/jobs')[0];
  assert.deepEqual(job.body.inputFileKeys, ['uploads/abc-1/file1.s4p']);
  assert.equal(job.body.jobType, 'eye_diagram');
  assert.equal(job.body.params.dataRate, 1e10);

  assertVersionedPaths(fetchImpl);
  assert.equal(upload.pathname, '/py/v1/upload');
});

test('a local path is read from disk and uploaded the same way', async () => {
  const fetchImpl = uploadRoutes();
  const deps = makeTestDeps({ fetchImpl, files: { '/tmp/dut.s2p': TOUCHSTONE } });

  await submitJob(deps, 'sparam_pipeline', {}, undefined, ['/tmp/dut.s2p']);

  assert.equal(fetchImpl.callsTo('/v1/upload')[0].body.filename, 'dut.s2p');
  assert.deepEqual(fetchImpl.callsTo('/v1/jobs')[0].body.inputFileKeys, ['uploads/abc-1/file1.s4p']);
  assertVersionedPaths(fetchImpl);
});

test('every file of an rf_cascade stage list is uploaded', async () => {
  const fetchImpl = uploadRoutes();
  const deps = makeTestDeps({ fetchImpl });

  await submitJob(
    deps,
    'rf_cascade',
    { stages: '[{"name":"LNA","type":"amp","sparamFile":"lna.s2p"}]' },
    [
      { name: 'lna.s2p', content: TOUCHSTONE },
      { name: 'filter.s2p', content: TOUCHSTONE },
    ],
  );

  assert.equal(fetchImpl.callsTo('/v1/upload').length, 2);
  assert.deepEqual(fetchImpl.callsTo('/v1/jobs')[0].body.inputFileKeys, [
    'uploads/abc-1/file1.s4p',
    'uploads/abc-2/file2.s4p',
  ]);
  assertVersionedPaths(fetchImpl);
});

test('a file the contract does not accept is refused before any request', async () => {
  const fetchImpl = uploadRoutes();
  const deps = makeTestDeps({ fetchImpl });

  await assert.rejects(
    () => submitJob(deps, 'eye_diagram', {}, [{ name: 'notes.txt', content: 'hello' }]),
    (err) => {
      assert.match(err.message, /notes\.txt/);
      assert.match(err.message, /\.s2p/);
      return true;
    },
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('a job type that needs a file says so when none is given', async () => {
  const fetchImpl = uploadRoutes();
  const deps = makeTestDeps({ fetchImpl });
  await assert.rejects(
    () => submitJob(deps, 'eye_diagram', {}),
    (err) => {
      assert.match(err.message, /at least 1 file/);
      return true;
    },
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('more files than the contract allows is refused', () => {
  const spec = fileSchemaFor('sparam_pipeline');
  const five = Array.from({ length: 5 }, (_, i) => ({
    name: `f${i}.s2p`,
    bytes: new TextEncoder().encode(TOUCHSTONE),
  }));
  const problems = checkFiles(spec, five);
  assert.ok(problems.join('\n').includes('at most 4'), problems.join('\n'));
});

test('inline content beyond 5 MB in one call is refused', () => {
  const spec = fileSchemaFor('sparam_pipeline');
  const big = { name: 'big.s2p', bytes: new Uint8Array(MAX_INLINE_BYTES + 1) };
  const problems = checkFiles(spec, [big]);
  assert.ok(problems.join('\n').includes('5 MB'), problems.join('\n'));
});

test('a job type that takes no files refuses one', async () => {
  const fetchImpl = uploadRoutes();
  const deps = makeTestDeps({ fetchImpl });
  await assert.rejects(
    () => submitJob(deps, 'pdn_impedance', {}, [{ name: 'x.s2p', content: TOUCHSTONE }]),
    /takes no file input/,
  );
  assert.equal(fetchImpl.calls.length, 0);
});
