// The simulation surface: one typed tool per job type, the three lifecycle
// tools, and the bounded convenience call.
//
// Everything a caller sees — the tool names, the parameters, the counts, the
// tier bounds, the time budgets — is derived from shared/job-schemas, and what
// each simulate_* tool answers, returns and takes as an example comes from
// shared/mcp/agent-copy.json, generated from the tools registry (openspec
// agent-surface, design D2). Nothing about a job type is described in prose
// here.

import { readFile as readFileFs } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ApiError,
  RftoolsApi,
  UPLOAD_NEEDS_KEY,
  describeApiError,
  describeJobError,
  type JobStatusResponse,
} from './api.ts';
import {
  JOB_INDEX,
  JOB_SCHEMAS,
  JOB_TYPES,
  fileSchemaFor,
  listJobTypes,
  toolNameForJobType,
  webUrlFor,
  type JobFileSchema,
} from './job-schemas.ts';
import { shapeForJob, strictObject, validateParams } from './json-schema-to-zod.ts';
import { summariseResult } from './summarize.ts';
import { READS, SPENDS_ALLOWANCE, annotate, composeDescription } from './tool-copy.ts';
// Read from vendor/, as the job schemas are (see src/job-schemas.ts):
// scripts/vendor_shared.sh copies it from ../shared/mcp/.
import agentCopyJson from '../vendor/shared/mcp/agent-copy.json' with { type: 'json' };

/** What the tools registry says about one job type, for its simulate_* description. */
export interface AgentCopy {
  slug: string;
  title: string;
  question: string;
  description: string;
  returns: string;
  example: { source: 'preset' | 'defaults'; label?: string; arguments: Record<string, unknown> };
}

export const AGENT_COPY: Record<string, AgentCopy> =
  (agentCopyJson as unknown as { jobTypes: Record<string, AgentCopy> }).jobTypes;

/** Default and maximum bound on a waiting call, in seconds. */
export const WAIT_DEFAULT_SECONDS = 90;
export const WAIT_MAX_SECONDS = 600;

/** How much inline file content a single call may carry. */
export const MAX_INLINE_BYTES = 5 * 1024 * 1024;
/** What the service accepts for one file. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** The allowance a caller has, in the words the service uses. */
export const TIER_LIMITS = 'Free tier: 5 runs/month. Pro: 100/month. API tier: 10 000/month.';

/** A presigned result link lives this long; the status call mints a fresh one. */
export const RESULT_URL_LIFETIME = '15 minutes';

/** Identical submissions inside this window return the first job. */
export const DEDUP_WINDOW_SECONDS = 60;

/** What a caller without a key can do, in the words list_simulation_tools and the manifest use. */
export const KEYLESS_STATEMENT =
  'Without RFTOOLS_API_KEY a job still runs, on the free lane — but only '
  + 'a job that takes no file. ' + UPLOAD_NEEDS_KEY;

/** What every simulate_* result carries besides its own values. */
const RESULT_TAIL =
  'Also warnings, provenance and the result page link; series are described, not listed (full: true returns '
  + 'everything). If waitSeconds runs out first: the jobId and progress, and the job keeps running.';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

/** Argument names the tool layer owns; no job parameter may take one. */
export const RESERVED_ARG_NAMES = ['waitSeconds', 'full', 'inputFiles', 'inputPaths'] as const;

export interface SimulationDeps {
  api: RftoolsApi;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  readLocalFile: (p: string) => Promise<{ name: string; bytes: Uint8Array }>;
  waitDefaultSeconds: number;
  waitMaxSeconds: number;
  /** Fixed poll interval, for tests; live callers get the schedule below. */
  pollIntervalMs?: number;
}

export interface SimulationOptions extends Partial<SimulationDeps> {
  api?: RftoolsApi;
  /** Used only when no `api` is given: how to build one. */
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: ConstructorParameters<typeof RftoolsApi>[0] extends { fetchImpl?: infer F } ? F : never;
}

export function makeDeps(opts: SimulationOptions = {}): SimulationDeps {
  return {
    api: opts.api ?? new RftoolsApi({ apiKey: opts.apiKey, baseUrl: opts.baseUrl, fetchImpl: opts.fetchImpl }),
    sleep: opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))),
    now: opts.now ?? (() => Date.now()),
    readLocalFile:
      opts.readLocalFile ??
      (async (p: string) => ({ name: path.basename(p), bytes: new Uint8Array(await readFileFs(p)) })),
    waitDefaultSeconds: opts.waitDefaultSeconds ?? WAIT_DEFAULT_SECONDS,
    waitMaxSeconds: opts.waitMaxSeconds ?? WAIT_MAX_SECONDS,
    pollIntervalMs: opts.pollIntervalMs,
  };
}

