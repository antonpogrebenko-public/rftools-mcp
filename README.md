# rftools-mcp

[![npm version](https://img.shields.io/npm/v/rftools-mcp)](https://www.npmjs.com/package/rftools-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-green)](https://modelcontextprotocol.io)

**MCP server for [rftools.io](https://rftools.io) — 197 RF & electronics calculators for AI agents.**

Give Claude, Cursor, or any MCP-compatible AI assistant access to validated engineering calculators. Microstrip impedance, link budgets, filter design, converter sizing, antenna patterns, and 190+ more — all callable as MCP tools.

## Quick Start

```bash
npx rftools-mcp
```

That's it. The server starts on stdio and is ready for connections.

## Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "rftools": {
      "command": "npx",
      "args": ["-y", "rftools-mcp"]
    }
  }
}
```

Restart Claude Desktop. You now have 197 calculators available.

### Claude Code

```bash
claude mcp add rftools-mcp -- npx -y rftools-mcp
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "rftools": {
      "command": "npx",
      "args": ["-y", "rftools-mcp"]
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
      "args": ["-y", "rftools-mcp"]
    }
  }
}
```

## Tools

### `list_calculators`

List available calculators, optionally filtered by category.

```
"List all RF calculators"
"What antenna calculators are available?"
"Show me power electronics calculators"
```

**Parameters:**
- `category` (optional): `rf`, `pcb`, `power`, `signal`, `antenna`, `general`, `motor`, `protocol`, `emc`, `thermal`, `sensor`, `unit-conversion`, `audio`

### `get_calculator_info`

Get detailed info about a calculator — inputs with units/defaults, outputs, and the formula used.

```
"What inputs does the microstrip impedance calculator need?"
"Show me the buck converter calculator parameters"
```

**Parameters:**
- `slug` (required): Calculator identifier (e.g. `"microstrip-impedance"`)

### `run_calculation`

Run a calculator with specific inputs. Returns results with units and a link to the interactive version on rftools.io.

```
"Calculate microstrip impedance for a 0.3mm trace on 0.2mm Rogers RO4003C"
"What's the link budget for a 2.4 GHz link over 500m?"
"Size a buck converter: 12V in, 3.3V out, 2A"
```

**Parameters:**
- `slug` (required): Calculator identifier
- `inputs` (required): Object with input values, e.g. `{"traceWidth": 0.3, "substrateHeight": 0.2}`

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

## All 197 Calculators

| Category | Count | Examples |
|----------|------:|---------|
| **RF & Microwave** | 21 | Microstrip impedance, VSWR/return loss, Smith chart, link budget, noise figure cascade, radar range, free-space path loss |
| **PCB Design** | 14 | Trace width for current, differential pair, controlled impedance, via calculator, crosstalk, decoupling capacitor |
| **Power Electronics** | 18 | Buck converter, boost converter, flyback, LDO thermal, battery life, MOSFET dissipation, solar panel sizing |
| **Signal Processing** | 14 | Filter designer, ADC SNR, FFT bin resolution, PLL loop filter, BER/SNR, Johnson noise |
| **Antenna Design** | 8 | Dipole, patch, Yagi-Uda, horn, parabolic dish, loop, EIRP, beamwidth |
| **General Electronics** | 16 | Ohm's law, op-amp gain, 555 timer, BJT bias, MOSFET operating point, Schmitt trigger, crystal load capacitance |
| **Motor Control** | 17 | DC motor speed, stepper, BLDC, servo, PID tuning, gear ratio, H-bridge selection |
| **Communications** | 10 | UART baud rate, I2C pull-up, SPI timing, CAN bus, USB termination, RS-485, Ethernet, Modbus |
| **EMC/EMI** | 14 | Shielding effectiveness, EMI filter, ferrite bead, ESD/TVS diode, radiated emission estimate, common-mode choke |
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

The server bundles all 197 calculator functions from rftools.io into a single file. Each calculator is a pure TypeScript function — no API calls, no network latency, no rate limits. The AI calls the function directly and gets instant, accurate results.

```
AI Agent ←stdio→ rftools-mcp ←direct call→ calculator function
```

## Machine-Readable Documentation

- **[rftools.io/llms.txt](https://rftools.io/llms.txt)** — Summary with API info and MCP setup
- **[rftools.io/llms-full.txt](https://rftools.io/llms-full.txt)** — Complete listing of all 197 calculators with inputs, outputs, units, and URLs

## Links

- **Website:** [rftools.io](https://rftools.io)
- **npm:** [npmjs.com/package/rftools-mcp](https://www.npmjs.com/package/rftools-mcp)
- **Blog:** [rftools.io/blog](https://rftools.io/blog)
- **Announcement:** [rftools.io Now Speaks MCP](https://rftools.io/blog/rftools-mcp-server-ai-agents)

## License

MIT
