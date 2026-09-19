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
    description: 'Monte Carlo yield for LC ladder filters against passband-variation and stopband-rejection limits that stay fixed as tolerance changes (yieldSpec reports them). An even-order Chebyshev is designed into its required load impedance, which the result reports.',
    params: 'filterType (butterworth|chebyshev1), bandType (lowpass|highpass), order (1–9), freqCutoff (Hz; -3 dB for Butterworth, ripple edge for Chebyshev), ripple (dB, Chebyshev), impedance (Ω), componentTolerance (%), toleranceDistribution (uniform|gaussian, 3σ = tolerance), rippleSpec_db (optional max passband variation; default: the standard-value design + 0.5 dB), rejectionSpec_db (optional min stopband rejection from 2·fc, or below fc/2 for high-pass; default: the standard-value design − 3 dB), monteCarloIterations (50–10000)',
  },
  {
    slug: 'eye-diagram',
    jobType: 'eye_diagram',
    title: 'Eye Diagram Generator',
    description: 'Eye diagram from a Touchstone S21: one full ITU-T O.150 PRBS period through the channel, with eye height, width and jitter measured over every bit. Width and jitter are null, with a reason, when the waveform has no crossings.',
    params: 'inputFileKeys (uploaded .s2p/.s4p keys), dataRate (bps), prbs (prbs7|prbs15|prbs31; prbs31 simulates 32768 bits), samplesPerUI (16–128)',
  },
  {
    slug: 'antenna-sim',
    jobType: 'antenna_sim',
    title: 'NEC-2 Wire Antenna Simulator',
    description: 'NEC-2 method-of-moments solve of any thin-wire antenna: impedance, VSWR, gain, directivity, efficiency, beamwidths, full pattern and currents, at one frequency or across a sweep; NSGA-II optimiser on Pro/API.',
    params: 'solveMode (standard|sweep|optimize|instant; optimize needs a Pro/API key). standard/sweep/optimize: wires (array of {start:[x,y,z] m, end:[x,y,z] m, radius m, segments}), feed ({wire, segment}, 0-based), freq (Hz) — or for sweep freqStart, freqStop (Hz), freqPoints (2–2001), ground ({type: free_space|perfect|finite, epsilonR, conductivity S/m}), conductor ({material: copper|aluminium|perfect|custom, conductivity S/m}), referenceImpedance (Ω, default 50); optimize adds optimize ({populationSize: multiple of 4, 8–200; generations: 1–200}) and randomSeed. Segments must be ≤ λ/10 and ≥ 8 radii; a job over the lane budget is refused with what to cut. instant (closed-form presets): antennaType (dipole|yagi3|yagi5|loop), freq (Hz), groundType (free_space|perfect|real)',
  },
  {
    slug: 'sparam-pipeline',
    jobType: 'sparam_pipeline',
    title: 'S-Parameter Analysis Pipeline',
    description: 'Fixed S-parameter pipeline on up to 4 Touchstone files: view, passivity check (violations ≤ 1.02 corrected, larger ones labelled active and left unmodified), ripple, TDR, time gating, mixed-mode (4-port), S→Z/Y/ABCD with undefined points reported, and cascade of 2-ports.',
    params: 'inputFileKeys (uploaded .s1p–.s4p keys), refImpedance (Ω), freqStart (Hz, 0 = file range), freqStop (Hz, 0 = file range)',
  },
  {
    slug: 'fdtd-sparam',
    jobType: 'fdtd_sparam',
    title: 'FDTD S-Parameter Simulator',
    description: 'PCB transmission-line structures — open stubs, coupled-line sections, via transitions, width steps — from a 2D cross-section in seconds to a 3D openEMS FDTD solve: S-parameters across frequency.',
    params: 'structureType (microstrip_open_stub|coupled_line_filter|through_via|step_discontinuity), solveMode (instant|express|normal|fine; normal and fine need a Pro/API key), substrateName (FR4|Rogers4350B|Rogers3003|custom), subEr, subH (mm), subTanD (custom substrate), traceW (mm), traceL (mm), stubL (mm, open stub), gapW (mm, coupled line), viaDia (mm), viaAR (through via), w2 (mm, step output width), freqCenter (Hz), freqSpan (Hz)',
  },
  {
    slug: 'smps-control-loop',
    jobType: 'smps_control_loop',
    title: 'SMPS Control Loop Stability Analyzer',
    description: 'Buck/boost/buck-boost/flyback loop stability: state-space-averaged plant in voltage mode, exact sampled-data model in peak-current mode, Bode plot, phase and gain margin, and Monte Carlo yield. Margins are reported only below Fsw/2; a subharmonic current loop is reported as such.',
    params: 'topology (buck|boost|buck_boost|flyback), controlMode (voltage_mode|peak_current), Vin (V), Vout (V), Iout (A), L (H), C (F), ESR (Ω), Fsw (Hz), Vramp (V, voltage mode), Rsense (Ω, peak current), externalRamp (Se/Sn, peak current, default 0), compensatorType (type1|type2|type3), compK, compFz1, compFz2, compFp1, compFp2 (Hz), monteCarloTrials, tolL, tolC, tolESR, tolLoad, tolRsense (%), toleranceDistribution (uniform|gaussian)',
  },
  {
    slug: 'emi-radiated',
    jobType: 'emi_radiated',
    title: 'EMI Radiated Emissions Estimator',
    description: 'PCB radiated emissions (Paul\'s DM loop and CM cable models, trapezoidal clock harmonics) vs FCC Part 15 and CISPR 32 limits in dBµV/m, with Monte Carlo confidence intervals.',
    params: 'standard (fcc_b|fcc_a|cispr32_b|cispr32_a), measDist (m), dmCurrent_mA, loopArea_cm2, cmCurrent_uA, cableLen_m, fClk_MHz, dutyCycle (%), tRise_ns, nTrials',
  },
  {
    slug: 'magnetics-optimizer',
    jobType: 'magnetics_optimizer',
    title: 'Magnetics Optimizer (NSGA-II)',
    description: 'NSGA-II Pareto front (every core seeded, de-duplicated) of transformer/inductor designs across 40 cores (104 core/material combinations) with core loss fitted to TDK, Ferroxcube and Micrometals data at the AC flux amplitude; designs on materials without traceable loss data are marked lossModel: unverified.',
    params: 'topology (flyback_xfmr|forward_xfmr|power_inductor), Vin (V), Vout (V), Iout (A), fSw (Hz), dutyCycle (0.05–0.9), Tamb (°C), Tmax (°C), inductance_uH and iPeak_A (forward_xfmr only; flyback and inductor derive them from the power), objectiveWeight (0 = min loss … 1 = min volume), population, generations',
  },
  {
    slug: 'radar-detection',
    jobType: 'radar_detection',
    title: 'Radar Detection Probability Calculator',
    description: 'All five Swerling models, non-coherent pulse integration, ITU-R P.838-3 rain attenuation, Monte Carlo uncertainty bands, ROC curves.',
    params: 'frequency_hz, peakPower_w, antGainTx_dbi, antGainRx_dbi, noiseFig_db, lossesTx_db, lossesRx_db, pulseWidth_s, nPulses, pfa, swerlingModel (0–4), targetRcs_dbsm, rangeMax_km, rainRate_mmhr',
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
    description: 'Satellite/terrestrial link budget with ITU-R P.618-13 rain, P.676-12 gas and P.840-8 cloud, climate read from the ITU-R maps at the site (latitude and longitude required), P.530-17 for terrestrial paths, and Monte Carlo confidence intervals.',
    params: 'linkType (satellite|terrestrial), frequency_ghz, eirp_dbw, gt_db_k, distance_km (slant range or path length), elevationAngle_deg (satellite, 5–90), latitude_deg (required, −90…90), longitude_deg (required, −180…180, east positive), stationHeight_km (optional, default ITU-R P.1511), polarization (horizontal|vertical|circular), modulation (bpsk|qpsk|8psk|16qam|64qam), reqEbN0_db, dataRate_bps, targetAvailability_pct (90 to <100)',
  },
  {
    slug: 'rf-cascade',
    jobType: 'rf_cascade',
    title: 'RF Cascade Budget with Monte Carlo',
    description: 'Friis noise figure, cascaded IIP3 and P1dB (from each stage\'s own P1dB), SFDR, and Monte Carlo yield for multi-stage RF chains.',
    params: 'stages (JSON array of {name, type: amp|filter|attenuator|mixer|switch, gain_db, nf_db, iip3_dbm, p1db_dbm}), inputPower_dbm, bandwidth_hz, analysisFreq_hz, nfSpec_db, gainSpec_db, iip3Spec_dbm, snrMin_db',
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
  version: '1.8.1',
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
      'List the 14 server-side RF simulation tools available via API key. ' +
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
