// JSON Schema (draft 2020-12, as shared/job-schemas emits it) -> zod.
//
// The MCP SDK publishes the zod schema as the tool's inputSchema, so what an
// agent sees when it lists tools is this conversion: every parameter typed,
// with its unit, range, default, options and tier bound stated. The same
// schema validates the call locally before any request is sent.

import { z } from 'zod';
import type { JobParamSchema, JobSchema } from './job-schemas.ts';
import { structureShapeFor } from './param-shapes.ts';

/**
 * Human sentence for one parameter, from the schema's annotations.
 *
 * `shapeNote` describes a structure the schema itself does not (see
 * param-shapes.ts). The `x-ref` pointer is never published: it names a file in
 * the service's repository, which is no use to the caller forming the call.
 */
export function describeParam(name: string, prop: JobParamSchema, shapeNote?: string): string {
  const parts: string[] = [];
  const label = prop['x-label'] ?? name;
  const unit = prop['x-unit'];
  parts.push(unit ? `${label} (${unit})` : label);

  // When we carry fuller prose for a structure the tooltip only sketches,
  // the prose replaces the sketch rather than repeating it.
  const tooltip = prop['x-tooltip'];
  if (tooltip && !(shapeNote && tooltip.includes('{'))) parts.push(tooltip);

  if (shapeNote) {
    parts.push(shapeNote);
  } else if (prop['x-ref']) {
    parts.push('Structure is not described by this schema; pass it as the service expects');
  }

  const range: string[] = [];
  if (prop.minimum !== undefined) range.push(`min ${prop.minimum}`);
  if (prop.maximum !== undefined) range.push(`max ${prop.maximum}`);
  if (range.length) parts.push(range.join(', '));

  if (prop.default !== undefined) parts.push(`default ${JSON.stringify(prop.default)}`);

  if (prop['x-derived']) {
    parts.push(`Omit to let the service derive it: ${prop['x-derived']}.`);
  }

  const tier = prop['x-tier'];
  if (tier) {
    for (const [tierName, bound] of Object.entries(tier)) {
      const bounds: string[] = [];
      if (bound.minimum !== undefined) bounds.push(`min ${bound.minimum}`);
      if (bound.maximum !== undefined) bounds.push(`max ${bound.maximum}`);
      if (bounds.length) parts.push(`bound on the ${tierName} tier: ${bounds.join(', ')}`);
    }
  }

  if (prop['x-paidOnly']?.length) {
    parts.push(`Paid tier only: ${prop['x-paidOnly'].join(', ')}.`);
  }

  const showWhen = prop['x-showWhen'];
  if (showWhen) {
    parts.push(`Applies when ${showWhen.key} is "${showWhen.value}".`);
  }

  if (prop['x-hidden']) {
    // Hidden means "not on the web form", which is not the same as optional:
    // antenna_sim's geometry is hidden behind an editor and still required.
    // Never invite a caller to omit a parameter its own tooltip calls required.
    const saysRequired = /\brequired\b/i.test(prop['x-tooltip'] ?? '');
    parts.push(
      saysRequired
        ? 'Not on the web form, which has an editor for it — give it here as described'
        : 'Advanced — most callers can leave it out',
    );
  }

  return parts.join('. ').replace(/\.\./g, '.');
}

/** The zod type for one parameter, before optionality is applied. */
function baseType(prop: JobParamSchema): z.ZodTypeAny {
  // A parameter the schema does not describe travels as given — but the
  // contract's declared type still holds, so the published schema says at
  // least whether it is a list or an object.
  if (prop['x-ref']) {
    if (prop.type === 'array') return z.array(z.unknown());
    if (prop.type === 'object') return z.record(z.string(), z.unknown());
    return z.unknown();
  }

  if (prop.enum?.length) {
    return z.enum(prop.enum as [string, ...string[]]);
  }

  switch (prop.type) {
    case 'integer': {
      let n = z.int();
      if (prop.minimum !== undefined) n = n.min(prop.minimum);
      if (prop.maximum !== undefined) n = n.max(prop.maximum);
      return n;
    }
    case 'number': {
      let n = z.number();
      if (prop.minimum !== undefined) n = n.min(prop.minimum);
      if (prop.maximum !== undefined) n = n.max(prop.maximum);
      return n;
    }
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(z.unknown());
    case 'object':
      return z.record(z.string(), z.unknown());
    case 'string':
    default:
      return z.string();
  }
}

/** The zod type for one parameter, with description, default and optionality. */
export function zodForParam(
  name: string,
  prop: JobParamSchema,
  required: boolean,
  shapeNote?: string,
): z.ZodTypeAny {
  let t = baseType(prop).describe(describeParam(name, prop, shapeNote));
  if (prop.default !== undefined) {
    t = t.default(prop.default as never);
  } else if (!required) {
    t = t.optional();
  }
  return t;
}

/** Every parameter of a job type as a zod shape. */
export function shapeForJob(schema: JobSchema): Record<string, z.ZodTypeAny> {
  const required = new Set(schema.required ?? []);
  const jobType = schema['x-jobType'];
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
    shape[name] = zodForParam(name, prop, required.has(name), structureShapeFor(jobType, name));
  }
  return shape;
}

/**
 * A strict object over a shape whose unknown-key refusal names the key and the
 * keys that are accepted. The refusal happens locally: no request is sent.
 */
export function strictObject(
  shape: Record<string, z.ZodTypeAny>,
  what: string,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const accepted = Object.keys(shape);
  return z.strictObject(shape, {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? `${what} does not accept ${issue.keys.map((k) => `"${k}"`).join(', ')}. ` +
          `Accepted keys: ${accepted.join(', ')}.`
        : undefined,
  }) as z.ZodObject<Record<string, z.ZodTypeAny>>;
}

/** The params-only schema for a job type, used by the generic lifecycle tools. */
export function paramsSchemaForJob(schema: JobSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
  return strictObject(shapeForJob(schema), `${schema['x-jobType']}`);
}

/** Validate a params object against a job type's contract, returning readable problems. */
export function validateParams(
  schema: JobSchema,
  params: Record<string, unknown>,
): { ok: true; value: Record<string, unknown> } | { ok: false; problems: string[] } {
  const parsed = paramsSchemaForJob(schema).safeParse(params);
  if (parsed.success) return { ok: true, value: parsed.data as Record<string, unknown> };
  const problems = parsed.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { ok: false, problems };
}