// ── Output helpers ─────────────────────────────────────────────────────────

export interface ToolText {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/** Compact JSON: an agent pays for every space. */
function json(value: unknown): string {
  return JSON.stringify(value);
}

function ok(value: unknown, note?: string): ToolText {
  const text = note ? `${note}\n${json(value)}` : json(value);
  return { content: [{ type: 'text' as const, text }] };
}

function fail(message: string): ToolText {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

/** What a caller without a key needs told, once, on the response. */
export function freeLaneNote(jobType?: string): string {
  const parts = [
    'No RFTOOLS_API_KEY is set, so this ran on the free lane (no account needed).',
    TIER_LIMITS,
  ];
  if (jobType) {
    const bounds = freeLaneBounds(jobType);
    if (bounds.length) parts.push(`On the free lane this job type is bounded: ${bounds.join('; ')}.`);
  }
  parts.push('A key raises the limits: https://rftools.io/dashboard');
  return parts.join(' ');
}

/** The free-lane bounds this job type's contract states, from x-tier and x-paidOnly. */
export function freeLaneBounds(jobType: string): string[] {
  const schema = JOB_SCHEMAS[jobType];
  if (!schema) return [];
  const bounds: string[] = [];
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
    const free = prop['x-tier']?.free;
    if (free) {
      const bits: string[] = [];
      if (free.minimum !== undefined) bits.push(`min ${free.minimum}`);
      if (free.maximum !== undefined) bits.push(`max ${free.maximum}`);
      if (bits.length) bounds.push(`${name} ${bits.join(', ')}`);
    }
    if (prop['x-paidOnly']?.length) {
      bounds.push(`${name} cannot be ${prop['x-paidOnly'].join(' or ')} without a paid key`);
    }
  }
  return bounds;
}

// ── File inputs ────────────────────────────────────────────────────────────

export interface InlineFile {
  name: string;
  content: string;
}

export interface PreparedFile {
  name: string;
  bytes: Uint8Array;
}

/** Check the files a call carries against the job type's file contract. */
export function checkFiles(spec: JobFileSchema, files: PreparedFile[]): string[] {
  const problems: string[] = [];
  if (files.length < spec.min) {
    problems.push(
      `this job type needs at least ${spec.min} file${spec.min === 1 ? '' : 's'} ` +
        `(${spec.extensions.join(', ')}); pass inputFiles: [{name, content}] or inputPaths: ["/path/to/file"]`,
    );
  }
  if (files.length > spec.max) {
    problems.push(`this job type takes at most ${spec.max} file${spec.max === 1 ? '' : 's'}, ${files.length} were given`);
  }
  let total = 0;
  for (const f of files) {
    const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')).toLowerCase() : '';
    if (!spec.extensions.includes(ext)) {
      problems.push(`"${f.name}" has extension "${ext || '(none)'}"; accepted: ${spec.extensions.join(', ')}`);
    }
    if (f.bytes.byteLength > MAX_FILE_BYTES) {
      problems.push(`"${f.name}" is ${Math.round(f.bytes.byteLength / 1024)} kB; the service accepts at most 10 MB per file`);
    }
    total += f.bytes.byteLength;
  }
  if (total > MAX_INLINE_BYTES) {
    problems.push(
      `the call carries ${Math.round(total / 1024)} kB of file content; at most ${MAX_INLINE_BYTES / (1024 * 1024)} MB may travel in one call`,
    );
  }
  return problems;
}

/** Read whatever the caller gave us into bytes, inline content first, then paths. */
export async function gatherFiles(
  deps: SimulationDeps,
  inputFiles: InlineFile[] | undefined,
  inputPaths: string[] | undefined,
): Promise<PreparedFile[]> {
  const files: PreparedFile[] = [];
  for (const f of inputFiles ?? []) {
    files.push({ name: path.basename(f.name), bytes: new TextEncoder().encode(f.content) });
  }
  for (const p of inputPaths ?? []) {
    files.push(await deps.readLocalFile(p));
  }
  return files;
}

// ── Polling ────────────────────────────────────────────────────────────────

/** 2 s while the job is fresh, 5 s to two minutes, 10 s after that. */
export function pollIntervalMs(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 2_000;
  if (elapsedMs < 120_000) return 5_000;
  return 10_000;
}

export interface ProgressReport {
  progress?: number;
  status: string;
  stage?: string;
  queuePosition?: number;
  queueTotal?: number;
  elapsedSeconds: number;
}

export interface WaitOutcome {
  status: JobStatusResponse;
  timedOut: boolean;
}

/**
 * Poll a job until it ends or the bound is reached. The first poll happens
 * immediately, so a job that finishes in under a second costs no wait.
 *
 * Polling stops for good on any 4xx — a job that is gone or not ours will not
 * appear — and after five failures in a row that are not 4xx.
 */
export async function waitForJob(
  deps: SimulationDeps,
  jobId: string,
  waitSeconds: number,
  onProgress?: (r: ProgressReport) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<WaitOutcome> {
  const started = deps.now();
  const deadline = started + waitSeconds * 1000;
  let failures = 0;
  let last: JobStatusResponse = { status: 'unknown' };

  for (;;) {
    let status: JobStatusResponse;
    try {
      status = await deps.api.jobStatus(jobId);
      failures = 0;
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) throw err;
      failures += 1;
      if (failures >= 5) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new ApiError(0, 'transient', `five status checks in a row failed (${detail})`);
      }
      const elapsed = deps.now() - started;
      if (deps.now() >= deadline || signal?.aborted) return { status: last, timedOut: true };
      await deps.sleep(deps.pollIntervalMs ?? pollIntervalMs(elapsed));
      continue;
    }

    last = status;
    const elapsed = deps.now() - started;
    if (onProgress) {
      await onProgress({
        progress: status.progress,
        status: status.status,
        stage: status.stage,
        queuePosition: status.queuePosition,
        queueTotal: status.queueTotal,
        elapsedSeconds: Math.round(elapsed / 1000),
      });
    }

    if (TERMINAL.has(status.status)) return { status, timedOut: false };
    if (deps.now() >= deadline || signal?.aborted) return { status, timedOut: true };
    await deps.sleep(deps.pollIntervalMs ?? pollIntervalMs(elapsed));
  }
}

