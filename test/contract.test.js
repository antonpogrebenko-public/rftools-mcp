// The contract: what the generated schemas produce, and what an agent sees
// when it lists the tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  JOB_INDEX,
  JOB_SCHEMAS,
  JOB_TYPES,
  assertContractConsistent,
  toolNameForJobType,
  listJobTypes,
} from '../src/job-schemas.ts';
import { describeParam, shapeForJob, validateParams } from '../src/json-schema-to-zod.ts';
import { RESERVED_ARG_NAMES } from '../src/simulation-tools.ts';
import { connectedServer, textOf, jsonOf } from './helpers.js';

const indexJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../shared/job-schemas/index.json', import.meta.url)), 'utf8'),
);
const CONTRACT_COUNT = Object.keys(indexJson.jobTypes).length;

test('every job type in the index has a schema, and nothing else does', () => {
  assertContractConsistent();
  assert.equal(JOB_TYPES.length, CONTRACT_COUNT);
  assert.equal(Object.keys(JOB_SCHEMAS).length, CONTRACT_COUNT);
  for (const jobType of JOB_TYPES) {
    assert.equal(JOB_SCHEMAS[jobType]['x-jobType'], jobType);
    assert.equal(JOB_SCHEMAS[jobType]['x-slug'], JOB_INDEX[jobType].slug);
  }
});

test('every job type converts to a zod shape with every contract parameter', () => {
  for (const jobType of JOB_TYPES) {
    const schema = JOB_SCHEMAS[jobType];
    const shape = shapeForJob(schema);
    assert.deepEqual(Object.keys(shape).sort(), Object.keys(schema.properties).sort(), jobType);
  }
});

test('no job parameter collides with a name the tool layer reserves', () => {
  for (const jobType of JOB_TYPES) {
    for (const reserved of RESERVED_ARG_NAMES) {
      assert.ok(
        !(reserved in JOB_SCHEMAS[jobType].properties),
        `${jobType} has a parameter named ${reserved}`,
      );
    }
  }
});

test('the tool name is the slug with underscores', () => {
  assert.equal(toolNameForJobType('pdn_impedance'), 'simulate_pdn_impedance');
  assert.equal(toolNameForJobType('impedance_match'), 'simulate_impedance_matching');
  assert.equal(toolNameForJobType('sparam_pipeline'), 'simulate_sparam_pipeline');
});

test('a required parameter is enforced locally', () => {
  const missing = validateParams(JOB_SCHEMAS.sat_link_budget, { frequency_ghz: 12 });
  assert.equal(missing.ok, false);
  assert.ok(missing.problems.join('\n').includes('latitude_deg'), missing.problems.join('\n'));

  const present = validateParams(JOB_SCHEMAS.sat_link_budget, { latitude_deg: 52, longitude_deg: 4 });
  assert.equal(present.ok, true);
});

test('an unknown key is refused locally, naming the key and the accepted keys', () => {
  const result = validateParams(JOB_SCHEMAS.pdn_impedance, { boardWidth_mm: 100, bogusKey: 1 });
  assert.equal(result.ok, false);
  const message = result.problems.join('\n');
  assert.ok(message.includes('"bogusKey"'), message);
  assert.ok(message.includes('boardWidth_mm'), message);
  assert.ok(message.includes('maxCapCount'), message);
});

test('a value outside the enum is refused, and a value outside the range too', () => {
  const badEnum = validateParams(JOB_SCHEMAS.antenna_sim, { solveMode: 'turbo' });
  assert.equal(badEnum.ok, false);
  assert.ok(badEnum.problems.join('\n').toLowerCase().includes('solvemode'));

  const badRange = validateParams(JOB_SCHEMAS.filter_monte_carlo, { monteCarloIterations: 99999 });
  assert.equal(badRange.ok, false);
  assert.ok(badRange.problems.join('\n').includes('monteCarloIterations'));
});

test('a call posts only the keys the caller named', () => {
  // The schema used to apply its defaults on parse, so every defaulted key was
  // posted whether or not the caller mentioned it. `stable_seed` hashes the
  // submitted dict, so that made the same design submitted from here, from the
  // browser and from the SDK three different Monte Carlo samples. The default
  // is published in the parameter description and applied by the service.
  const result = validateParams(JOB_SCHEMAS.eye_diagram, { dataRate: 5e9 });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.value), ['dataRate']);
});

test('the default is stated in the description instead', () => {
  const prbs = describeParam('prbs', JOB_SCHEMAS.eye_diagram.properties.prbs);
  assert.ok(prbs.includes('prbs15'), prbs);
  assert.ok(/omit/i.test(prbs), prbs);
});

