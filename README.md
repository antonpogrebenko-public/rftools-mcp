# rftools-mcp

[![npm version](https://img.shields.io/npm/v/rftools-mcp)](https://www.npmjs.com/package/rftools-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-green)](https://modelcontextprotocol.io)

**MCP server for [rftools.io](https://rftools.io) — 203 RF & electronics calculators + 13 server-side simulation tools for AI agents.**

Give Claude, Cursor, or any MCP-compatible AI assistant access to validated engineering calculators and heavy server-side simulations. Microstrip impedance, link budgets, filter design, converter sizing, antenna patterns, and 190+ more calculators — plus NEC2 antenna simulation, FDTD, Monte Carlo, SMPS analysis, EMI estimation, and more, all callable as MCP tools.

## Quick Start

Calculators work with no API key. For simulation tools, sign up at [rftools.io](https://rftools.io) and generate an API key from your dashboard.

## Setup

### Without API key — calculators only

All 203 calculators run locally with no sign-up required.

### With API key — calculators + simulation tools

Sign up at [rftools.io](https://rftools.io) and generate an API key from your [dashboard](https://rftools.io/dashboard). Free accounts include 5 simulation runs/month. Pro: 100/month. API tier: 10,000/month.

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

### Simulation tools — API key required

Server-side jobs that are too heavy for in-browser computation. Jobs run on shared compute (free tier) or a priority queue (Pro/API tier). Simulations typically complete in 15–120 seconds; queue wait may add additional time.

**Quota:** Free: 5 runs/month · Pro: 100/month · API tier: 10,000/month

#### `list_simulation_tools`

List all 13 available simulation tools with their `jobType` identifiers and parameter reference.

```
"What simulation tools are available?"
"Show me the RF simulation tools"
```

#### `run_simulation`

Submit a simulation job and wait for the result. Returns the full result JSON along with a link to the interactive results page on rftools.io.

```
"Synthesize a broadband matching network from 50Ω to 200Ω between 800–1200 MHz"
"Run a Monte Carlo tolerance analysis on a 2nd-order Butterworth low-pass filter at 1 GHz"
"Simulate a 3-element Yagi antenna at 144 MHz"
"Estimate radiated emissions from a 10cm trace carrying 50mA at 100 MHz"
"Run SMPS control loop stability analysis on my buck converter"
```

**Parameters:**
- `jobType` (required): Job type identifier — use `list_simulation_tools` to see all valid values
- `params` (required): Simulation parameters — use `list_simulation_tools` to see required params per job type

**Available simulation tools:**

| Tool | `jobType` |
|------|-----------|
| Broadband Impedance Matching Synthesizer | `impedance_match` |
| RF Filter Monte Carlo Tolerance Analysis | `filter_monte_carlo` |
| Eye Diagram Generator | `eye_diagram` |
| NEC2 Wire Antenna Simulator | `antenna_sim` |
| S-Parameter Analysis Pipeline | `sparam_pipeline` |
| FDTD S-Parameter Simulator | `fdtd_sparam` |
| SMPS Control Loop Stability Analyzer | `smps_control_loop` |
| EMI Radiated Emissions Estimator | `emi_radiated` |
| Magnetics Optimizer (NSGA-II) | `magnetics_optimizer` |
| Radar Detection Probability Calculator | `radar_detection` |
| PDN Impedance Analyzer | `pdn_impedance` |
| Satellite Link Budget (ITU-R) | `sat_link_budget` |
| RF Cascade Budget with Monte Carlo | `rf_cascade` |

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

## All 203 Calculators

| Category | Count | Examples |
|----------|------:|---------|
| **RF & Microwave** | 24 | Microstrip impedance, VSWR/return loss, Smith chart, link budget, noise figure cascade, radar range, free-space path loss, mixer spur |
| **PCB Design** | 13 | Trace width for current, differential pair, controlled impedance, via calculator, crosstalk, decoupling capacitor |
| **Power Electronics** | 20 | Buck converter, boost converter, flyback, LDO thermal, battery life, MOSFET dissipation, solar panel sizing |
| **Signal Processing** | 13 | Filter designer, ADC SNR, FFT bin resolution, PLL loop filter, BER/SNR, Johnson noise |
| **Antenna Design** | 8 | Dipole, patch, Yagi-Uda, horn, parabolic dish, loop, EIRP, beamwidth |
| **General Electronics** | 21 | Ohm's law, op-amp gain, 555 timer, BJT bias, MOSFET operating point, Schmitt trigger, crystal load capacitance |
| **Motor Control** | 18 | DC motor speed, stepper, BLDC, servo, PID tuning, gear ratio, H-bridge selection |
| **Communications** | 10 | UART baud rate, I2C pull-up, SPI timing, CAN bus, USB termination, RS-485, Ethernet, Modbus |
| **EMC/EMI** | 16 | Shielding effectiveness, EMI filter, ferrite bead, ESD/TVS diode, radiated emission estimate, common-mode choke |
| **Thermal** | 6 | Heatsink calculator, junction temperature, thermal via array, PCB trace temperature |
| **Sensor Interface** | 17 | NTC thermistor, RTD, thermocouple, Wheatstone bridge, load cell, photodiode, 4-20 mA loop transmitter |
| **Unit Conversion** | 17 | dBm↔Watts, frequency↔wavelength, AWG wire, capacitor code, temperature, inductance, data rate |
| **Audio Electronics** | 17 | Speaker crossover, room modes, headphone power, class-D efficiency, audio transformer, equalizer Q |

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

**Simulation tools** run server-side on rftools.io infrastructure (AWS Lambda + SQS + Fargate). The MCP server submits the job and polls until the result is ready, then returns the full result JSON inline.

```
AI Agent ←stdio→ rftools-mcp ←HTTPS + API key→ rftools.io API → SQS → worker
                                ←poll /jobs/{id}←
                                ←result JSON←
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
