// Test scaffolding: a scripted fetch, a controllable clock, and an in-memory
// MCP client so a test can call the tools the way a host does.
//
// Every network interaction in these tests goes through the scripted fetch.
// Nothing here reaches rftools.io.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RftoolsApi } from '../src/api.ts';
import { registerSimulationTools } from '../src/simulation-tools.ts';

/**
 * The base the tests point the client at. It carries a path prefix, as the
 * live one does (`https://rftools.io/api/py`), so a route that forgets to
 * spell `/v1` cannot accidentally match.
 */
export const API_HOST = 'api.test';
export const API_BASE_PATH = '/py';
export const API_BASE_URL = `https://${API_HOST}${API_BASE_PATH}`;

/**
 * A fetch built from routes. Each route is [matcher, responder]; the first
 * matching route answers. Every call is recorded on `.calls`.
 *
 * A string matcher starting with "/" matches the request's **whole pathname**,
 * not a fragment of the URL: a route registered as "/upload" does not answer a
 * request to "/v1/upload", so a wrong path fails the test instead of passing
 * it. Any other string matches the host exactly (for the S3 and result URLs).
 * A function matcher receives (url, init).
 */
export function scriptedFetch(routes, basePath = API_BASE_PATH) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const parsed = new URL(url);
    calls.push({
      url,
      pathname: parsed.pathname,
      host: parsed.host,
      init,
      method: init.method ?? 'GET',
      body: parseBody(init.body),
    });
    for (const [match, respond] of routes) {
      const hit =
        typeof match === 'string'
          ? match.startsWith('/')
            ? parsed.pathname === basePath + match
            : parsed.host === match
          : match(url, init);
      if (hit) {
        const out = await respond(url, init, calls.length);
        return out instanceof Response ? out : jsonResponse(out);
      }
    }
    throw new Error(`no route for ${init.method ?? 'GET'} ${url} (pathname ${parsed.pathname})`);
  };
  impl.calls = calls;
  /** Calls whose path (after the base) starts with this prefix, or that went to this host. */
  impl.callsTo = (prefix) =>
    calls.filter((c) => (prefix.startsWith('/') ? c.pathname.startsWith(basePath + prefix) : c.host === prefix));
  /** Every call to the API itself, as opposed to S3 or a result link. */
  impl.apiCalls = () => calls.filter((c) => c.host === API_HOST);
  return impl;
}

function parseBody(body) {
  if (body == null) return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

export function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

export function errorResponse(status, detail, headers = {}) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** A clock a test drives: sleeping advances it, nothing waits in real time. */
export function fakeClock(start = 1_000_000) {
  let t = start;
  const sleeps = [];
  return {
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    advance: (ms) => {
      t += ms;
    },
    sleeps,
  };
}

/** The deps a handler takes, wired to a scripted fetch and a fake clock. */
export function makeTestDeps({ fetchImpl, apiKey = 'rfc_test', clock = fakeClock(), files = {}, waitMax = 600 } = {}) {
  const api = new RftoolsApi({ baseUrl: API_BASE_URL, apiKey, fetchImpl });
  return {
    api,
    sleep: clock.sleep,
    now: clock.now,
    readLocalFile: async (p) => {
      if (!(p in files)) throw new Error(`no such file: ${p}`);
      const content = files[p];
      return {
        name: p.split('/').pop(),
        bytes: typeof content === 'string' ? new TextEncoder().encode(content) : content,
      };
    },
    waitDefaultSeconds: 90,
    waitMaxSeconds: waitMax,
    pollIntervalMs: 1000,
    clock,
  };
}

/** A server with the simulation tools registered, and a client connected to it. */
export async function connectedServer(options = {}) {
  const server = new McpServer({ name: 'rftools-test', version: '0.0.0' });
  const names = registerSimulationTools(server, options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    server,
    client,
    names,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

/** The text a tool returned, and whether it was an error. */
export function textOf(result) {
  return result.content.map((c) => c.text).join('\n');
}

/** The JSON object a tool returned, ignoring any note line before it. */
export function jsonOf(result) {
  const text = textOf(result);
  const start = text.indexOf('{');
  return JSON.parse(text.slice(start));
}
