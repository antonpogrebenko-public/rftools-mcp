#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getAllCalculators, getCalculator, getCalculatorsByCategory } from '@/lib/calculators/registry';
import type { CalculatorCategory } from '@/lib/calculators/types';
import { CATEGORIES } from '@/lib/calculators/types';

const VALID_CATEGORIES = Object.keys(CATEGORIES) as CalculatorCategory[];

const API_BASE = process.env.RFTOOLS_API_BASE ?? 'https://rftools.io/api/py';
const API_KEY  = process.env.RFTOOLS_API_KEY ?? '';

// Max time to wait for a simulation result (10 min — queue + runtime)
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

// ── Simulation tool metadata ───────────────────────────────────────────────
const SIMULATION_TOOLS = [
  {
    slug: 'impedance-matching',
    jobType: 'impedance_match',
    title: 'Broadband Impedance Matching Synthesizer',
    description: 'Synthesize L, Pi, T, or ladder matching networks for broadband impedance transformation.',
    params: 'sourceR (Ω), sourceX (Ω), loadR (Ω), loadX (Ω), freqStart (Hz), freqStop (Hz), topology (L|Pi|T|ladder_2|ladder_3)',
  },
  {
    slug: 'filter-monte-carlo',
    jobType: 'filter_monte_carlo',
    title: 'RF Filter Monte Carlo Tolerance Analysis',
    description: 'Monte Carlo yield analysis for RF filters — passband ripple, stopband degradation, worst-case sensitivity.',
    params: 'filterType (butterworth|chebyshev|bessel|elliptic), order (int), frequency (Hz), ripple (dB), topology (lowpass|highpass|bandpass|bandstop), componentTolerance (%), monteCarloIterations (50–10000)',
  },
  {
    slug: 'eye-diagram',
    jobType: 'eye_diagram',
    title: 'Eye Diagram Generator',
    description: 'Generate eye diagrams from Touchstone S-parameter files with PRBS patterns, jitter, and ISI analysis.',
    params: 'inputFileKeys (uploaded .s2p/.s4p keys), dataRate (bps), prbs (PRBS-7|PRBS-15|PRBS-31), samplesPerUI (int)',
  },
  {
    slug: 'antenna-sim',
    jobType: 'antenna_sim',
    title: 'NEC2 Wire Antenna Simulator',
    description: 'NEC2 antenna simulation: radiation patterns, gain, impedance for dipoles, Yagis, and loops.',
    params: 'antennaType (dipole|yagi|loop), frequency (Hz), numElements (int, Yagi only), boomLength (m, Yagi only), height (m)',
  },
  {
    slug: 'sparam-pipeline',
    jobType: 'sparam_pipeline',
    title: 'S-Parameter Analysis Pipeline',
    description: 'Automated S-parameter analysis from Touchstone files: IL, RL, group delay, TDR, ripple.',
    params: 'inputFileKeys (uploaded .s2p/.s4p keys), analysisTypes (array: il|rl|group_delay|tdr|ripple)',
  },
  {
    slug: 'fdtd-sparam',
    jobType: 'fdtd_sparam',
    title: 'FDTD S-Parameter Simulator',
    description: 'FDTD electromagnetic simulation for vias and PCB discontinuities — S-parameters across frequency.',
    params: 'structure (via_single|via_differential|stripline_bend|coax_transition), frequency (Hz), meshDensity (coarse|normal|fine)',
  },
  {
    slug: 'smps-control-loop',
    jobType: 'smps_control_loop',
    title: 'SMPS Control Loop Stability Analyzer',
    description: 'Buck/boost/flyback control loop analysis: Bode plot, phase margin, gain margin, loop bandwidth.',
    params: 'topology (buck|boost|flyback), vin (V), vout (V), iout (A), fsw (Hz), l (H), cout (F), rload (Ω), compensationType (type2|type3)',
  },
  {
    slug: 'emi-radiated',
    jobType: 'emi_radiated',
    title: 'EMI Radiated Emissions Estimator',
    description: 'PCB radiated emissions vs FCC Part 15 / CISPR 32 limits with Monte Carlo confidence intervals.',
    params: 'traceLength (m), traceHeight (m), current (A), frequency (Hz), distance (m), numHarmonics (int), monteCarloRuns (int)',
  },
  {
    slug: 'magnetics-optimizer',
    jobType: 'magnetics_optimizer',
    title: 'Magnetics Optimizer (NSGA-II)',
    description: 'NSGA-II Pareto-optimal transformer/inductor design across 113 cores from TDK, Ferroxcube, Magnetics Inc., Micrometals.',
    params: 'designType (transformer|inductor), frequency (Hz), power (W), vin (V), vout (V, transformer), turns_ratio (float, transformer), inductance (H, inductor), population (int), generations (int)',
  },
  {
    slug: 'radar-detection',
    jobType: 'radar_detection',
    title: 'Radar Detection Probability Calculator',
    description: 'All five Swerling models, non-coherent pulse integration, ITU-R P.838 rain attenuation, Monte Carlo uncertainty bands, ROC curves.',
    params: 'pt (W), gt (dB), gr (dB), frequency (Hz), rcs (m²), range (m), noiseFigure (dB), bandwidth (Hz), numPulses (int), swerlingModel (0–4), rainRate (mm/hr)',
  },
  {
    slug: 'pdn-impedance',
    jobType: 'pdn_impedance',
    title: 'PDN Impedance Analyzer',
    description: 'Power delivery network impedance with plane-pair cavity resonance (Novak) and genetic algorithm decoupling optimizer.',
    params: 'planesX (m), planesY (m), planesSeparation (m), vrmR (Ω), vrmL (H), vrmC (F), targetImpedance (Ω), freqPoints (int), population (int), generations (int), capBudget (int)',
  },
  {
    slug: 'sat-link-budget',
    jobType: 'sat_link_budget',
    title: 'Satellite Link Budget (ITU-R)',
    description: 'Satellite/terrestrial link budget with ITU-R P.618 rain, P.676 gaseous, P.840 cloud models and Monte Carlo confidence intervals.',
    params: 'eirp (dBW), frequency (Hz), distance (m), gt (dB/K), bandwidth (Hz), elevation (deg), latitude (deg), availability (%), mcTrials (int)',
  },
  {
    slug: 'rf-cascade',
    jobType: 'rf_cascade',
    title: 'RF Cascade Budget with Monte Carlo',
    description: 'Friis noise figure, cascaded IIP3, P1dB, SFDR, and Monte Carlo yield for multi-stage RF chains.',
    params: 'stages (array of {type, gain, nf, iip3, p1db, tolerance}), frequency (Hz), temperature (K), mcTrials (int)',
  },
] as const;