test('an integer parameter refuses a fractional value locally', () => {
  assert.equal(JOB_SCHEMAS.filter_monte_carlo.properties.order.type, 'integer');
  const result = validateParams(JOB_SCHEMAS.filter_monte_carlo, { order: 5.7 });
  assert.equal(result.ok, false);
  assert.ok(result.problems.join('\n').includes('order'), result.problems.join('\n'));

  // A whole value given as a float is the same filter; JSON has one number type.
  assert.equal(validateParams(JOB_SCHEMAS.filter_monte_carlo, { order: 5 }).ok, true);
});

test('a measured quantity that steps by one is still a number', () => {
  // `traceL` is a trace length in millimetres whose form spinner steps by
  // 1 mm, and a 30.5 mm trace is an ordinary board. Integrality is a flag the
  // registry sets by hand on quantities that are counted; deriving it from the
  // step refused this, a 100.5 MHz clock and a 50.5 % duty cycle.
  assert.equal(JOB_SCHEMAS.fdtd_sparam.properties.traceL.type, 'number');
  const result = validateParams(JOB_SCHEMAS.fdtd_sparam, {
    structureType: 'microstrip_open_stub', traceL: 30.5,
  });
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.equal(result.value.traceL, 30.5);
});

test('a parameter the schema does not describe travels as given', () => {
  const wires = [{ start: [0, 0, 0], end: [0, 0, 1], radius: 0.001, segments: 11 }];
  const result = validateParams(JOB_SCHEMAS.antenna_sim, { wires, feed: { wire: 0, segment: 5 } });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.wires, wires);
  assert.deepEqual(result.value.feed, { wire: 0, segment: 5 });
});

test('a tier bound and a paid-only mode are stated in the parameter description', () => {
  const trials = describeParam(
    'monteCarloIterations',
    JOB_SCHEMAS.filter_monte_carlo.properties.monteCarloIterations,
  );
  assert.ok(/free/i.test(trials), trials);
  assert.ok(trials.includes('500'), trials);

  const solveMode = describeParam('solveMode', JOB_SCHEMAS.fdtd_sparam.properties.solveMode);
  assert.ok(solveMode.includes('Paid tier only'), solveMode);
  assert.ok(solveMode.includes('normal') && solveMode.includes('fine'), solveMode);

  const hidden = describeParam('referenceImpedance', JOB_SCHEMAS.antenna_sim.properties.referenceImpedance);
  assert.ok(hidden.includes('Advanced'), hidden);

  const derived = describeParam('portX_mm', JOB_SCHEMAS.pdn_impedance.properties.portX_mm);
  assert.ok(derived.includes('derive'), derived);
});

test('a structure the schema does not describe keeps its type and its shape prose', async () => {
  const harness = await connectedServer({ apiKey: '' });
  try {
    const { tools } = await harness.client.listTools();
    const antenna = tools.find((t) => t.name === 'simulate_antenna_sim');
    const props = antenna.inputSchema.properties;

    // The contract's declared type survives: a list is published as a list.
    assert.equal(props.wires.type, 'array');
    assert.equal(props.feed.type, 'object');
    assert.equal(props.ground.type, 'object');
    assert.equal(props.conductor.type, 'object');
    assert.equal(props.optimize.type, 'object');

    // And the shape is spelled out, as the prose string used to.
    assert.match(props.wires.description, /start:\[x,y,z\]/);
    assert.match(props.wires.description, /segments/);
    assert.match(props.feed.description, /\{wire, segment\}/);
    assert.match(props.ground.description, /free_space \| perfect \| finite/);
    assert.match(props.conductor.description, /copper \| aluminium \| perfect \| custom/);
    assert.match(props.optimize.description, /populationSize/);

    // A parameter its own tooltip calls required is never called optional.
    for (const name of ['wires', 'feed']) {
      assert.doesNotMatch(props[name].description, /leave it out/, name);
    }

    // No description points at a file in the service's repository.
    for (const [name, prop] of Object.entries(props)) {
      assert.doesNotMatch(prop.description ?? '', /backend\/|\.py\b/, name);
    }
  } finally {
    await harness.close();
  }
});

test('no published description points at a file no caller can open', async () => {
  const harness = await connectedServer({ apiKey: '' });
  try {
    const { tools } = await harness.client.listTools();
    for (const tool of tools) {
      assert.doesNotMatch(tool.description ?? '', /backend\/|\.py\b/, tool.name);
      for (const [name, prop] of Object.entries(tool.inputSchema?.properties ?? {})) {
        assert.doesNotMatch(prop.description ?? '', /backend\/|\.py\b/, `${tool.name}.${name}`);
      }
    }
  } finally {
    await harness.close();
  }
});

