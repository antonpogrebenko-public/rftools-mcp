// A file-input job needs a key, and the server says so before it asks.
//
// The service refuses an anonymous upload. Letting that refusal arrive as a
// bare 401 costs a round trip and tells the agent nothing it can act on — an
// agent reading "auth" with no other information retries the same call with
// the same empty header. So the refusal is made here, in one sentence naming
// the variable the host has to set, before a byte is read off this machine.

import test from 'node:test';
import assert from 'node:assert/strict';

import { submitJob, handleListTools, runAndWait } from '../src/simulation-tools.ts';
import { RftoolsApi, UPLOAD_NEEDS_KEY } from '../src/api.ts';
import {
  makeTestDeps, scriptedFetch, jsonResponse, connectedServer, jsonOf,
} from './helpers.js';

const TOUCHSTONE = '# HZ S RI R 50\n1e9 0.1 0.0 0.9 0.0 0.9 0.0 0.1 0.0\n';

/** A fetch that answers everything, so a call that is made is a failed test. */
function everything() {
  return scriptedFetch([
    ['/v1/upload', () => jsonResponse({
      uploadUrl: 'https://s3.test/bucket', key: 'uploads/a/f.s4p', fields: {},
    })],
    ['s3.test', () => new Response(null, { status: 204 })],
    ['/v1/jobs', () => jsonResponse({ jobId: 'job-1', status: 'queued' })],
  ]);
}

test('the sentence names the variable the host has to set', () => {
  assert.match(UPLOAD_NEEDS_KEY, /RFTOOLS_API_KEY/);
});

test('inline content without a key is refused before any request', async () => {
  const fetchImpl = everything();
  const deps = makeTestDeps({ fetchImpl, apiKey: '' });

  await assert.rejects(
    () => submitJob(deps, 'eye_diagram', { dataRate: 1e10 }, [
      { name: 'channel.s4p', content: TOUCHSTONE },
    ]),
    (err) => {
      assert.equal(err.kind, 'auth');
      assert.equal(err.message, UPLOAD_NEEDS_KEY);
      return true;
    },
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('a local path without a key is refused before the file is read', async () => {
  const fetchImpl = everything();
  // The deps know the file; reading it would succeed. The refusal is earlier.
  const deps = makeTestDeps({
    fetchImpl, apiKey: '', files: { '/tmp/dut.s2p': TOUCHSTONE },
  });

  await assert.rejects(
    () => submitJob(deps, 'sparam_pipeline', {}, undefined, ['/tmp/dut.s2p']),
    (err) => {
      assert.equal(err.kind, 'auth');
      assert.equal(err.message, UPLOAD_NEEDS_KEY);
      return true;
    },
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('the client itself refuses an upload with no key', async () => {
  // Not only the tool path: anything reaching for `uploadFile` gets the same
  // answer, so a future caller cannot route around the check.
  const fetchImpl = everything();
  const api = new RftoolsApi({ baseUrl: 'https://api.test/py', apiKey: '', fetchImpl });

  await assert.rejects(
    () => api.uploadFile('channel.s4p', TOUCHSTONE),
    (err) => {
      assert.equal(err.kind, 'auth');
      assert.equal(err.message, UPLOAD_NEEDS_KEY);
      return true;
    },
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('a job that takes no file still runs without a key', async () => {
  // The refusal is about uploads, not about keys in general: the free lane is
  // still open to everything that needs no file.
  const fetchImpl = scriptedFetch([
    [(url, init) => url.endsWith('/v1/jobs') && init?.method === 'POST', () =>
      jsonResponse({ jobId: 'free-1', status: 'queued' })],
    ['/v1/jobs/free-1', () => jsonResponse({
      jobId: 'free-1', jobType: 'pdn_impedance', status: 'completed',
      resultUrl: 'https://r.test/free-1',
    })],
    ['r.test', () => jsonResponse({ summary: { zMax_mohm: 30 } })],
  ]);
  const deps = makeTestDeps({ fetchImpl, apiKey: '' });

  const out = await runAndWait(deps, 'pdn_impedance', { boardWidth_mm: 100 }, { waitSeconds: 30 });
  assert.notEqual(out.isError, true);
});

test('with a key the upload path is unchanged', async () => {
  const fetchImpl = everything();
  const deps = makeTestDeps({ fetchImpl, apiKey: 'rfc_test' });

  const { submit } = await submitJob(deps, 'eye_diagram', { dataRate: 1e10 }, [
    { name: 'channel.s4p', content: TOUCHSTONE },
  ]);
  assert.equal(submit.jobId, 'job-1');
  assert.equal(fetchImpl.callsTo('/v1/upload').length, 1);
});

test('the tool listing says file tools need a key', () => {
  const listing = jsonOf(handleListTools());
  assert.equal(listing.fileToolsNeedKey, UPLOAD_NEEDS_KEY);
  assert.match(listing.keyless, /RFTOOLS_API_KEY/);
  // The old sentence read as though a key changed only the lane.
  assert.match(listing.keyless, /takes no file/);
});

test('the listed tool descriptions carry it too', async () => {
  const { client, close } = await connectedServer();
  try {
    const { tools } = await client.listTools();
    const listTool = tools.find((t) => t.name === 'list_simulation_tools');
    assert.ok(listTool.description.includes(UPLOAD_NEEDS_KEY), listTool.description);

    // A per-job tool with a file parameter says it where the parameter is
    // described, which is where an agent chooses its arguments.
    const withFiles = tools.filter((t) => t.inputSchema?.properties?.inputFiles);
    assert.ok(withFiles.length > 0, 'expected at least one file-input tool');
    for (const t of withFiles) {
      const described = JSON.stringify(t.inputSchema.properties.inputFiles);
      assert.ok(described.includes('RFTOOLS_API_KEY'), `${t.name}: ${described}`);
    }
  } finally {
    await close();
  }
});

test('a file-input tool called through the host refuses with the sentence', async () => {
  const fetchImpl = everything();
  const { client, close } = await connectedServer({
    api: new RftoolsApi({ baseUrl: 'https://api.test/py', apiKey: '', fetchImpl }),
  });
  try {
    const out = await client.callTool({
      name: 'simulate_eye_diagram',
      arguments: {
        dataRate: 1e10,
        inputFiles: [{ name: 'channel.s4p', content: TOUCHSTONE }],
        waitSeconds: 0,
      },
    });
    assert.equal(out.isError, true);
    assert.match(out.content[0].text, /RFTOOLS_API_KEY/);
    assert.equal(fetchImpl.calls.length, 0);
  } finally {
    await close();
  }
});