type SimTool = typeof SIMULATION_TOOLS[number];

// ── HTTP helpers ───────────────────────────────────────────────────────────
async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// Poll interval: 5 s for first 2 min, 10 s after that
function pollInterval(elapsedMs: number): number {
  return elapsedMs < 120_000 ? 5_000 : 10_000;
}

const server = new McpServer({
  name: 'rftools',
  version: '1.2.0',
});

// --- list_calculators ---
server.registerTool(
  'list_calculators',
  {
    title: 'List Calculators',
    description:
      'List available RF & electronics calculators. Optionally filter by category: rf, pcb, power, signal, antenna, general, motor, protocol, emc, thermal, sensor, unit-conversion, audio.',
    inputSchema: z.object({
      category: z
        .string()
        .optional()
        .describe('Calculator category to filter by (e.g. rf, pcb, power)'),
    }),
  },
  async ({ category }) => {
    const calcs = category
      ? getCalculatorsByCategory(category as CalculatorCategory)
      : getAllCalculators();

    if (category && !VALID_CATEGORIES.includes(category as CalculatorCategory)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Unknown category "${category}". Valid categories: ${VALID_CATEGORIES.join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    const listing = calcs.map((c) => ({
      slug: c.slug,
      title: c.title,
      category: c.category,
      description: c.description,
    }));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(listing, null, 2),
        },
      ],
    };
  },
);

