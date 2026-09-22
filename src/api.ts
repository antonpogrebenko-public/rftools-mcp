// The rftools.io job API, and the typed errors it produces.
//
// Nothing here classifies a failure by matching text in a message: the HTTP
// status and the service's own `errorKind` decide, and the service's detail
// travels to the caller unchanged.

/** Every failure kind the tool layer distinguishes. */
export type ApiErrorKind =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'quota'
  | 'rate_limited'
  | 'invalid_request'
  | 'too_large'
  | 'unavailable'
  | 'fault'
  | 'transient';

/** A failed call to the service. */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  /** The service's detail, unchanged: a string, or its list of parameter problems. */
  readonly detail: unknown;
  /** Seconds to wait, from Retry-After, when the service sent one. */
  readonly retryAfter?: number;

  constructor(status: number, kind: ApiErrorKind, detail: unknown, retryAfter?: number) {
    super(renderDetail(detail) || `API ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    this.detail = detail;
    this.retryAfter = retryAfter;
  }
}

/** Status -> kind. The one place a number becomes a meaning. */
export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'auth';
  if (status === 402) return 'quota';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 413) return 'too_large';
  if (status === 429) return 'rate_limited';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status === 503) return 'unavailable';
  if (status >= 500) return 'fault';
  return 'fault';
}

/** One parameter problem as the service reports it. */
interface ParamProblem {
  param?: string;
  value?: unknown;
  reason?: string;
  allowed?: unknown;
  /** FastAPI's own shape, when the request never reached our validation. */
  loc?: unknown[];
  msg?: string;
}

/** Render a service detail — a string, or a list of parameter problems — as lines. */
export function renderDetail(detail: unknown): string {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (typeof entry === 'string') return `- ${entry}`;
        const p = entry as ParamProblem;
        const name = p.param ?? (Array.isArray(p.loc) ? p.loc.filter((x) => x !== 'body').join('.') : undefined);
        const reason = p.reason ?? p.msg ?? '';
        const bits: string[] = [];
        if (name) bits.push(String(name));
        if (reason) bits.push(reason);
        let line = `- ${bits.join(': ')}`;
        if (p.value !== undefined) line += ` (given ${JSON.stringify(p.value)})`;
        if (p.allowed !== undefined) line += `; allowed: ${renderAllowed(p.allowed)}`;
        return line;
      })
      .join('\n');
  }
  return JSON.stringify(detail);
}

function renderAllowed(allowed: unknown): string {
  if (Array.isArray(allowed)) return allowed.map((a) => String(a)).join(', ');
  if (allowed && typeof allowed === 'object') return JSON.stringify(allowed);
  return String(allowed);
}

/** The sentence a caller reads for a failed call. */
export function describeApiError(err: ApiError): string {
  const detail = renderDetail(err.detail);
  switch (err.kind) {
    case 'auth':
      return (
        'The API key was refused, or its monthly allowance is spent. ' +
        'Check the key and its usage at https://rftools.io/dashboard.' +
        (detail ? `\nService said: ${detail}` : '')
      );
    case 'quota':
      return (
        'The monthly simulation allowance is spent. Free: 5 runs/month, Pro: 100/month, API: 10 000/month. ' +
        'See https://rftools.io/dashboard.' +
        (detail ? `\nService said: ${detail}` : '')
      );
    case 'rate_limited':
      return (
        'Too many requests.' +
        (err.retryAfter !== undefined ? ` Retry after ${err.retryAfter} s.` : ' Retry shortly.') +
        (detail ? `\nService said: ${detail}` : '')
      );
    case 'invalid_request':
      // status 0 means we refused it ourselves, against the contract, before
      // anything was sent — say so rather than blaming the service.
      return err.status === 0
        ? `The call does not match the job type's contract, so nothing was sent:\n${detail || '(no detail given)'}`
        : `The service refused the request as invalid:\n${detail || '(no detail given)'}`;
    case 'too_large':
      return `The request is larger than this lane will run:\n${detail || '(no detail given)'}`;
    case 'forbidden':
      return `Not authorised for this job: ${detail || 'the job belongs to another account.'}`;
    case 'not_found':
      // status 0: our own reading of the job's state, already a full sentence.
      return err.status === 0 ? detail || 'Not found.' : `Not found: ${detail || 'no such job.'}`;
    case 'unavailable':
      return `The service is temporarily unavailable: ${detail || 'try again shortly.'}`;
    case 'transient':
      return `The service could not be reached: ${detail || err.message}. Retry shortly.`;
    case 'fault':
    default:
      return `The service failed (HTTP ${err.status}): ${detail || err.message}`;
  }
}

