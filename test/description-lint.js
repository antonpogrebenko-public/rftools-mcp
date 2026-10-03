// The description lint (openspec agent-surface, task 2.4; spec mcp-discovery,
// "Every tool description answers the questions an agent asks before calling
// it"). A plain module, not a test file: test/descriptions.test.js runs it on
// the real listing and on deliberately broken tools, so a lint that stopped
// catching anything would fail too.
//
// What it checks, for each tool in a tools/list result:
//   - the name is 64 characters or fewer;
//   - the description opens with the question the tool answers, one sentence
//     on its own line;
//   - it has an "Inputs:" part (units and ranges, or the tool that states
//     them), an "Example:" part holding a JSON argument object that the tool's
//     own input schema accepts, and a "Returns:" part;
//   - it fits the per-tool length bound;
//   - it matches none of the prompt-injection patterns below.
// And for the listing as a whole: it fits the total byte budget.

import Ajv from 'ajv';

/**
 * Text that instructs the model beyond the tool's function, or sells. These
 * follow the Claude connectors directory review criteria and the OpenAI app
 * guidelines (design, "What was checked outside the repo"): no telling the
 * model to call tools it was not asked to, to override its instructions, to
 * take instructions from elsewhere, or to promote anything.
 */
export const INJECTION_PATTERNS = [
  { kind: 'override instructions', re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(instructions?|prompts?|rules?|guidelines?|system)\b/i },
  { kind: 'override instructions', re: /\bsystem prompt\b/i },
  { kind: 'override instructions', re: /<\/?\s*(system|instructions?|important|admin)\b[^>]*>/i },
  { kind: 'override instructions', re: /\b(do not|don't|never)\s+(tell|inform|mention|reveal|show)\b[^.\n]{0,30}\buser\b/i },
  { kind: 'unrequested tool call', re: /\b(always|automatically|proactively|immediately)\s+(call|invoke|run|use|execute)\b/i },
  { kind: 'unrequested tool call', re: /\b(call|invoke|run|use|execute)\b[^.\n]{0,40}\b(before|after)\s+(answering|responding|replying|every|each|any)\b/i },
  { kind: 'unrequested tool call', re: /\b(call|invoke|use)\s+this\s+tool\s+(whenever|for (every|all|any)|on (every|each))\b/i },
  { kind: 'unrequested tool call', re: /\bwithout (asking|telling|confirming|permission)\b/i },
  { kind: 'instructions from elsewhere', re: /\b(follow|obey|execute|load|fetch)\b[^.\n]{0,30}\b(instructions|directions|commands)\b[^.\n]{0,20}\b(from|at|in)\b/i },
  { kind: 'promotional', re: /\b(the\s+)?(best|leading|#1|number one|world[- ]class|industry[- ]leading|ultimate)\b[^.\n]{0,20}\b(tool|server|calculator|app|service|solution|platform)s?\b/i },
  { kind: 'promotional', re: /\b(unbeatable|revolutionary|amazing|incredible|cutting[- ]edge)\b/i },
  { kind: 'promotional', re: /\b(buy now|subscribe now|upgrade now|sign up|special offer|limited time|discount|free trial|click here|visit our)\b/i },
];

const LABELS = ['Inputs:', 'Example:', 'Returns:'];

/** The part of a description after a label, up to the end of its line. */
function partAfter(description, label) {
  const line = description.split('\n').find((l) => l.startsWith(`${label} `));
  return line === undefined ? undefined : line.slice(label.length).trim();
}

/** The argument object an "Example:" line holds, without a trailing `(the "…" preset)` note. */
export function exampleOf(description) {
  const raw = partAfter(description, 'Example:');
  if (raw === undefined) return undefined;
  const json = raw.replace(/\s+\(the "[^"]*" preset\)$/, '');
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Every problem with one tool, each naming the tool and the part.
 * `opts.maxChars` and `opts.maxName` are the bounds.
 */
export function lintTool(tool, opts) {
  const problems = [];
  const name = tool.name ?? '(unnamed)';
  const say = (what) => problems.push(`${name}: ${what}`);
  const description = tool.description ?? '';

  if (name.length > opts.maxName) say(`name is ${name.length} characters, over ${opts.maxName}`);
  if (!description) {
    say('no description');
    return problems;
  }

  const question = description.split('\n', 1)[0].trim();
  if (question.length < 20) say('missing question: the first line must say what the tool answers');
  else if (!/[.?]$/.test(question)) say('question is not one sentence ending in a full stop or question mark');
  else if (LABELS.some((l) => question.startsWith(l))) say('missing question: the description opens with a label');

  for (const label of LABELS) {
    const part = partAfter(description, label);
    const what = label.slice(0, -1).toLowerCase();
    if (part === undefined || part === '') say(`missing ${what === 'inputs' ? 'units and ranges (Inputs:)' : what === 'example' ? 'example input (Example:)' : 'return statement (Returns:)'}`);
  }

  const example = exampleOf(description);
  if (example === null) say('example is not a JSON argument object');
  else if (example && tool.inputSchema) {
    const schema = { ...tool.inputSchema };
    delete schema.$schema;
    const validate = ajv.compile(schema);
    if (!validate(example)) say(`example is not a valid call: ${ajv.errorsText(validate.errors)}`);
  }

  if (description.length > opts.maxChars) say(`description is ${description.length} characters, over the ${opts.maxChars} bound`);

  for (const { kind, re } of INJECTION_PATTERNS) {
    const hit = description.match(re);
    if (hit) say(`${kind}: "${hit[0]}"`);
  }
  return problems;
}

/** Every problem in a listing: each tool's, then the total budget. */
export function lintListing(tools, opts) {
  const problems = tools.flatMap((t) => lintTool(t, opts));
  const bytes = new TextEncoder().encode(JSON.stringify(tools)).byteLength;
  if (bytes > opts.budgetBytes) problems.push(`listing: ${bytes} bytes, over the ${opts.budgetBytes} budget`);
  return problems;
}
