// How every tool on this server describes itself and declares its behaviour
// (openspec agent-surface, spec mcp-discovery).
//
// A description has four parts, always in this order and always labelled, so
// an agent can find each one and a test can check it is there:
//
//   <the question the tool answers — one sentence, on the first line>
//   Inputs: <units and ranges, or which tool states them>
//   Example: <one complete argument object>
//   Returns: <what comes back>
//   <anything else a caller must know first, optional>
//
// The first line is published on its own as the tool's `question` in the
// manifest (shared/mcp/manifest.json), which the /agents page translates, so it
// must read as a sentence without the rest.

import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/**
 * The longest description any one tool may carry, in characters. Every agent
 * pays for every description on every tools/list, so this is a budget, not a
 * style rule. Recorded in the manifest's counts so growth is visible.
 */
export const DESCRIPTION_MAX_CHARS = 1700;

/**
 * The whole tools/list result — names, titles, descriptions, input schemas and
 * annotations — as compact JSON, in bytes. Measured at 2.4.0 and set with room
 * for a release or two of growth; raising it is a decision someone makes in a
 * diff, not something that happens by accident.
 */
export const LISTING_BUDGET_BYTES = 90_000;

/** MCP's limit on a tool name (and the Claude directory's). */
export const TOOL_NAME_MAX_CHARS = 64;

export interface ToolCopy {
  /** One sentence, no line break: what the tool answers. */
  question: string;
  /** Units and ranges of the inputs, or which tool states them. */
  inputs: string;
  /** One complete call: an argument object, or its JSON text. */
  example: Record<string, unknown> | string;
  /** What the call returns. */
  returns: string;
  /** Anything else a caller must know before calling. */
  notes?: string;
}

/** The labels that open each part after the question. */
export const PART_LABELS = { inputs: 'Inputs:', example: 'Example:', returns: 'Returns:' } as const;

export function composeDescription(copy: ToolCopy): string {
  const question = copy.question.trim();
  if (/[\r\n]/.test(question)) throw new Error(`a question must be one line: ${question}`);
  const example = typeof copy.example === 'string' ? copy.example : JSON.stringify(copy.example);
  const lines = [
    question,
    `${PART_LABELS.inputs} ${copy.inputs.trim()}`,
    `${PART_LABELS.example} ${example}`,
    `${PART_LABELS.returns} ${copy.returns.trim()}`,
  ];
  if (copy.notes?.trim()) lines.push(copy.notes.trim());
  return lines.join('\n');
}

/** The question a composed description opens with. */
export function questionOf(description: string): string {
  return description.split('\n', 1)[0].trim();
}

// ── Annotations (design D7) ─────────────────────────────────────────────────
//
// openWorldHint is false on every tool: each one talks only to rftools.io's own
// service, or to nothing at all. destructiveHint is false on every tool:
// nothing here deletes or overwrites anything that exists.

/** Lists, searches, describes, calculates locally, or reads a job: no effect anywhere. */
export const READS: Omit<ToolAnnotations, 'title'> = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/**
 * Spends the caller's monthly allowance: submitting a job, or a metered API
 * call. Not read-only, because a host that runs read-only tools without asking
 * would spend a free account's five runs unprompted. Not idempotent: a repeat
 * spends again (identical job submissions merge only inside a 60 s window).
 */
export const SPENDS_ALLOWANCE: Omit<ToolAnnotations, 'title'> = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export function annotate(title: string, behaviour: Omit<ToolAnnotations, 'title'>): ToolAnnotations {
  return { title, ...behaviour };
}