test('the server lists one typed tool per job type, with no prose params', async () => {
  const harness = await connectedServer({ apiKey: '' });
  try {
    const { tools } = await harness.client.listTools();
    const simulate = tools.filter((t) => t.name.startsWith('simulate_'));
    assert.equal(simulate.length, CONTRACT_COUNT);

    for (const jobType of JOB_TYPES) {
      const tool = simulate.find((t) => t.name === toolNameForJobType(jobType));
      assert.ok(tool, `missing tool for ${jobType}`);
      assert.equal(tool.inputSchema.type, 'object');
      assert.equal(tool.inputSchema.additionalProperties, false);
      // Every contract parameter is its own typed property, not a prose blob.
      assert.ok(!('params' in tool.inputSchema.properties), `${jobType} still has a prose params key`);
      for (const name of Object.keys(JOB_SCHEMAS[jobType].properties)) {
        const prop = tool.inputSchema.properties[name];
        assert.ok(prop, `${jobType}.${name} missing from the published schema`);
        assert.ok(typeof prop.description === 'string' && prop.description.length > 0);
      }
    }

    // The lifecycle tools are there too, and nothing else.
    const rest = tools.filter((t) => !t.name.startsWith('simulate_')).map((t) => t.name).sort();
    assert.deepEqual(rest, [
      'get_simulation_result',
      'get_simulation_status',
      'list_simulation_tools',
      'run_simulation',
      'submit_simulation',
    ]);
  } finally {
    await harness.close();
  }
});

test('the published schema carries ranges, enums and defaults from the contract', async () => {
  const harness = await connectedServer({ apiKey: '' });
  try {
    const { tools } = await harness.client.listTools();
    const eye = tools.find((t) => t.name === 'simulate_eye_diagram');
    assert.equal(eye.inputSchema.properties.samplesPerUI.minimum, 16);
    assert.equal(eye.inputSchema.properties.samplesPerUI.maximum, 128);
    // No `default` in the published schema: a zod default is applied on parse,
    // which would post the key whether or not the caller named it. The value
    // is in the description instead.
    assert.equal(eye.inputSchema.properties.samplesPerUI.default, undefined);
    assert.ok(eye.inputSchema.properties.samplesPerUI.description.includes('64'));
    assert.deepEqual(eye.inputSchema.properties.prbs.enum, ['prbs7', 'prbs15', 'prbs31']);
    // A file-input job type offers both ways to give it a file.
    assert.ok(eye.inputSchema.properties.inputFiles);
    assert.ok(eye.inputSchema.properties.inputPaths);
    // A job type that takes no files offers neither.
    const pdn = tools.find((t) => t.name === 'simulate_pdn_impedance');
    assert.ok(!pdn.inputSchema.properties.inputFiles);
  } finally {
    await harness.close();
  }
});

test('a call with an unknown key is refused by the server before any request', async () => {
  const harness = await connectedServer({
    apiKey: '',
    api: undefined,
  });
  try {
    const result = await harness.client.callTool({
      name: 'simulate_pdn_impedance',
      arguments: { boardWidth_mm: 100, bogusKey: 7 },
    });
    assert.equal(result.isError, true);
    const text = textOf(result);
    assert.ok(text.includes('bogusKey'), text);
    assert.ok(text.includes('boardWidth_mm'), text);
  } finally {
    await harness.close();
  }
});

test('every published count comes from the index', async () => {
  const harness = await connectedServer({ apiKey: '' });
  try {
    const { tools } = await harness.client.listTools();
    const listTool = tools.find((t) => t.name === 'list_simulation_tools');
    assert.ok(listTool.description.includes(String(CONTRACT_COUNT)), listTool.description);

    const listed = jsonOf(await harness.client.callTool({ name: 'list_simulation_tools', arguments: {} }));
    assert.equal(listed.count, CONTRACT_COUNT);
    assert.equal(listed.tools.length, CONTRACT_COUNT);
    assert.deepEqual(
      listed.tools.map((t) => t.jobType).sort(),
      Object.keys(indexJson.jobTypes).sort(),
    );
    for (const entry of listed.tools) {
      assert.equal(entry.timeBudgetSeconds, indexJson.jobTypes[entry.jobType].timeoutSeconds);
      assert.equal(Boolean(entry.files), indexJson.jobTypes[entry.jobType].files);
    }
    assert.equal(listJobTypes().length, CONTRACT_COUNT);
  } finally {
    await harness.close();
  }
});
