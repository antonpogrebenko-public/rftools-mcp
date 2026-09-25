// solve_calculation: POST /v1/calculate/solve — search one calculator input
// for a target output, in one metered call (openspec kicad-plugin, design
// Decision 10; spec api-access/target-solve).
//
// Unlike run_calculation, which computes locally against the bundled
// calculator registry and spends no quota, this search runs on the service's
// own calculators. It is a genuine network request, and it is gated by the
// same key `/v1/calculate` itself requires — there is no free anonymous lane
// for it the way the job endpoints have. So this module follows the
// simulation tools' conventions (`RftoolsApi`, `ApiError`, `describeApiError`)
// rather than run_calculation's.

import { ApiError, describeApiError, type RftoolsApi, type SolveRequestBody, type SolveResponse } from './api.ts';

export interface ToolText {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface SolveArgs {
  slug: string;
  inputs: Record<string, number>;
  solveFor: string;
  target: { output: string; value: number };
  grid?: number;
  range?: [number, number];
}

/**
 * What `/v1/calculate/solve` needs authenticated for, said before anything is
 * sent — the same reasoning as `UPLOAD_NEEDS_KEY` in `api.ts`: the service
 * would otherwise answer a bare 401 with no mention of the variable this host
 * has to set.
 */
export const SOLVE_NEEDS_KEY =
  'solve_calculation calls the metered POST /calculate/solve endpoint, which needs an API key — ' +
  'the same one POST /calculate itself requires. Unlike run_calculation, this does not run locally ' +
  'or for free. Set RFTOOLS_API_KEY. A free key: https://rftools.io/dashboard';

/** The request body: exactly the fields the caller named. Nothing is defaulted in here. */
export function buildSolveBody(args: SolveArgs): SolveRequestBody {
  const body: SolveRequestBody = {
    slug: args.slug,
    inputs: args.inputs,
    solveFor: args.solveFor,
    target: args.target,
  };
  if (args.grid !== undefined) body.grid = args.grid;
  if (args.range !== undefined) body.range = args.range;
  return body;
}

/** The sentence a caller reads for a failed solve call. */
export function solveErrorText(err: unknown): string {
  if (err instanceof ApiError) return describeApiError(err);
  return err instanceof Error ? err.message : String(err);
}

export async function handleSolve(api: RftoolsApi, args: SolveArgs): Promise<ToolText> {
  if (!api.hasKey) {
    return { content: [{ type: 'text' as const, text: SOLVE_NEEDS_KEY }], isError: true };
  }

  let response: SolveResponse;
  try {
    response = await api.solve(buildSolveBody(args));
  } catch (err) {
    return { content: [{ type: 'text' as const, text: solveErrorText(err) }], isError: true };
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }] };
}