// ── Result shaping ─────────────────────────────────────────────────────────

export interface ResultShapeOptions {
  full?: boolean;
}

/** The object a caller receives for a finished job. */
export function shapeResult(
  jobType: string,
  jobId: string,
  status: JobStatusResponse,
  payload: unknown,
  opts: ResultShapeOptions = {},
): Record<string, unknown> {
  const head: Record<string, unknown> = {
    jobId,
    jobType,
    tool: JOB_INDEX[jobType]?.title ?? jobType,
    status: status.status,
    webUrl: webUrlFor(jobType, jobId),
  };
  if (status.resultUrl) head.resultUrl = status.resultUrl;
  if (status.resultUrlExpiresIn !== undefined) head.resultUrlExpiresIn = status.resultUrlExpiresIn;
  if (status.resultExpiresAt) head.resultExpiresAt = status.resultExpiresAt;
  if (status.finishedAt) head.finishedAt = status.finishedAt;

  if (opts.full) return { ...head, full: true, result: payload };

  const { value, elided, truncated } = summariseResult(payload);
  return {
    ...head,
    summarised: true,
    ...(elided ? { elided: true } : {}),
    ...(truncated ? { truncated: true } : {}),
    hint: 'Series are described, not listed; provenance is complete. Ask again with full: true for the whole payload.',
    result: value,
  };
}

// ── Handlers ───────────────────────────────────────────────────────────────

function unknownJobType(jobType: string): ToolText {
  return fail(`Unknown jobType "${jobType}". The ${JOB_TYPES.length} job types are: ${JOB_TYPES.join(', ')}.`);
}

/** Submit a job: validate locally, upload any files, then POST /v1/jobs. */
export async function submitJob(
  deps: SimulationDeps,
  jobType: string,
  params: Record<string, unknown>,
  inputFiles?: InlineFile[],
  inputPaths?: string[],
): Promise<{ jobId: string; submit: { jobId: string; status: string; queuePosition?: number; queueTotal?: number }; keys: string[] }> {
  const schema = JOB_SCHEMAS[jobType];
  const checked = validateParams(schema, params);
  if (!checked.ok) {
    throw new ApiError(0, 'invalid_request', checked.problems.map((p) => `- ${p}`).join('\n'));
  }

  const spec = fileSchemaFor(jobType);
  // A call that carries files needs a key, and saying so here means saying it
  // before anything is read off this machine and before a byte leaves it.
  const bringsFiles = Boolean(inputFiles?.length) || Boolean(inputPaths?.length);
  if (bringsFiles && !deps.api.hasKey) {
    throw new ApiError(0, 'auth', UPLOAD_NEEDS_KEY);
  }
  const files = await gatherFiles(deps, inputFiles, inputPaths);
  if (!spec && files.length > 0) {
    throw new ApiError(0, 'invalid_request', `${jobType} takes no file input`);
  }
  if (spec) {
    const problems = checkFiles(spec, files);
    if (problems.length) throw new ApiError(0, 'invalid_request', problems.map((p) => `- ${p}`).join('\n'));
  }

  const keys: string[] = [];
  for (const f of files) {
    keys.push(await deps.api.uploadFile(f.name, f.bytes));
  }

  const submit = await deps.api.submitJob(jobType, checked.value, keys);
  return { jobId: submit.jobId, submit, keys };
}