// --- get_calculator_info ---
server.registerTool(
  'get_calculator_info',
  {
    title: 'Get Calculator Info',
    description:
      'Get detailed information about a specific calculator including its inputs, outputs, and formula. Use this to understand what parameters a calculator needs before running it.',
    inputSchema: z.object({
      slug: z.string().describe('Calculator slug (e.g. "microstrip-impedance")'),
    }),
  },
  async ({ slug }) => {
    const calc = getCalculator(slug);
    if (!calc) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Calculator "${slug}" not found. Use list_calculators to see available calculators.`,
          },
        ],
        isError: true,
      };
    }

    const info = {
      slug: calc.slug,
      title: calc.title,
      category: calc.category,
      description: calc.description,
      inputs: calc.inputs.map((i) => ({
        key: i.key,
        label: i.label,
        unit: i.unit,
        defaultValue: i.defaultValue,
        min: i.min,
        max: i.max,
        tooltip: i.tooltip,
      })),
      outputs: calc.outputs.map((o) => ({
        key: o.key,
        label: o.label,
        unit: o.unit,
        tooltip: o.tooltip,
      })),
      formula: calc.formula.primary,
      keywords: calc.keywords,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  },
);

// --- run_calculation ---
server.registerTool(
  'run_calculation',
  {
    title: 'Run Calculation',
    description:
      'Run an RF/electronics calculator with the given inputs. Use get_calculator_info first to see required inputs.',
    inputSchema: z.object({
      slug: z.string().describe('Calculator slug (e.g. "microstrip-impedance")'),
      inputs: z
        .record(z.string(), z.number())
        .describe('Input values keyed by input name (e.g. {"traceWidth": 1.2, "substrateHeight": 1.6})'),
    }),
  },
  async ({ slug, inputs }) => {
    const calc = getCalculator(slug);
    if (!calc) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Calculator "${slug}" not found. Use list_calculators to see available calculators.`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = calc.calculate(inputs);

      const results = calc.outputs.map((o) => ({
        key: o.key,
        label: o.label,
        value: result.values[o.key],
        unit: o.unit,
      }));

      const webUrl = `https://rftools.io/calculators/${calc.category}/${calc.slug}`;

      const response: Record<string, unknown> = {
        slug: calc.slug,
        results,
        webUrl,
      };
      if (result.warnings?.length) response.warnings = result.warnings;
      if (result.errors?.length) response.errors = result.errors;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Calculation error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// --- list_simulation_tools ---
server.registerTool(
  'list_simulation_tools',
  {
    title: 'List Simulation Tools',
    description:
      'List the 13 server-side RF simulation tools available via API key. ' +
      'These require RFTOOLS_API_KEY (set in env). Free tier: 5 runs/month. Pro: 100/month. API tier: 10 000/month.',
    inputSchema: z.object({}),
  },
  async () => {
    const listing = SIMULATION_TOOLS.map((t) => ({
      slug: t.slug,
      jobType: t.jobType,
      title: t.title,
      description: t.description,
      params: t.params,
    }));
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(listing, null, 2) }],
    };
  },
);