/**
 * The closed set of `errorKind` values a finished job carries, each as a
 * sentence. An unknown kind falls back to the service's own message.
 */
const JOB_ERROR_KINDS: Record<string, string> = {
  invalid_request: 'The job was refused as invalid — a parameter is outside what this job type accepts.',
  too_large: 'The job is larger than its lane will run. Reduce the mesh, the sweep, the population or the trial count, or use a paid lane.',
  not_available: 'That mode is not available on this tier. A paid key unlocks it.',
  timeout: 'The job ran past its time budget and was stopped. Reduce the size of the problem or use a paid lane.',
  interrupted: 'The job was interrupted before it finished. Resubmit it.',
  result_expired: 'The result is no longer stored. Results are kept for 30 days on the free tier; resubmit the job.',
  rate_limited: 'The job was refused because too many were submitted at once. Retry shortly.',
  transient: 'The job failed on something transient. Resubmit it.',
  fault: 'The job failed inside the service. This is a fault on our side, not a problem with the request.',
};

/** The sentence for a job's `errorKind`, with the service's message appended. */
export function describeJobError(errorKind: string | undefined, errorMessage: string | undefined): string {
  const sentence = errorKind ? JOB_ERROR_KINDS[errorKind] : undefined;
  if (sentence) return errorMessage ? `${sentence}\n${errorMessage}` : sentence;
  if (errorKind) return errorMessage ? `${errorKind}: ${errorMessage}` : `The job failed (${errorKind}).`;
  return errorMessage ?? 'The job failed without a message.';
}

/** The job status the service reports. Fields absent from an older service stay undefined. */
export interface JobStatusResponse {
  jobId?: string;
  status: string;
  progress?: number;
  stage?: string;
  startedAt?: string;
  finishedAt?: string;
  queuePosition?: number;
  queueTotal?: number;
  resultUrl?: string;
  resultUrlExpiresIn?: number;
  resultExpiresAt?: string;
  errorMessage?: string;
  errorKind?: string;
  expiresAt?: string;
  jobType?: string;
  createdAt?: string;
}

export interface JobSubmitResponse {
  jobId: string;
  status: string;
  queuePosition?: number;
  queueTotal?: number;
}

export interface UploadTicket {
  uploadUrl: string;
  key: string;
  fields?: Record<string, string>;
}

/**
 * What every surface says when an upload is attempted without a credential.
 *
 * The API's 401 on `POST /v1/upload` sends the same sentence in its own words
 * ("a signed-in session or an API key"); here there is no session to offer, so
 * it names the variable the host has to set. Refusing locally with this saves
 * a round trip and, more to the point, saves an agent from reading a bare 401
 * and retrying the whole call with the same empty header.
 */
export const UPLOAD_NEEDS_KEY =
  'Uploading a file needs an API key; set RFTOOLS_API_KEY.';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
}

const DEFAULT_BASE = 'https://rftools.io/api/py';

/** The rftools.io API, as the tools use it. */
export class RftoolsApi {
  readonly baseUrl: string;
  readonly apiKey: string;
  private readonly doFetch: FetchLike;