/** Fetch a completed job's payload, or say plainly why there is none. */
async function payloadFor(deps: SimulationDeps, jobType: string, jobId: string, status: JobStatusResponse): Promise<unknown> {
  if (!status.resultUrl) {
    // Completed with nothing to fetch: the service says why, or we say what we know.
    throw new ApiError(
      0,
      'not_found',
      status.errorKind
        ? describeJobError(status.errorKind, status.errorMessage)
        : `job ${jobId} is completed but carries no result link. Results are kept behind a link that lives ${RESULT_URL_LIFETIME}; ` +
          `open ${webUrlFor(jobType, jobId)} or resubmit the job.`,
    );
  }
  return await deps.api.fetchResult(status.resultUrl);
}

/** The bounded wait shared by the per-job tools and run_simulation. */
export async function runAndWait(
  deps: SimulationDeps,
  jobType: string,
  params: Record<string, unknown>,
  opts: {
    waitSeconds: number;
    full?: boolean;
    inputFiles?: InlineFile[];
    inputPaths?: string[];
    onProgress?: (r: ProgressReport) => void | Promise<void>;
    signal?: AbortSignal;
  },
): Promise<ToolText> {
  if (!JOB_SCHEMAS[jobType]) return unknownJobType(jobType);
  const note = deps.api.hasKey ? undefined : freeLaneNote(jobType);

  let jobId: string;
  let submit: { jobId: string; status: string; queuePosition?: number; queueTotal?: number };
  try {
    ({ jobId, submit } = await submitJob(deps, jobType, params, opts.inputFiles, opts.inputPaths));
  } catch (err) {
    return fail(errorText(err));
  }

  const waitSeconds = Math.max(0, Math.min(opts.waitSeconds, deps.waitMaxSeconds));
  if (waitSeconds === 0) {
    return ok(submitted(jobType, submit), note);
  }

  let outcome: WaitOutcome;
  try {
    outcome = await waitForJob(deps, jobId, waitSeconds, opts.onProgress, opts.signal);
  } catch (err) {
    return fail(`${errorText(err)}\nThe job may still be running. Job id: ${jobId}`);
  }

  const status = outcome.status;

  if (outcome.timedOut) {
    return ok(
      {
        jobId,
        jobType,
        status: status.status,
        progress: status.progress ?? null,
        stage: status.stage ?? null,
        queuePosition: status.queuePosition ?? null,
        queueTotal: status.queueTotal ?? null,
        waitedSeconds: waitSeconds,
        webUrl: webUrlFor(jobType, jobId),
        note: `Still running after ${waitSeconds} s — the job continues. Call get_simulation_status or get_simulation_result with this jobId.`,
      },
      note,
    );
  }

  if (status.status === 'failed' || status.status === 'cancelled') {
    return fail(`${describeJobError(status.errorKind, status.errorMessage)}\nJob id: ${jobId}\n${webUrlFor(jobType, jobId)}`);
  }

  let payload: unknown;
  try {
    payload = await payloadFor(deps, jobType, jobId, status);
  } catch (err) {
    return fail(errorText(err));
  }
  return ok(shapeResult(jobType, jobId, status, payload, { full: opts.full }), note);
}

function submitted(
  jobType: string,
  submit: { jobId: string; status: string; queuePosition?: number; queueTotal?: number },
): Record<string, unknown> {
  const entry = JOB_INDEX[jobType];
  return {
    jobId: submit.jobId,
    jobType,
    tool: entry?.title ?? jobType,
    status: submit.status,
    queuePosition: submit.queuePosition ?? null,
    queueTotal: submit.queueTotal ?? null,
    timeBudgetSeconds: entry?.timeoutSeconds ?? null,
    suggestedWaitSeconds: Math.min(entry?.timeoutSeconds ?? WAIT_MAX_SECONDS, WAIT_MAX_SECONDS),
    webUrl: webUrlFor(jobType, submit.jobId),
    note:
      `An identical submission inside ${DEDUP_WINDOW_SECONDS} s returns this same job. ` +
      'Poll with get_simulation_status, then get_simulation_result.',
  };
}

