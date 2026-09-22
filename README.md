# rftools-mcp

[![npm version](https://img.shields.io/npm/v/rftools-mcp)](https://www.npmjs.com/package/rftools-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-green)](https://modelcontextprotocol.io)

**MCP server for [rftools.io](https://rftools.io) — 241 RF & electronics calculators + 13 server-side simulation tools for AI agents.**

Give Claude, Cursor, or any MCP-compatible AI assistant access to validated engineering calculators and heavy server-side simulations. Microstrip impedance, link budgets, filter design, converter sizing, antenna patterns, and 200+ more calculators — plus NEC2 antenna simulation, FDTD, Monte Carlo, SMPS analysis, EMI estimation, and more, all callable as MCP tools.

## Quick Start

Calculators work with no API key, and so do the simulation tools: without one, a job runs on the free lane. A key raises the limits — sign up at [rftools.io](https://rftools.io) and generate one from your dashboard. The one thing a key is required for is a file: uploading a file needs an API key; set `RFTOOLS_API_KEY`.

## Setup

### Without API key

All 241 calculators run locally with no sign-up required, and every simulation tool that takes no file still submits — on the free lane, with the free limits and the free-lane parameter bounds stated on the response.

A job type that takes a file is the exception. Uploading a file needs an API key; set `RFTOOLS_API_KEY`. Without one, a call carrying `inputFiles` or `inputPaths` is refused here, with that sentence, before the file is read and before any request leaves this machine.

### With API key

Sign up at [rftools.io](https://rftools.io) and generate an API key from your [dashboard](https://rftools.io/dashboard). Free accounts include 5 simulation runs/month. Pro: 100/month. API tier: 10,000/month. A paid key also unlocks the modes the free lane cannot run: the antenna optimiser and the FDTD `normal` and `fine` meshes.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "rftools": {
      "command": "npx",
      "args": ["-y", "rftools-mcp"],
      "env": {
        "RFTOOLS_API_KEY": "rfc_your_key_here"
      }
    }
  }
}
```

Omit the `env` block to use calculators only. Restart Claude Desktop after saving.

### Claude Code

```bash
claude mcp add rftools-mcp -- npx -y rftools-mcp
```

To add your API key:

```bash
claude mcp add rftools-mcp -e RFTOOLS_API_KEY=rfc_your_key_here -- npx -y rftools-mcp
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "rftools": {
      "command": "npx",
      "args": ["-y", "rftools-mcp"],
      "env": {
        "RFTOOLS_API_KEY": "rfc_your_key_here"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "rftools": {
      "command": "npx",
      "args": ["-y", "rftools-mcp"],
      "env": {
        "RFTOOLS_API_KEY": "rfc_your_key_here"
      }
    }
  }
}
```

## Tools

### What changed in 2.0.0

- **One typed tool per job type.** Each of the 13 simulation job types now has
  its own `simulate_<jobType>` tool (e.g. `simulate_impedance_matching`) with a
  real input schema — name, type, unit, range, options and default per
  parameter — generated from the job type's parameter contract. `run_simulation`
  still exists as a compatibility form that takes `jobType` and `params`, but
  prefer the typed tool: it is the one an agent can read the schema of.
- **Uploads go through this server**, inline (`inputFiles: [{name, content}]`)
  or by path on this machine (`inputPaths`); a file-input job type needs
  `RFTOOLS_API_KEY` — see **Files** below.
- **`submit_simulation` / `get_simulation_status` / `get_simulation_result`**
  are the fire-and-forget primitives underneath `run_simulation` and the typed
  tools, for a caller that wants to submit, do other work, and poll later.
- **`run_simulation` is now bounded by `waitSeconds`** (default 90, maximum
  600): it submits, polls, and if the job has not finished by the bound it
  returns the job id, status, progress and stage rather than blocking further
  — the job keeps running, and a later `get_simulation_status` /
  `get_simulation_result` call picks it up.
- **Results are summarised by default** — `summary`, `warnings`, `provenance`,
  every scalar value, and long series described by length and extremes rather
  than listed in full. Pass `full: true` for the whole payload.
- **No defaults are posted.** A `simulate_*` call sends only the parameters
  you name; it no longer fills in the contract's defaults itself. Since a
  sampling job type's random seed is derived from the request body, omitting a
  parameter and sending it at its default are the same request to the solver
  but not the same body, and can draw a different sample. Set `randomSeed` to
  pin a run exactly.
- **Typed errors.** Failures are classified by the service's `errorKind`, not
  by matching message text — see **When something goes wrong** below.

**Breaking:**

- `list_simulation_tools` no longer carries a hand-written sentence describing
  each job type's parameters; it lists them as a plain array of names
  (`params: string[]`). Read a `simulate_*` tool's own input schema for the
  type, unit, range, options and default of each parameter.
- Unknown parameter keys are now refused locally, before any request leaves
  this machine — the same contract the service validates against, checked
  here first.

### Calculator tools — no API key required

#### `list_calculators`

List available calculators, optionally filtered by category.

```
"List all RF calculators"
"What antenna calculators are available?"
"Show me power electronics calculators"
```

**Parameters:**
- `category` (optional): `rf`, `pcb`, `power`, `signal`, `antenna`, `general`, `motor`, `protocol`, `emc`, `thermal`, `sensor`, `unit-conversion`, `audio`

#### `get_calculator_info`

Get detailed info about a calculator — inputs with units/defaults, outputs, and the formula used.

```
"What inputs does the microstrip impedance calculator need?"
"Show me the buck converter calculator parameters"
```

**Parameters:**
- `slug` (required): Calculator identifier (e.g. `"microstrip-impedance"`)

#### `run_calculation`

Run a calculator with specific inputs. Returns results with units and a link to the interactive version on rftools.io. Runs locally — instant, no quota consumed.

```
"Calculate microstrip impedance for a 0.3mm trace on 0.2mm Rogers RO4003C"
"What's the link budget for a 2.4 GHz link over 500m?"
"Size a buck converter: 12V in, 3.3V out, 2A"
```

**Parameters:**
- `slug` (required): Calculator identifier
- `inputs` (required): Object with input values, e.g. `{"traceWidth": 0.3, "substrateHeight": 0.2}`

---

### Simulation tools — no API key required unless the job takes a file

Server-side jobs that are too heavy for in-browser computation. Each of the 13 job types is its own tool, `simulate_<name>`, whose input schema is generated from that job type's parameter contract: every parameter typed, with its unit, range, options, default and any free-lane bound stated. A call is checked against that contract before anything is sent, so a wrong parameter name comes back naming the key and the keys that are accepted, and spends no quota.

**Quota:** Free: 5 runs/month · Pro: 100/month · API tier: 10,000/month. Without a key a job that takes no file still runs, on the free lane, and the response says which limits applied. A job that takes a file needs a key — see **Files** below.

**Waiting:** a `simulate_*` call submits and waits up to `waitSeconds` (default 90, maximum 600), polling immediately — a mode that finishes in a second costs no delay — and reporting progress to hosts that ask for it. On reaching the bound it returns the job id, status, progress and stage; the job keeps running, and `get_simulation_status` and `get_simulation_result` pick it up. `waitSeconds: 0` submits and returns at once.

**Results:** the default is a summary — the result's `summary`, `warnings` and `provenance`, every scalar value, and links — with series longer than 50 points described by their length and extremes rather than listed, so a 100 kB result arrives as about 6 kB. Pass `full: true` for the whole payload. The link to the stored result (`resultUrl`) is presigned and lives **15 minutes**; ask for the status again to mint a fresh one.

**Repeat submissions:** an identical submission inside **60 seconds** returns the job already running rather than starting a second one.

**Files:** a file-input job type takes either `inputFiles: [{name, content}]` (inline text, up to 5 MB in one call) or `inputPaths: ["/path/to/file.s2p"]` (read from this machine). The server obtains the presigned upload, sends the file, and submits the job with the resulting key.

Uploading a file needs an API key; set `RFTOOLS_API_KEY`. The service refuses an anonymous upload, so this server refuses it first — locally, before the file is read and before any request is made — and says which variable to set rather than passing back a bare 401. The uploaded object is recorded against the key's account, and only that account may submit it.

#### The 13 job types

| Tool | `jobType` | What it does | Files | Time budget | Paid-only / free-lane bound |
|------|-----------|--------------|-------|------------:|------------------------------|
| `simulate_antenna_sim` | `antenna_sim` | Wire Antenna Simulator (NEC-2) | — | 1200 s | `solveMode: optimize` |
| `simulate_emi_radiated` | `emi_radiated` | EMI Radiated Emissions Estimator | — | 240 s | — |
| `simulate_eye_diagram` | `eye_diagram` | Eye Diagram from S-Parameters | 1 × `.s2p` `.s4p` | 120 s | — |
| `simulate_fdtd_sparam` | `fdtd_sparam` | FDTD Transmission Line Simulator | — | 32400 s | `solveMode: normal`, `fine` |
| `simulate_filter_monte_carlo` | `filter_monte_carlo` | RF Filter Monte Carlo Analysis | — | 120 s | `monteCarloIterations` ≤ 500 |
| `simulate_impedance_matching` | `impedance_match` | Broadband Impedance Matching Synthesizer | 0–2 × `.s2p` | 120 s | — |
| `simulate_magnetics_optimizer` | `magnetics_optimizer` | Magnetics & Transformer Design Optimizer | — | 360 s | — |
| `simulate_pdn_impedance` | `pdn_impedance` | PDN Impedance Analyzer & Decoupling Capacitor Optimizer | — | 360 s | — |
| `simulate_radar_detection` | `radar_detection` | Radar Detection Performance Monte Carlo | — | 300 s | — |
| `simulate_rf_cascade` | `rf_cascade` | RF Cascade Budget Analyzer | 0–12 × `.s2p` | 180 s | — |
| `simulate_sat_link_budget` | `sat_link_budget` | Satellite & Terrestrial Link Budget | — | 240 s | — |
| `simulate_smps_control_loop` | `smps_control_loop` | SMPS Control Loop Stability Analyzer | — | 300 s | — |
| `simulate_sparam_pipeline` | `sparam_pipeline` | S-Parameter Analysis Pipeline | 1–4 × `.s1p`–`.s4p` | 120 s | — |

The time budget is the lane's cap, not an estimate: most jobs finish in 15–120 seconds, and queue wait may add more.

#### `list_simulation_tools`

Every job type with its tool name, parameter names, file rules, time budget and free-lane bounds — all read from the same contract the tools are generated from.

#### `submit_simulation`

Submit by job type and return at once with the job id, queue position and time budget. Takes `jobType`, `params`, and `inputFiles` / `inputPaths` for file-input job types — which need an API key; set `RFTOOLS_API_KEY`.

#### `get_simulation_status`

Progress, stage, queue position, start and finish times for a job id.

#### `get_simulation_result`

The finished result for a job id, summarised by default, whole with `full: true`.

#### `run_simulation`

The compatibility form of a `simulate_*` call: `jobType`, `params`, optional files (which need a key, as above), `waitSeconds` (default 90, max 600) and `full`. Prefer the typed `simulate_*` tool for the job you want — it is the one whose schema an agent can read.

```
"Analyse the PDN of a 100 × 80 mm four-layer board, port at the IC, target 10 mΩ"
"Run an eye diagram on this .s4p at 10 Gbps with PRBS-15"
"Synthesize a broadband matching network from 50Ω to 200Ω between 800–1200 MHz"
"Simulate a 3-element Yagi at 144 MHz and give me the pattern"
"Estimate radiated emissions from a 10 cm trace carrying 50 mA at 100 MHz"
```

#### When something goes wrong

Failures are classified by HTTP status and by the service's own error kind, never by matching text: an invalid key, a spent allowance, a rate limit with its retry time, a refused parameter (with the service's own detail, unchanged), a job too large for its lane, a mode the tier does not carry, a timeout and a service fault each read differently. Polling stops at once on a 4xx, and after five failures in a row that are not.

## Example Conversations

### PCB Design

> **You:** I need a 50-ohm microstrip on 1.6mm FR4 with 1oz copper. What trace width?
>
> **AI:** *Calls `run_calculation` with microstrip-impedance* → A trace width of ~2.9mm gives you 50.2 Ω on 1.6mm FR4 (εr=4.2). [View on rftools.io →](https://rftools.io/calculators/rf/microstrip-impedance)

### RF Link Budget

> **You:** Will my 100mW 915 MHz LoRa link work at 2km with 3dBi antennas?
>
> **AI:** *Calls `run_calculation` with rf-link-budget* → Received power: -72 dBm. With LoRa sensitivity at -137 dBm, you have 65 dB of link margin. Easily workable. [View on rftools.io →](https://rftools.io/calculators/rf/rf-link-budget)

### Power Electronics

> **You:** Design a buck converter: 24V input, 5V output, 3A load, 500kHz switching.
>
> **AI:** *Calls `run_calculation` with buck-converter* → Duty cycle: 20.8%, inductor: 17.4 μH, output cap: 22 μF. [View on rftools.io →](https://rftools.io/calculators/power/buck-converter)

## All 241 Calculators

| Category | Count | Examples |
|----------|------:|---------|
| **RF & Microwave** | 29 | Microstrip impedance, coplanar waveguide (CPW/GCPW), VSWR/return loss, Smith chart, link budget, noise figure cascade, radar range, free-space path loss, mixer spur |
| **PCB Design** | 36 | Trace width for current, controlled impedance, edge-coupled stripline pairs (symmetric, offset, embedded), differential via with stub loss, skin depth percentage, conductor-to-pad width, BGA breakout width, aperture diagonal, maximum pad diameter, effective dielectric constant, via step response, microvia current capacity, asymmetric (offset) stripline, dual stripline, broadside-coupled pair, differential pair, via calculator, crosstalk, critical trace length, fusing current, decoupling capacitor, padstack/annular ring, BGA land pad, conductor spacing, planar spiral inductor, embedded resistor, via voltage drop |
| **Power Electronics** | 21 | Buck converter, boost converter, flyback, LDO thermal, battery life, MOSFET dissipation, solar panel sizing |
| **Signal Processing** | 14 | Filter designer, ADC SNR, FFT bin resolution, PLL loop filter, BER/SNR, Johnson noise, rise time to bandwidth |
| **Antenna Design** | 8 | Dipole, patch, Yagi-Uda, horn, parabolic dish, loop, EIRP, beamwidth |
| **General Electronics** | 24 | Ohm's law, crystal PPM tolerance, op-amp gain, 555 timer, BJT bias, MOSFET operating point, Schmitt trigger, crystal load capacitance |
| **Motor Control** | 22 | DC motor speed, stepper, BLDC, servo, PID tuning, gear ratio, H-bridge selection, torque converter |
| **Communications** | 11 | UART baud rate, I2C pull-up, SPI timing, CAN bus, USB termination, RS-485, Ethernet, Modbus, LIN bus |
| **EMC/EMI** | 16 | Shielding effectiveness, EMI filter, ferrite bead, ESD/TVS diode, radiated emission estimate, common-mode choke |
| **Thermal** | 6 | Heatsink calculator, junction temperature, thermal via array, PCB trace temperature |
| **Sensor Interface** | 17 | NTC thermistor, RTD, thermocouple, Wheatstone bridge, load cell, photodiode, 4-20 mA loop transmitter |
| **Unit Conversion** | 19 | dBm↔Watts, rectangular↔polar, frequency↔wavelength, length (mm/mil/inch), AWG wire, capacitor code, temperature, inductance, data rate |
| **Audio Electronics** | 18 | Speaker crossover, room modes, headphone power, class-D efficiency, audio transformer, equalizer Q |

## Why Use This Instead of Asking the AI to Calculate?

LLMs are unreliable at arithmetic. They may:

- Use simplified formulas that omit corrections (e.g. copper thickness in microstrip)
- Confuse units (mils vs mm, dBm vs dBW)
- Accumulate rounding errors
- Confidently present wrong answers

This MCP server calls the **exact same validated calculator code** that runs on [rftools.io](https://rftools.io). Hammerstad-Jensen for microstrip, Friis for path loss, exact dB/linear conversions — real engineering formulas, not LLM approximations.

## How It Works

**Calculators** are bundled as pure TypeScript functions — no API calls, no network latency, no rate limits. The AI calls the function directly and gets instant results.

```
AI Agent ←stdio→ rftools-mcp ←direct call→ calculator function
```

**Simulation tools** run server-side on rftools.io infrastructure (AWS Lambda + SQS + EC2/Fargate workers). Their input schemas are generated at build time from the same parameter contract the website's forms are built from, so a contract change reaches the agent at the next release rather than through a hand-edited string. The server validates the call, uploads any files, submits the job, polls it within the wait bound while reporting progress, and returns a summarised result with a link to the whole payload.

```
AI Agent ←stdio→ rftools-mcp ←HTTPS (key optional)→ rftools.io API → SQS → worker
                                ←poll /v1/jobs/{id}←
                                ←result JSON from a 15-minute presigned link←
```

## Machine-Readable Documentation

- **[rftools.io/llms.txt](https://rftools.io/llms.txt)** — Summary with API info and MCP setup
- **[rftools.io/llms-full.txt](https://rftools.io/llms-full.txt)** — Complete listing of all 203 calculators with inputs, outputs, units, and URLs

## Links

- **Website:** [rftools.io](https://rftools.io)
- **npm:** [npmjs.com/package/rftools-mcp](https://www.npmjs.com/package/rftools-mcp)
- **Blog:** [rftools.io/blog](https://rftools.io/blog)
- **Announcement:** [rftools.io Now Speaks MCP](https://rftools.io/blog/rftools-mcp-server-ai-agents)

## License

MIT