// --- run_simulation ---
server.registerTool(
  'run_simulation',
  {
    title: 'Run Simulation Tool',
    description:
      'Submit a server-side RF simulation job and wait for the result. ' +
      'Requires RFTOOLS_API_KEY environment variable. ' +
      'Simulations typically complete in 15–120 seconds; queue wait may add more time. ' +
      'Use list_simulation_tools to see available jobTypes and required params.',
    inputSchema: z.object({
      jobType: z.string().describe(
        'Job type identifier (e.g. "impedance_match", "filter_monte_carlo", "emi_radiated"). ' +
        'Use list_simulation_tools to see all valid values.',
      ),
      params: z.record(z.string(), z.unknown()).describe(
        'Simulation parameters as key/value pairs. Use list_simulation_tools to see required params per jobType.',
      ),
    }),
  },
  async ({ jobType, params }) => {
    if (!API_KEY) {
      return {
        content: [{
          type: 'text' as const,
          text: 'RFTOOLS_API_KEY is not set. Add it to your MCP config:\n' +
                '  "env": { "RFTOOLS_API_KEY": "rfc_..." }\n' +
                'Get a key at https://rftools.io/dashboard',
        }],
        isError: true,
      };
    }

    const tool = SIMULATION_TOOLS.find((t) => t.jobType === jobType);
    if (!tool) {
      const valid = SIMULATION_TOOLS.map((t) => t.jobType).join(', ');
      return {
        content: [{
          type: 'text' as const,
          text: `Unknown jobType "${jobType}". Valid values: ${valid}`,
        }],
        isError: true,
      };
    }

    // Submit job
    let submitResp: { jobId: string; status: string; queuePosition?: number; queueTotal?: number };
    try {
      submitResp = (await apiPost('/v1/jobs', { jobType, params })) as typeof submitResp;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface quota-exceeded as a clear message
      if (msg.includes('401') || msg.includes('quota')) {
        return {
          content: [{
            type: 'text' as const,
            text: `API key error: ${msg}\nCheck your quota at https://rftools.io/dashboard`,
          }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: `Failed to submit job: ${msg}` }],
        isError: true,
      };
    }

    const { jobId } = submitResp;
    const started = Date.now();

    // Poll until completed, failed, or timeout
    while (true) {
      const elapsed = Date.now() - started;
      if (elapsed >= POLL_TIMEOUT_MS) {
        return {
          content: [{
            type: 'text' as const,
            text: `Simulation timed out after 10 minutes. Job ID: ${jobId}\n` +
                  `Check status at https://rftools.io/tools/${tool.slug}/results?jobId=${jobId}`,
          }],
          isError: true,
        };
      }

      await sleep(pollInterval(elapsed));

      let statusResp: {
        status: string;
        progress?: number;
        queuePosition?: number;
        queueTotal?: number;
        resultUrl?: string;
        errorMessage?: string;
      };
      try {
        statusResp = (await apiGet(`/v1/jobs/${jobId}`)) as typeof statusResp;
      } catch (err) {
        // Transient network error — keep polling
        console.error(`[rftools] poll error for ${jobId}:`, err);
        continue;
      }

      const { status, queuePosition, queueTotal, resultUrl, errorMessage, progress } = statusResp;

      if (status === 'queued') {
        const pos = queuePosition != null ? `position ${queuePosition}/${queueTotal ?? '?'}` : 'waiting';
        console.error(`[rftools] ${jobId} queued — ${pos} (+${Math.round(elapsed / 1000)}s elapsed)`);
        continue;
      }

      if (status === 'processing') {
        const pct = progress != null ? ` ${Math.round(progress * 100)}%` : '';
        console.error(`[rftools] ${jobId} processing${pct} (+${Math.round(elapsed / 1000)}s elapsed)`);
        continue;
      }

      if (status === 'failed') {
        return {
          content: [{
            type: 'text' as const,
            text: `Simulation failed: ${errorMessage ?? 'unknown error'}\nJob ID: ${jobId}`,
          }],
          isError: true,
        };
      }

      if (status === 'completed' && resultUrl) {
        // Fetch the actual result JSON from the presigned S3 URL
        let resultData: unknown;
        try {
          const res = await fetch(resultUrl);
          if (!res.ok) throw new Error(`Result fetch ${res.status}`);
          resultData = await res.json();
        } catch (err) {
          return {
            content: [{
              type: 'text' as const,
              text: `Job completed but result fetch failed: ${err instanceof Error ? err.message : String(err)}\n` +
                    `View at: https://rftools.io/tools/${tool.slug}/results?jobId=${jobId}`,
            }],
            isError: true,
          };
        }

        const webUrl = `https://rftools.io/tools/${tool.slug}/results?jobId=${jobId}`;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ jobId, jobType, tool: tool.title, webUrl, result: resultData }, null, 2),
          }],
        };
      }
    }
  },
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('rftools MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