/** Whatever went wrong, in one readable piece. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) return describeApiError(err);
  return err instanceof Error ? err.message : String(err);
}

export async function handleStatus(deps: SimulationDeps, jobId: string): Promise<ToolText> {
  let status: JobStatusResponse;
  try {
    status = await deps.api.jobStatus(jobId);
  } catch (err) {
    return fail(errorText(err));
  }
  const jobType = status.jobType ?? '';
  const body: Record<string, unknown> = {
    jobId,
    jobType: jobType || null,
    status: status.status,
    progress: status.progress ?? null,
    stage: status.stage ?? null,
    queuePosition: status.queuePosition ?? null,
    queueTotal: status.queueTotal ?? null,
    startedAt: status.startedAt ?? null,
    finishedAt: status.finishedAt ?? null,
    resultReady: Boolean(status.resultUrl),
    expiresAt: status.expiresAt ?? null,
  };
  if (status.resultExpiresAt) body.resultExpiresAt = status.resultExpiresAt;
  if (jobType) body.webUrl = webUrlFor(jobType, jobId);
  if (status.status === 'failed' || status.status === 'cancelled') {
    body.error = describeJobError(status.errorKind, status.errorMessage);
    body.errorKind = status.errorKind ?? null;
  }
  return ok(body);
}

export async function handleResult(deps: SimulationDeps, jobId: string, full: boolean): Promise<ToolText> {
  let status: JobStatusResponse;
  try {
    status = await deps.api.jobStatus(jobId);
  } catch (err) {
    return fail(errorText(err));
  }

  const jobType = status.jobType ?? '';

  if (status.status === 'failed' || status.status === 'cancelled') {
    return fail(`${describeJobError(status.errorKind, status.errorMessage)}\nJob id: ${jobId}`);
  }
  if (status.status !== 'completed') {
    return ok({
      jobId,
      jobType: jobType || null,
      status: status.status,
      progress: status.progress ?? null,
      stage: status.stage ?? null,
      queuePosition: status.queuePosition ?? null,
      note: 'The job has not finished. Ask again, or use run_simulation to wait for it.',
    });
  }

  let payload: unknown;
  try {
    payload = await payloadFor(deps, jobType, jobId, status);
  } catch (err) {
    return fail(errorText(err));
  }
  return ok(shapeResult(jobType, jobId, status, payload, { full }));
}

/** Every job type the contract carries, with its tool name and file rules. */
export function handleListTools(): ToolText {
  return ok({
    count: JOB_TYPES.length,
    tiers: TIER_LIMITS,
    keyless: KEYLESS_STATEMENT,
    fileToolsNeedKey: UPLOAD_NEEDS_KEY,
    resultLifetime: `A result link lives ${RESULT_URL_LIFETIME}; ask for the status again for a fresh one.`,
    dedupWindowSeconds: DEDUP_WINDOW_SECONDS,
    tools: listJobTypes().map((t) => ({
      tool: t.toolName,
      jobType: t.jobType,
      title: t.title,
      params: t.params,
      timeBudgetSeconds: t.timeoutSeconds,
      files: t.files
        ? { min: t.files.min, max: t.files.max, extensions: t.files.extensions }
        : null,
      freeLaneBounds: freeLaneBounds(t.jobType),
    })),
  });
}

// ── Registration ───────────────────────────────────────────────────────────

const inlineFileSchema = z.object({
  name: z.string().describe('File name including its extension, e.g. "channel.s4p"'),
  content: z.string().describe('The file\'s text content'),
});

function fileFieldsFor(spec: JobFileSchema): Record<string, z.ZodTypeAny> {
  const what = `${spec.min === 0 ? 'Optional. ' : ''}${spec.min}–${spec.max} file(s), ${spec.extensions.join(', ')}. ${UPLOAD_NEEDS_KEY}`;
  return {
    inputFiles: z
      .array(inlineFileSchema)
      .optional()
      .describe(`${what} Inline content; at most 5 MB in one call. The server uploads them and passes the keys.`),
    inputPaths: z
      .array(z.string())
      .optional()
      .describe(`${what} Paths on this machine, read by the server and uploaded.`),
  };
}

/** The wait controls every simulate_* tool carries. */
function waitFields(deps: SimulationDeps): Record<string, z.ZodTypeAny> {
  return {
    waitSeconds: z
      .number()
      .min(0)
      .max(deps.waitMaxSeconds)
      .default(deps.waitDefaultSeconds)
      .describe(
        `How long to wait for the result before returning the job id (0 = submit and return at once, max ${deps.waitMaxSeconds}).`,
      ),
    full: z
      .boolean()
      .default(false)
      .describe('Return the whole result payload instead of the summary. Large.'),
  };
}