  constructor(opts: ApiOptions = {}) {
    this.baseUrl = opts.baseUrl ?? process.env.RFTOOLS_API_BASE ?? DEFAULT_BASE;
    this.apiKey = opts.apiKey ?? process.env.RFTOOLS_API_KEY ?? '';
    this.doFetch = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /** True when a key is configured; false means the free lane. */
  get hasKey(): boolean {
    return Boolean(this.apiKey);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return this.apiKey ? { ...extra, Authorization: `Bearer ${this.apiKey}` } : { ...extra };
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await this.doFetch(`${this.baseUrl}${path}`, init);
    } catch (err) {
      throw new ApiError(0, 'transient', err instanceof Error ? err.message : String(err));
    }
    if (!res.ok) throw await errorFromResponse(res);
    if (res.status === 204) return null;
    return await res.json();
  }

  async post(path: string, body: unknown): Promise<unknown> {
    return this.request(path, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
  }

  async get(path: string): Promise<unknown> {
    return this.request(path, { method: 'GET', headers: this.headers() });
  }

  async submitJob(
    jobType: string,
    params: Record<string, unknown>,
    inputFileKeys: string[] = [],
  ): Promise<JobSubmitResponse> {
    return (await this.post('/v1/jobs', { jobType, params, inputFileKeys })) as JobSubmitResponse;
  }

  async jobStatus(jobId: string): Promise<JobStatusResponse> {
    return (await this.get(`/v1/jobs/${encodeURIComponent(jobId)}`)) as JobStatusResponse;
  }

  /**
   * Upload one file: ask for a presigned POST, then send the form the way the
   * browser does — the policy's fields first, the bytes under `file` last.
   * Returns the key the job body carries.
   */
  async uploadFile(filename: string, content: Uint8Array | string): Promise<string> {
    // Before the request, not after it. The service refuses an anonymous
    // upload, and its 401 arrives as "auth" with no mention of the variable
    // this host has to set — so the answer is given here, where it is known.
    if (!this.hasKey) throw new ApiError(0, 'auth', UPLOAD_NEEDS_KEY);

    // The jobs router is mounted at /api/py/v1, so the upload route is
    // /v1/upload against this base — the same path the browser posts to.
    const ticket = (await this.post('/v1/upload', {
      filename,
      contentType: 'application/octet-stream',
    })) as UploadTicket;

    const form = new FormData();
    for (const [k, v] of Object.entries(ticket.fields ?? {})) form.append(k, v);
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    form.append('file', new Blob([bytes as BlobPart], { type: 'application/octet-stream' }), filename);

    let res: Response;
    try {
      res = await this.doFetch(ticket.uploadUrl, { method: 'POST', body: form as unknown as BodyInit });
    } catch (err) {
      throw new ApiError(0, 'transient', `upload of ${filename} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(res.status, kindForStatus(res.status), `upload of ${filename} failed: ${text || res.statusText}`);
    }
    return ticket.key;
  }

  /** Fetch a finished job's result payload from its presigned URL. */
  async fetchResult(resultUrl: string): Promise<unknown> {
    let res: Response;
    try {
      res = await this.doFetch(resultUrl, { method: 'GET' });
    } catch (err) {
      throw new ApiError(0, 'transient', err instanceof Error ? err.message : String(err));
    }
    if (!res.ok) {
      // A presigned result URL lives 15 minutes; past that the fetch is refused.
      const kind = res.status === 403 || res.status === 404 ? 'not_found' : kindForStatus(res.status);
      throw new ApiError(res.status, kind, `the result link is no longer valid (HTTP ${res.status}); ask for the status again to get a fresh one`);
    }
    return await res.json();
  }
}

/** Build the typed error for a non-2xx response, keeping the service's detail. */
export async function errorFromResponse(res: Response): Promise<ApiError> {
  let detail: unknown;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const parsed = JSON.parse(text);
      detail = parsed && typeof parsed === 'object' && 'detail' in parsed ? (parsed as { detail: unknown }).detail : parsed;
    } catch {
      detail = text;
    }
  } else {
    detail = res.statusText;
  }
  const header = res.headers?.get?.('Retry-After') ?? res.headers?.get?.('retry-after') ?? null;
  const retryAfter = header != null && header !== '' && Number.isFinite(Number(header)) ? Number(header) : undefined;
  return new ApiError(res.status, kindForStatus(res.status), detail, retryAfter);
}