/** The example call a simulate_* description shows: the registry's, plus a file when one is required. */
export function exampleArgumentsFor(jobType: string): Record<string, unknown> {
  const copy = AGENT_COPY[jobType];
  if (!copy) throw new Error(`agent-copy.json has no entry for ${jobType}; regenerate it with scripts/sync_job_schemas.ts`);
  const args: Record<string, unknown> = { ...copy.example.arguments };
  const spec = JOB_SCHEMAS[jobType]['x-files'];
  if (spec && spec.min > 0) args.inputPaths = [`/path/to/file${spec.extensions[0]}`];
  return args;
}

/**
 * The description an agent reads when it lists a per-job tool: the registry's
 * question, example and returns (agent-copy.json), around what the contract
 * itself says — files, free-lane bounds, checks and the time budget.
 */
export function toolDescriptionFor(jobType: string): string {
  const entry = JOB_INDEX[jobType];
  const schema = JOB_SCHEMAS[jobType];
  const copy = AGENT_COPY[jobType];
  if (!copy) throw new Error(`agent-copy.json has no entry for ${jobType}; regenerate it with scripts/sync_job_schemas.ts`);

  const inputs = ["Units, ranges and defaults are in each parameter's schema; one left out takes its default."];
  const spec = schema['x-files'];
  if (spec) {
    inputs.push(
      `Takes ${spec.min === 0 ? 'up to' : `${spec.min} to`} ${spec.max} ${spec.extensions.join('/')} file(s) ` +
        `via inputFiles (inline) or inputPaths (local paths); the server uploads them. ${UPLOAD_NEEDS_KEY}`,
    );
  }
  const bounds = freeLaneBounds(jobType);
  if (bounds.length) inputs.push(`Free lane: ${bounds.join('; ')}.`);
  if (schema['x-checks']?.length) inputs.push(`Cross-parameter checks: ${schema['x-checks'].join(', ')}.`);
  inputs.push(
    `Time budget ${entry.timeoutSeconds} s; waitSeconds (default ${WAIT_DEFAULT_SECONDS}, max ${WAIT_MAX_SECONDS}) ` +
      'bounds the wait.',
  );

  const example = exampleArgumentsFor(jobType);
  return composeDescription({
    question: copy.question,
    inputs: inputs.join(' '),
    example: copy.example.source === 'preset' && copy.example.label
      ? `${JSON.stringify(example)} (the "${copy.example.label}" preset)`
      : example,
    returns: `${copy.returns} ${RESULT_TAIL}`,
    notes: 'Runs as a job on rftools.io and counts against the monthly run allowance (free lane without a key).',
  });
}

/** A progress reporter bound to the request, when the caller sent a token. */
function progressReporter(
  extra: { _meta?: { progressToken?: string | number }; sendNotification?: (n: unknown) => Promise<void> } | undefined,
  waitSeconds: number,
): ((r: ProgressReport) => Promise<void>) | undefined {
  const token = extra?._meta?.progressToken;
  if (token === undefined || token === null || !extra?.sendNotification) return undefined;
  return async (r: ProgressReport) => {
    const queue = r.queuePosition != null ? ` (queue ${r.queuePosition}/${r.queueTotal ?? '?'})` : '';
    const stage = r.stage ? ` — ${r.stage}` : '';
    try {
      await extra.sendNotification!({
        method: 'notifications/progress',
        params: {
          progressToken: token,
          progress: r.progress != null ? r.progress : Math.min(r.elapsedSeconds / Math.max(waitSeconds, 1), 0.99),
          total: 1,
          message: `${r.status}${stage}${queue} — ${r.elapsedSeconds}s`,
        },
      });
    } catch {
      // A host that will not take progress must not fail the job.
    }
  };
}

type ExtraLike = {
  _meta?: { progressToken?: string | number };
  sendNotification?: (n: unknown) => Promise<void>;
  signal?: AbortSignal;
};

/**
 * Register every simulation tool on a server. Returns the names registered, so
 * a caller (and a test) can see exactly what the contract produced.
 */
export function registerSimulationTools(server: McpServer, options: SimulationOptions = {}): string[] {
  const deps = makeDeps(options);
  const names: string[] = [];

  for (const jobType of JOB_TYPES) {
    const schema = JOB_SCHEMAS[jobType];
    const spec = schema['x-files'];
    // The tool's own controls share the argument object with the job's
    // parameters, so a contract that grew one of these names would be
    // silently swallowed. Refuse to start instead.
    for (const reserved of RESERVED_ARG_NAMES) {
      if (reserved in schema.properties) {
        throw new Error(`${jobType} has a parameter named "${reserved}", which the tool layer reserves`);
      }
    }
    const shape: Record<string, z.ZodTypeAny> = {
      ...shapeForJob(schema),
      ...(spec ? fileFieldsFor(spec) : {}),
      ...waitFields(deps),
    };
    const name = toolNameForJobType(jobType);
    names.push(name);

    server.registerTool(
      name,
      {
        title: JOB_INDEX[jobType].title,
        description: toolDescriptionFor(jobType),
        inputSchema: strictObject(shape, name),
        annotations: annotate(JOB_INDEX[jobType].title, SPENDS_ALLOWANCE),
      },
      async (args: Record<string, unknown>, extra: ExtraLike) => {
        const { waitSeconds, full, inputFiles, inputPaths, ...params } = args as Record<string, unknown> & {
          waitSeconds?: number;
          full?: boolean;
          inputFiles?: InlineFile[];
          inputPaths?: string[];
        };
        const wait = waitSeconds ?? deps.waitDefaultSeconds;
        return (await runAndWait(deps, jobType, params, {
          waitSeconds: wait,
          full: Boolean(full),
          inputFiles,
          inputPaths,
          onProgress: progressReporter(extra, wait),
          signal: extra?.signal,
        })) as never;
      },
    );
  }

  // The lifecycle tools' example job: the first job type that takes no file,
  // with the first two arguments of its registry example. Derived, so it can
  // never name a job type or a parameter the contract does not have.
  const sampleType = JOB_TYPES.find((jt) => !JOB_SCHEMAS[jt]['x-files']) ?? JOB_TYPES[0];
  const sampleParams = Object.fromEntries(Object.entries(AGENT_COPY[sampleType]?.example.arguments ?? {}).slice(0, 2));
  const sampleJobId = '0b7c6f3e-5d1a-4c2e-9f8a-2a4e6b1d9c07';
  const jobTypeInput =
    `jobType, one of the ${JOB_TYPES.length} job types list_simulation_tools names; params, that job type's ` +
    "parameters, validated here against its contract before anything is sent (each one's unit, range and default " +
    'is in the matching simulate_* tool\'s schema); inputFiles or inputPaths for a job type that takes files. ' +
    UPLOAD_NEEDS_KEY;

  server.registerTool(
    'list_simulation_tools',
    {
      title: 'List Simulation Tools',
      description: composeDescription({
        question:
          `List the ${JOB_TYPES.length} server-side simulation job types with their tool names, parameters, ` +
          'file rules, free-lane bounds and time budgets.',
        inputs: 'none.',
        example: {},
        returns:
          'count; the tier allowances; what runs without a key; how long a result link lives; the duplicate-' +
          'submission window; and for each job type its simulate_* tool name, jobType, title, parameter names, time ' +
          'budget, file rules and free-lane bounds.',
        notes: `${TIER_LIMITS} A job runs without a key on the free lane; a job that takes a file does not. ${UPLOAD_NEEDS_KEY}`,
      }),
      inputSchema: z.object({}),
      annotations: annotate('List Simulation Tools', READS),
    },
    async () => handleListTools() as never,
  );

  server.registerTool(
    'submit_simulation',
    {
      title: 'Submit Simulation',
      description: composeDescription({
        question: 'Start a simulation job named by its job type and return at once with its id, without waiting for the result.',
        inputs: jobTypeInput,
        example: { jobType: sampleType, params: sampleParams },
        returns:
          'jobId, jobType, status, queue position, the time budget, a suggested wait and the result page URL. An ' +
          `identical submission inside ${DEDUP_WINDOW_SECONDS} s returns the same job.`,
        notes:
          'Counts against the monthly run allowance. The typed simulate_* tool for a job type does the same and ' +
          'waits for the result.',
      }),
      annotations: annotate('Submit Simulation', SPENDS_ALLOWANCE),
      inputSchema: strictObject(
        {
          jobType: z.enum(JOB_TYPES as [string, ...string[]]).describe('Which job type to run'),
          params: z.record(z.string(), z.unknown()).default({}).describe('Parameters for that job type, validated locally against its contract'),
          inputFiles: z.array(inlineFileSchema).optional().describe(`Inline files for file-input job types. ${UPLOAD_NEEDS_KEY}`),
          inputPaths: z.array(z.string()).optional().describe(`Local file paths for file-input job types. ${UPLOAD_NEEDS_KEY}`),
        },
        'submit_simulation',
      ),
    },
    async (args: { jobType: string; params?: Record<string, unknown>; inputFiles?: InlineFile[]; inputPaths?: string[] }) => {
      if (!JOB_SCHEMAS[args.jobType]) return unknownJobType(args.jobType) as never;
      const note = deps.api.hasKey ? undefined : freeLaneNote(args.jobType);
      try {
        const { submit } = await submitJob(deps, args.jobType, args.params ?? {}, args.inputFiles, args.inputPaths);
        return ok(submitted(args.jobType, submit), note) as never;
      } catch (err) {
        return fail(errorText(err)) as never;
      }
    },
  );

  server.registerTool(
    'get_simulation_status',
    {
      title: 'Get Simulation Status',
      description: composeDescription({
        question: 'Report how far a submitted simulation job has got.',
        inputs: 'jobId, as submit_simulation or a simulate_* tool returned it.',
        example: { jobId: sampleJobId },
        returns:
          'status, progress from 0 to 1, stage, queue position, start and finish times, whether a result is ready, ' +
          'when the job expires, the result page URL, and for a failed job the error and its kind.',
        notes: 'Poll this rather than holding a call open; it spends nothing.',
      }),
      inputSchema: strictObject({ jobId: z.string().describe('The id submit_simulation returned') }, 'get_simulation_status'),
      annotations: annotate('Get Simulation Status', READS),
    },
    async (args: { jobId: string }) => (await handleStatus(deps, args.jobId)) as never,
  );

  server.registerTool(
    'get_simulation_result',
    {
      title: 'Get Simulation Result',
      description: composeDescription({
        question: 'Fetch the result of a finished simulation job.',
        inputs: 'jobId; full, optional, true for the whole payload instead of the summary (default false).',
        example: { jobId: sampleJobId },
        returns:
          'The headline values, warnings and provenance, with every series described rather than listed, the result ' +
          `page URL and a result link that lives ${RESULT_URL_LIFETIME}. A job that has not finished returns its ` +
          'status and progress instead.',
      }),
      annotations: annotate('Get Simulation Result', READS),
      inputSchema: strictObject(
        {
          jobId: z.string().describe('The id submit_simulation returned'),
          full: z.boolean().default(false).describe('Return the whole payload instead of the summary. Large.'),
        },
        'get_simulation_result',
      ),
    },
    async (args: { jobId: string; full?: boolean }) => (await handleResult(deps, args.jobId, Boolean(args.full))) as never,
  );

  server.registerTool(
    'run_simulation',
    {
      title: 'Run Simulation',
      description: composeDescription({
        question: 'Run a simulation job named by its job type and wait a bounded time for its result.',
        inputs:
          `${jobTypeInput} waitSeconds, 0 to ${deps.waitMaxSeconds} (default ${deps.waitDefaultSeconds}); full, ` +
          'optional, true for the whole payload.',
        example: { jobType: sampleType, params: sampleParams, waitSeconds: 60 },
        returns:
          "The same result the job type's simulate_* tool returns. If the wait runs out first, the jobId and current " +
          'progress instead, and the job keeps running.',
        notes:
          'Counts against the monthly run allowance. Sends progress notifications while it waits. The typed ' +
          'simulate_* tool for a job type takes the same parameters with their units in its schema.',
      }),
      annotations: annotate('Run Simulation', SPENDS_ALLOWANCE),
      inputSchema: strictObject(
        {
          jobType: z.enum(JOB_TYPES as [string, ...string[]]).describe('Which job type to run'),
          params: z.record(z.string(), z.unknown()).default({}).describe('Parameters for that job type'),
          inputFiles: z.array(inlineFileSchema).optional().describe(`Inline files for file-input job types. ${UPLOAD_NEEDS_KEY}`),
          inputPaths: z.array(z.string()).optional().describe(`Local file paths for file-input job types. ${UPLOAD_NEEDS_KEY}`),
          waitSeconds: z
            .number()
            .min(0)
            .max(deps.waitMaxSeconds)
            .default(deps.waitDefaultSeconds)
            .describe(`How long to wait before returning the job id (max ${deps.waitMaxSeconds})`),
          full: z.boolean().default(false).describe('Return the whole result payload instead of the summary'),
        },
        'run_simulation',
      ),
    },
    async (
      args: {
        jobType: string;
        params?: Record<string, unknown>;
        inputFiles?: InlineFile[];
        inputPaths?: string[];
        waitSeconds?: number;
        full?: boolean;
      },
      extra: ExtraLike,
    ) => {
      const wait = args.waitSeconds ?? deps.waitDefaultSeconds;
      return (await runAndWait(deps, args.jobType, args.params ?? {}, {
        waitSeconds: wait,
        full: Boolean(args.full),
        inputFiles: args.inputFiles,
        inputPaths: args.inputPaths,
        onProgress: progressReporter(extra, wait),
        signal: extra?.signal,
      })) as never;
    },
  );

  names.push('list_simulation_tools', 'submit_simulation', 'get_simulation_status', 'get_simulation_result', 'run_simulation');
  return names;
}
