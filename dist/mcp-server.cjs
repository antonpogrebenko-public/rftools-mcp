#!/usr/bin/env node
#!/usr/bin/env node
"use strict";

// ../rftools-mcp/mcp-server.ts
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_zod = require("zod");

// src/lib/calculators/rf/microstrip-impedance.ts
function calculateMicrostrip(inputs) {
  const { traceWidth: w, substrateHeight: h, dielectricConstant: er, copperThickness } = inputs;
  const t = copperThickness / 1e3;
  const dw = t / Math.PI * (1 + Math.log(2 * h / t));
  const wEff = w + dw;
  const u = wEff / h;
  const a = 1 + 1 / 49 * Math.log((Math.pow(u, 4) + Math.pow(u / 52, 2)) / (Math.pow(u, 4) + 0.432)) + 1 / 18.7 * Math.log(1 + Math.pow(u / 18.1, 3));
  const b = 0.564 * Math.pow((er - 0.9) / (er + 3), 0.053);
  const erEff = (er + 1) / 2 + (er - 1) / 2 * Math.pow(1 + 10 / u, -a * b);
  const F = 6 + (2 * Math.PI - 6) * Math.exp(-Math.pow(30.666 / u, 0.7528));
  const z0 = 60 / Math.sqrt(erEff) * Math.log(F / u + Math.sqrt(1 + 4 / (u * u)));
  const c = 299.792458;
  const tpd = 1 / c * Math.sqrt(erEff) * 1e3;
  return {
    values: {
      impedance: Math.round(z0 * 100) / 100,
      effectiveDielectric: Math.round(erEff * 1e3) / 1e3,
      propagationDelay: Math.round(tpd * 100) / 100
    }
  };
}
var microstripImpedance = {
  slug: "microstrip-impedance",
  title: "Microstrip Impedance Calculator",
  shortTitle: "Microstrip Impedance",
  category: "rf",
  description: "Calculate microstrip transmission line impedance using Hammerstad-Jensen equations. Get Z\u2080, effective dielectric constant, and propagation delay for PCB trace design.",
  keywords: ["microstrip impedance calculator", "pcb trace impedance", "microstrip Z0", "transmission line impedance", "pcb impedance", "characteristic impedance"],
  inputs: [
    {
      key: "traceWidth",
      label: "Trace Width",
      symbol: "W",
      unit: "mm",
      unitOptions: [
        { label: "mm", factor: 1 },
        { label: "mil", factor: 0.0254 },
        { label: "\u03BCm", factor: 1e-3 }
      ],
      defaultValue: 1.2,
      min: 0.01,
      max: 50,
      step: 0.01,
      tooltip: "Width of the copper trace on top of the substrate"
    },
    {
      key: "substrateHeight",
      label: "Substrate Height",
      symbol: "H",
      unit: "mm",
      unitOptions: [
        { label: "mm", factor: 1 },
        { label: "mil", factor: 0.0254 }
      ],
      defaultValue: 1.6,
      min: 0.05,
      max: 10,
      step: 0.01,
      tooltip: "Dielectric thickness between trace and ground plane"
    },
    {
      key: "dielectricConstant",
      label: "Dielectric Constant",
      symbol: "\u03B5\u1D63",
      unit: "",
      defaultValue: 4.2,
      min: 1,
      max: 100,
      step: 0.01,
      tooltip: "Relative permittivity of the substrate material",
      presets: [
        { label: "FR4 (4.2)", values: { dielectricConstant: 4.2 } },
        { label: "FR4-HF (4.0)", values: { dielectricConstant: 4 } },
        { label: "Rogers 4003C (3.38)", values: { dielectricConstant: 3.38 } },
        { label: "Rogers 4350B (3.48)", values: { dielectricConstant: 3.48 } },
        { label: "PTFE/Rogers 5880 (2.2)", values: { dielectricConstant: 2.2 } },
        { label: "Alumina 96% (9.6)", values: { dielectricConstant: 9.6 } }
      ]
    },
    {
      key: "copperThickness",
      label: "Copper Thickness",
      symbol: "T",
      unit: "\u03BCm",
      defaultValue: 35,
      min: 1,
      max: 200,
      step: 1,
      tooltip: "Thickness of the copper trace",
      presets: [
        { label: "\xBD oz (17.5 \u03BCm)", values: { copperThickness: 17.5 } },
        { label: "1 oz (35 \u03BCm)", values: { copperThickness: 35 } },
        { label: "2 oz (70 \u03BCm)", values: { copperThickness: 70 } }
      ]
    }
  ],
  outputs: [
    {
      key: "impedance",
      label: "Characteristic Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      thresholds: {
        good: { min: 45, max: 55 },
        warning: { min: 40, max: 60 }
      }
    },
    {
      key: "effectiveDielectric",
      label: "Effective Dielectric",
      symbol: "\u03B5eff",
      unit: "",
      precision: 3,
      format: "standard"
    },
    {
      key: "propagationDelay",
      label: "Propagation Delay",
      symbol: "tpd",
      unit: "ps/mm",
      precision: 2,
      format: "standard"
    }
  ],
  calculate: calculateMicrostrip,
  formula: {
    primary: "Z_0 = \\frac{60}{\\sqrt{\\varepsilon_{eff}}} \\ln\\!\\left(\\frac{F}{u} + \\sqrt{1 + \\frac{4}{u^2}}\\right)",
    latex: "Z_0 = \\frac{87}{\\sqrt{\\varepsilon_r + 1.41}} \\ln\\left(\\frac{5.98h}{0.8w + t}\\right)",
    variables: [
      { symbol: "u", description: "Effective width/height ratio (W/H)", unit: "" },
      { symbol: "\u03B5eff", description: "Effective dielectric constant", unit: "" },
      { symbol: "F", description: "Hammerstad-Jensen correction factor", unit: "" }
    ],
    reference: 'Hammerstad & Jensen (1980); Wadell, "Transmission Line Design Handbook" 1991'
  },
  visualization: { type: "cross-section", layers: ["trace", "substrate", "ground"] },
  relatedCalculators: ["vswr-return-loss", "trace-width-current", "rf-link-budget"],
  verificationData: [
    {
      // 50Ω on FR4 1.6mm: ~3.1mm wide per Hammerstad-Jensen (±5% between tools is normal)
      inputs: { traceWidth: 3.1, substrateHeight: 1.6, dielectricConstant: 4.2, copperThickness: 35 },
      expectedOutputs: { impedance: 50 },
      tolerance: 0.05,
      source: "Hammerstad-Jensen reference calculation, Wadell 1991"
    },
    {
      // High-Z narrow trace on thin substrate
      inputs: { traceWidth: 0.254, substrateHeight: 0.254, dielectricConstant: 4.2, copperThickness: 35 },
      expectedOutputs: { impedance: 64.5 },
      tolerance: 0.05,
      source: "Polar Instruments IPC benchmark"
    },
    {
      // Lower Z₀ with wider trace
      inputs: { traceWidth: 5, substrateHeight: 1.6, dielectricConstant: 4.2, copperThickness: 35 },
      expectedOutputs: { impedance: 36.9 },
      tolerance: 0.02,
      source: "Hammerstad-Jensen formula self-consistency (W/H=3.125)"
    }
  ]
};

// src/lib/calculators/rf/rf-link-budget.ts
function calculateLinkBudget(inputs) {
  const {
    txPower,
    txGain,
    txCableLoss,
    frequency,
    distance,
    rainFade,
    atmosphericLoss,
    pointingLoss,
    rxGain,
    rxCableLoss,
    rxSensitivity
  } = inputs;
  const c = 3e8;
  const lambda = c / (frequency * 1e6);
  const distM = distance * 1e3;
  const fspl = 20 * Math.log10(4 * Math.PI * distM / lambda);
  const totalAdditionalLoss = rainFade + atmosphericLoss + pointingLoss;
  const eirp = txPower + txGain - txCableLoss;
  const rxPower = eirp - fspl - totalAdditionalLoss + rxGain - rxCableLoss;
  const linkMargin2 = rxPower - rxSensitivity;
  const maxRangeM = lambda / (4 * Math.PI) * Math.pow(10, (eirp - totalAdditionalLoss + rxGain - rxCableLoss - rxSensitivity) / 20);
  const maxRangeKm = maxRangeM / 1e3;
  return {
    values: {
      fspl: Math.round(fspl * 100) / 100,
      eirp: Math.round(eirp * 100) / 100,
      rxPower: Math.round(rxPower * 100) / 100,
      linkMargin: Math.round(linkMargin2 * 100) / 100,
      maxRangeKm: Math.round(maxRangeKm * 100) / 100,
      totalAdditionalLoss: Math.round(totalAdditionalLoss * 100) / 100
    }
  };
}
var rfLinkBudget = {
  slug: "rf-link-budget",
  title: "RF Link Budget Calculator",
  shortTitle: "Link Budget",
  category: "rf",
  description: "Calculate RF link budget: transmit power, free space path loss, antenna gains, and received signal level. Determine link margin and maximum range.",
  keywords: ["rf link budget calculator", "free space path loss", "fspl calculator", "link margin", "received signal level", "friis equation"],
  inputs: [
    { key: "txPower", label: "TX Power", symbol: "P\u209C\u2093", unit: "dBm", defaultValue: 30, min: -30, max: 100, group: "Transmitter", tooltip: "Transmitter output power" },
    { key: "txGain", label: "TX Antenna Gain", symbol: "G\u209C\u2093", unit: "dBi", defaultValue: 3, min: -30, max: 60, group: "Transmitter", tooltip: "TX antenna gain in dBi" },
    { key: "txCableLoss", label: "TX Cable Loss", symbol: "L\u209C\u2093", unit: "dB", defaultValue: 1, min: 0, max: 20, group: "Transmitter", tooltip: "TX cable + connector losses (positive value)" },
    { key: "frequency", label: "Frequency", symbol: "f", unit: "MHz", defaultValue: 2400, min: 0.1, max: 1e6, group: "Channel", tooltip: "Center frequency" },
    { key: "distance", label: "Distance", symbol: "d", unit: "km", defaultValue: 1, min: 1e-3, max: 1e6, group: "Channel", tooltip: "Distance between TX and RX" },
    { key: "rainFade", label: "Rain Fade", symbol: "L_rain", unit: "dB", defaultValue: 0, min: 0, max: 50, group: "Channel", tooltip: "Rain attenuation per ITU-R P.838. Use 0 for line-of-sight ground links; 3\u201320 dB for satellite links above 10 GHz in heavy rain zones." },
    { key: "atmosphericLoss", label: "Atmospheric Loss", symbol: "L_atm", unit: "dB", defaultValue: 0.5, min: 0, max: 20, group: "Channel", tooltip: "Gaseous absorption (O\u2082 at 60 GHz: ~15 dB/km; H\u2082O at 22 GHz: ~0.2 dB/km). Use 0.5 dB typical for sub-6 GHz terrestrial links." },
    { key: "pointingLoss", label: "Pointing Loss", symbol: "L_pt", unit: "dB", defaultValue: 0, min: 0, max: 10, group: "Channel", tooltip: "Antenna misalignment loss. Pencil-beam dishes: 0.5\u20133 dB. Omnidirectional or wide-beam antennas: 0 dB." },
    { key: "rxGain", label: "RX Antenna Gain", symbol: "G\u1D63\u2093", unit: "dBi", defaultValue: 3, min: -30, max: 60, group: "Receiver", tooltip: "RX antenna gain in dBi" },
    { key: "rxCableLoss", label: "RX Cable Loss", symbol: "L\u1D63\u2093", unit: "dB", defaultValue: 1, min: 0, max: 20, group: "Receiver", tooltip: "RX cable + connector losses" },
    { key: "rxSensitivity", label: "RX Sensitivity", symbol: "S\u1D63\u2093", unit: "dBm", defaultValue: -90, min: -160, max: 0, group: "Receiver", tooltip: "Minimum receivable signal level" }
  ],
  outputs: [
    {
      key: "fspl",
      label: "Free Space Path Loss",
      symbol: "FSPL",
      unit: "dB",
      precision: 2
    },
    {
      key: "eirp",
      label: "EIRP",
      symbol: "EIRP",
      unit: "dBm",
      precision: 2,
      tooltip: "Effective Isotropic Radiated Power"
    },
    {
      key: "rxPower",
      label: "Received Power",
      symbol: "P\u1D63\u2093",
      unit: "dBm",
      precision: 2
    },
    {
      key: "linkMargin",
      label: "Link Margin",
      symbol: "LM",
      unit: "dB",
      precision: 2,
      thresholds: {
        good: { min: 10 },
        warning: { min: 3 },
        danger: { min: 0 }
      }
    },
    {
      key: "maxRangeKm",
      label: "Max Range",
      symbol: "d_max",
      unit: "km",
      precision: 2
    },
    {
      key: "totalAdditionalLoss",
      label: "Total Additional Loss",
      symbol: "L_total",
      unit: "dB",
      precision: 2,
      tooltip: "Sum of rain fade + atmospheric loss + pointing loss"
    }
  ],
  calculate: calculateLinkBudget,
  formula: {
    primary: "FSPL = 20\\log_{10}\\!\\left(\\frac{4\\pi d}{\\lambda}\\right)",
    latex: "P_r = P_t + G_t + G_r - FSPL - L_{misc}, \\quad FSPL = 20\\log_{10}\\left(\\frac{4\\pi d f}{c}\\right)",
    variables: [
      { symbol: "d", description: "Distance", unit: "m" },
      { symbol: "\u03BB", description: "Wavelength (c/f)", unit: "m" },
      { symbol: "EIRP", description: "P\u209C\u2093 + G\u209C\u2093 \u2212 L\u209C\u2093", unit: "dBm" },
      { symbol: "P\u1D63\u2093", description: "EIRP \u2212 FSPL \u2212 L_rain \u2212 L_atm \u2212 L_pt + G\u1D63\u2093 \u2212 L\u1D63\u2093", unit: "dBm" },
      { symbol: "L_rain", description: "Rain fade (ITU-R P.838)", unit: "dB" },
      { symbol: "L_atm", description: "Atmospheric / gaseous absorption", unit: "dB" },
      { symbol: "L_pt", description: "Antenna pointing / misalignment loss", unit: "dB" }
    ],
    reference: 'Friis, "A Note on a Simple Transmission Formula" (1946)'
  },
  visualization: { type: "signal-chain" },
  relatedCalculators: ["db-converter", "vswr-return-loss", "eirp-calculator", "free-space-path-loss"],
  verificationData: [
    {
      inputs: { txPower: 0, txGain: 0, txCableLoss: 0, frequency: 2400, distance: 1, rxGain: 0, rxCableLoss: 0, rxSensitivity: -100, rainFade: 0, atmosphericLoss: 0, pointingLoss: 0 },
      expectedOutputs: { fspl: 100.05 },
      tolerance: 0.01,
      source: "Friis equation: FSPL at 2.4 GHz, 1 km \u2248 100 dB"
    }
  ],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ]
};

// src/lib/calculators/rf/vswr-return-loss.ts
function calculateVSWR(inputs) {
  const { vswr } = inputs;
  if (vswr < 1) {
    return { values: {}, errors: ["VSWR must be \u2265 1"] };
  }
  const gamma = (vswr - 1) / (vswr + 1);
  const returnLoss = gamma > 0 ? -20 * Math.log10(gamma) : Infinity;
  const mismatchLoss = -10 * Math.log10(1 - gamma * gamma);
  const reflectedPct = gamma * gamma * 100;
  const transmittedPct = (1 - gamma * gamma) * 100;
  return {
    values: {
      gamma: Math.round(gamma * 1e4) / 1e4,
      returnLoss: Math.round(returnLoss * 100) / 100,
      mismatchLoss: Math.round(mismatchLoss * 1e3) / 1e3,
      reflectedPct: Math.round(reflectedPct * 100) / 100,
      transmittedPct: Math.round(transmittedPct * 100) / 100
    }
  };
}
var vswrReturnLoss = {
  slug: "vswr-return-loss",
  title: "VSWR & Return Loss Calculator",
  shortTitle: "VSWR / Return Loss",
  category: "rf",
  description: "Convert between VSWR, return loss, reflection coefficient, mismatch loss, and reflected/transmitted power percentage for RF impedance matching.",
  keywords: ["vswr calculator", "return loss calculator", "reflection coefficient", "mismatch loss", "vswr to return loss", "rf impedance matching"],
  inputs: [
    {
      key: "vswr",
      label: "VSWR",
      symbol: "VSWR",
      unit: ":1",
      defaultValue: 1.5,
      min: 1,
      max: 100,
      step: 0.01,
      tooltip: "Voltage Standing Wave Ratio (1:1 = perfect match)",
      presets: [
        { label: "Perfect (1.0:1)", values: { vswr: 1.001 } },
        { label: "Excellent (1.1:1)", values: { vswr: 1.1 } },
        { label: "Good (1.5:1)", values: { vswr: 1.5 } },
        { label: "Marginal (2:1)", values: { vswr: 2 } },
        { label: "Poor (3:1)", values: { vswr: 3 } }
      ]
    }
  ],
  outputs: [
    {
      key: "returnLoss",
      label: "Return Loss",
      symbol: "RL",
      unit: "dB",
      precision: 2,
      thresholds: {
        good: { min: 20 },
        warning: { min: 10 }
      }
    },
    {
      key: "gamma",
      label: "Reflection Coefficient",
      symbol: "|\u0393|",
      unit: "",
      precision: 4,
      thresholds: {
        good: { max: 0.1 },
        warning: { max: 0.316 }
      }
    },
    {
      key: "mismatchLoss",
      label: "Mismatch Loss",
      symbol: "ML",
      unit: "dB",
      precision: 3,
      thresholds: {
        good: { max: 0.044 },
        warning: { max: 0.5 }
      }
    },
    {
      key: "reflectedPct",
      label: "Reflected Power",
      unit: "%",
      precision: 2
    },
    {
      key: "transmittedPct",
      label: "Transmitted Power",
      unit: "%",
      precision: 2
    }
  ],
  calculate: calculateVSWR,
  formula: {
    primary: "|\\Gamma| = \\frac{VSWR - 1}{VSWR + 1}, \\quad RL = -20 \\log_{10}|\\Gamma|",
    latex: "\\text{VSWR} = \\frac{1+|\\Gamma|}{1-|\\Gamma|}, \\quad RL = -20\\log_{10}|\\Gamma|",
    variables: [
      { symbol: "|\u0393|", description: "Magnitude of reflection coefficient", unit: "" },
      { symbol: "VSWR", description: "Voltage Standing Wave Ratio", unit: ":1" },
      { symbol: "RL", description: "Return Loss", unit: "dB" }
    ],
    reference: 'Pozar, "Microwave Engineering" 4th ed., Chapter 2'
  },
  visualization: { type: "none" },
  relatedCalculators: ["microstrip-impedance", "rf-link-budget", "db-converter"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ],
  verificationData: [
    {
      inputs: { vswr: 1 },
      expectedOutputs: { gamma: 0, reflectedPct: 0, transmittedPct: 100 },
      tolerance: 1e-3,
      source: "Trivial: perfect match"
    },
    {
      inputs: { vswr: 2 },
      expectedOutputs: { returnLoss: 9.54, gamma: 0.3333, reflectedPct: 11.11 },
      tolerance: 0.01,
      source: "Pozar Table 2.3"
    },
    {
      inputs: { vswr: 1.5 },
      expectedOutputs: { returnLoss: 13.98, gamma: 0.2 },
      tolerance: 0.01,
      source: "Standard reference values"
    }
  ]
};

// src/lib/calculators/rf/db-converter.ts
function calculateDB(inputs) {
  const { dbm, impedance } = inputs;
  const dbw = dbm - 30;
  const watts = Math.pow(10, dbm / 10) / 1e3;
  const mwatts = watts * 1e3;
  const uwatts = watts * 1e6;
  const vrms = Math.sqrt(watts * impedance);
  const mvrms = vrms * 1e3;
  const dbuv = 20 * Math.log10(vrms * 1e6);
  return {
    values: {
      dbw: Math.round(dbw * 1e3) / 1e3,
      watts,
      mwatts: Math.round(mwatts * 1e4) / 1e4,
      uwatts: Math.round(uwatts * 100) / 100,
      vrms: Math.round(vrms * 1e5) / 1e5,
      mvrms: Math.round(mvrms * 100) / 100,
      dbuv: Math.round(dbuv * 100) / 100
    }
  };
}
var dbConverter = {
  slug: "db-converter",
  title: "dBm Power Converter",
  shortTitle: "dBm Converter",
  category: "rf",
  description: "Convert dBm to watts, milliwatts, dBW, dB\u03BCV, and volts RMS. Essential RF power unit conversion tool for signal levels and link budgets.",
  keywords: ["dbm to watts", "dbm converter", "power unit converter", "dbm to mw", "rf power converter", "dbm dBW"],
  inputs: [
    {
      key: "dbm",
      label: "Power Level",
      symbol: "P",
      unit: "dBm",
      defaultValue: 0,
      min: -150,
      max: 100,
      step: 0.1,
      tooltip: "Power in dBm (0 dBm = 1 mW)",
      presets: [
        { label: "1 W (+30 dBm)", values: { dbm: 30 } },
        { label: "100 mW (+20 dBm)", values: { dbm: 20 } },
        { label: "1 mW (0 dBm)", values: { dbm: 0 } },
        { label: "\u221210 dBm", values: { dbm: -10 } },
        { label: "\u221240 dBm (noise floor)", values: { dbm: -40 } },
        { label: "\u2212174 dBm (thermal noise)", values: { dbm: -174 } }
      ]
    },
    {
      key: "impedance",
      label: "System Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      defaultValue: 50,
      min: 1,
      max: 1e4,
      step: 1,
      tooltip: "Reference impedance for voltage conversion (typically 50\u03A9 or 75\u03A9)",
      presets: [
        { label: "50 \u03A9 (RF standard)", values: { impedance: 50 } },
        { label: "75 \u03A9 (cable TV)", values: { impedance: 75 } },
        { label: "600 \u03A9 (audio)", values: { impedance: 600 } }
      ]
    }
  ],
  outputs: [
    { key: "dbw", label: "Power", symbol: "P", unit: "dBW", precision: 3 },
    { key: "watts", label: "Power", symbol: "P", unit: "W", precision: 6, format: "engineering" },
    { key: "mwatts", label: "Power", symbol: "P", unit: "mW", precision: 4 },
    { key: "uwatts", label: "Power", symbol: "P", unit: "\u03BCW", precision: 2 },
    { key: "vrms", label: "Voltage", symbol: "V", unit: "V RMS", precision: 5 },
    { key: "mvrms", label: "Voltage", symbol: "V", unit: "mV RMS", precision: 2 },
    { key: "dbuv", label: "Voltage", symbol: "V", unit: "dB\u03BCV", precision: 2 }
  ],
  calculate: calculateDB,
  formula: {
    primary: "P_{dBm} = 10 \\log_{10}\\!\\left(\\frac{P_{mW}}{1\\,\\text{mW}}\\right)",
    latex: "P_{dBm} = 10\\log_{10}\\left(\\frac{P_{mW}}{1\\text{ mW}}\\right)",
    variables: [
      { symbol: "P_mW", description: "Power in milliwatts", unit: "mW" },
      { symbol: "P_dBm", description: "Power in dBm", unit: "dBm" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["vswr-return-loss", "rf-link-budget"],
  verificationData: [
    {
      inputs: { dbm: 0, impedance: 50 },
      expectedOutputs: { mwatts: 1, dbw: -30, vrms: 0.22361 },
      tolerance: 1e-3,
      source: "IEEE standard: 0 dBm = 1 mW"
    },
    {
      inputs: { dbm: 30, impedance: 50 },
      expectedOutputs: { watts: 1, mwatts: 1e3 },
      tolerance: 1e-4,
      source: "IEEE standard: 30 dBm = 1 W"
    }
  ]
};

// src/lib/calculators/rf/noise-figure-cascade.ts
function calculateNoiseFigureCascade(inputs) {
  const {
    stage1NF,
    stage1Gain,
    stage1IIP3,
    stage2NF,
    stage2Gain,
    stage2IIP3,
    stage3NF,
    stage3Gain,
    stage3IIP3,
    stage4NF,
    stage4Gain,
    stage4IIP3,
    numStages
  } = inputs;
  const n = Math.round(numStages);
  if (n < 1 || n > 4) {
    return { values: {}, errors: ["Number of stages must be between 1 and 4"] };
  }
  const F1 = Math.pow(10, stage1NF / 10);
  const G1 = Math.pow(10, stage1Gain / 10);
  const F2 = Math.pow(10, stage2NF / 10);
  const G2 = Math.pow(10, stage2Gain / 10);
  const F3 = Math.pow(10, stage3NF / 10);
  const G3 = Math.pow(10, stage3Gain / 10);
  const F4 = Math.pow(10, stage4NF / 10);
  let F_total = F1;
  if (n >= 2) F_total += (F2 - 1) / G1;
  if (n >= 3) F_total += (F3 - 1) / (G1 * G2);
  if (n >= 4) F_total += (F4 - 1) / (G1 * G2 * G3);
  const cascadedNF = 10 * Math.log10(F_total);
  const contrib1 = 10 * Math.log10(F1);
  const contrib2 = n >= 2 ? 10 * Math.log10(1 + (F2 - 1) / G1) : 0;
  const contrib3 = n >= 3 ? 10 * Math.log10(1 + (F3 - 1) / (G1 * G2)) : 0;
  const iip3_1_mW = Math.pow(10, stage1IIP3 / 10);
  const iip3_2_mW = Math.pow(10, stage2IIP3 / 10);
  const iip3_3_mW = Math.pow(10, stage3IIP3 / 10);
  const iip3_4_mW = Math.pow(10, stage4IIP3 / 10);
  let inv_iip3 = 1 / iip3_1_mW;
  if (n >= 2) inv_iip3 += G1 / iip3_2_mW;
  if (n >= 3) inv_iip3 += G1 * G2 / iip3_3_mW;
  if (n >= 4) inv_iip3 += G1 * G2 * G3 / iip3_4_mW;
  const iip3_total_mW = 1 / inv_iip3;
  const cascadedIIP3 = 10 * Math.log10(iip3_total_mW);
  let totalGain = stage1Gain;
  if (n >= 2) totalGain += stage2Gain;
  if (n >= 3) totalGain += stage3Gain;
  if (n >= 4) totalGain += stage4Gain;
  const cascadedOIP3 = cascadedIIP3 + totalGain;
  return {
    values: {
      cascadedNF: Math.round(cascadedNF * 1e4) / 1e4,
      cascadedF: Math.round(F_total * 1e4) / 1e4,
      stage1Contribution: Math.round(contrib1 * 1e4) / 1e4,
      stage2Contribution: Math.round(contrib2 * 1e4) / 1e4,
      stage3Contribution: Math.round(contrib3 * 1e4) / 1e4,
      cascadedIIP3: Math.round(cascadedIIP3 * 100) / 100,
      cascadedOIP3: Math.round(cascadedOIP3 * 100) / 100
    }
  };
}
var noiseFigureCascade = {
  slug: "noise-figure-cascade",
  title: "Cascaded Noise Figure Calculator",
  shortTitle: "Cascaded NF",
  category: "rf",
  description: "Calculate cascaded noise figure for a chain of RF stages using the Friis formula. Essential for LNA and receiver chain design.",
  keywords: ["noise figure calculator", "cascaded noise figure", "friis formula", "NF cascade", "receiver noise figure", "LNA design"],
  inputs: [
    {
      key: "numStages",
      label: "Number of Stages",
      symbol: "N",
      unit: "",
      defaultValue: 3,
      min: 1,
      max: 4,
      step: 1,
      tooltip: "Number of cascaded RF stages (1\u20134)",
      presets: [
        { label: "1 stage", values: { numStages: 1 } },
        { label: "2 stages", values: { numStages: 2 } },
        { label: "3 stages", values: { numStages: 3 } },
        { label: "4 stages", values: { numStages: 4 } }
      ]
    },
    {
      key: "stage1NF",
      label: "Stage 1 Noise Figure",
      symbol: "NF\u2081",
      unit: "dB",
      defaultValue: 1.5,
      min: 0,
      max: 30,
      step: 0.1,
      tooltip: "Noise figure of stage 1 (typically the LNA)",
      group: "Stage 1"
    },
    {
      key: "stage1Gain",
      label: "Stage 1 Gain",
      symbol: "G\u2081",
      unit: "dB",
      defaultValue: 15,
      min: -20,
      max: 40,
      step: 0.1,
      tooltip: "Gain of stage 1",
      group: "Stage 1"
    },
    {
      key: "stage1IIP3",
      label: "Stage 1 IIP3",
      symbol: "IIP3\u2081",
      unit: "dBm",
      defaultValue: -5,
      min: -40,
      max: 50,
      step: 0.5,
      tooltip: "Input third-order intercept point of stage 1 (LNA). Typical LNA: \u22125 to +10 dBm.",
      group: "Stage 1"
    },
    {
      key: "stage2NF",
      label: "Stage 2 Noise Figure",
      symbol: "NF\u2082",
      unit: "dB",
      defaultValue: 8,
      min: 0,
      max: 30,
      step: 0.1,
      tooltip: "Noise figure of stage 2 (e.g. mixer)",
      group: "Stage 2"
    },
    {
      key: "stage2Gain",
      label: "Stage 2 Gain",
      symbol: "G\u2082",
      unit: "dB",
      defaultValue: -6,
      min: -20,
      max: 40,
      step: 0.1,
      tooltip: "Gain of stage 2 (may be negative for a mixer)",
      group: "Stage 2"
    },
    {
      key: "stage2IIP3",
      label: "Stage 2 IIP3",
      symbol: "IIP3\u2082",
      unit: "dBm",
      defaultValue: 10,
      min: -40,
      max: 50,
      step: 0.5,
      tooltip: "Input third-order intercept point of stage 2 (e.g. mixer). Typical passive mixer: +10 to +20 dBm.",
      group: "Stage 2"
    },
    {
      key: "stage3NF",
      label: "Stage 3 Noise Figure",
      symbol: "NF\u2083",
      unit: "dB",
      defaultValue: 6,
      min: 0,
      max: 30,
      step: 0.1,
      tooltip: "Noise figure of stage 3 (e.g. IF amplifier)",
      group: "Stage 3"
    },
    {
      key: "stage3Gain",
      label: "Stage 3 Gain",
      symbol: "G\u2083",
      unit: "dB",
      defaultValue: 20,
      min: -20,
      max: 40,
      step: 0.1,
      tooltip: "Gain of stage 3",
      group: "Stage 3"
    },
    {
      key: "stage3IIP3",
      label: "Stage 3 IIP3",
      symbol: "IIP3\u2083",
      unit: "dBm",
      defaultValue: 20,
      min: -40,
      max: 50,
      step: 0.5,
      tooltip: "Input third-order intercept point of stage 3 (IF amplifier). Typical: +15 to +25 dBm.",
      group: "Stage 3"
    },
    {
      key: "stage4NF",
      label: "Stage 4 Noise Figure",
      symbol: "NF\u2084",
      unit: "dB",
      defaultValue: 3,
      min: 0,
      max: 30,
      step: 0.1,
      tooltip: "Noise figure of stage 4",
      group: "Stage 4"
    },
    {
      key: "stage4Gain",
      label: "Stage 4 Gain",
      symbol: "G\u2084",
      unit: "dB",
      defaultValue: 10,
      min: -20,
      max: 40,
      step: 0.1,
      tooltip: "Gain of stage 4",
      group: "Stage 4"
    },
    {
      key: "stage4IIP3",
      label: "Stage 4 IIP3",
      symbol: "IIP3\u2084",
      unit: "dBm",
      defaultValue: 25,
      min: -40,
      max: 50,
      step: 0.5,
      tooltip: "Input third-order intercept point of stage 4.",
      group: "Stage 4"
    }
  ],
  outputs: [
    {
      key: "cascadedNF",
      label: "Cascaded Noise Figure",
      symbol: "NF_total",
      unit: "dB",
      precision: 2,
      format: "standard",
      tooltip: "Total cascaded noise figure of the signal chain",
      thresholds: {
        good: { max: 3 },
        warning: { max: 6 }
      }
    },
    {
      key: "cascadedF",
      label: "Cascaded Noise Factor",
      symbol: "F_total",
      unit: "",
      precision: 4,
      format: "standard",
      tooltip: "Total cascaded noise factor (linear)"
    },
    {
      key: "stage1Contribution",
      label: "Stage 1 NF Contribution",
      symbol: "NF_c1",
      unit: "dB",
      precision: 2,
      format: "standard",
      tooltip: "Noise figure contribution from stage 1"
    },
    {
      key: "stage2Contribution",
      label: "Stage 2 NF Contribution",
      symbol: "NF_c2",
      unit: "dB",
      precision: 2,
      format: "standard",
      tooltip: "Noise figure contribution of stage 2 (referred to input)"
    },
    {
      key: "stage3Contribution",
      label: "Stage 3 NF Contribution",
      symbol: "NF_c3",
      unit: "dB",
      precision: 2,
      format: "standard",
      tooltip: "Noise figure contribution of stage 3 (referred to input)"
    },
    {
      key: "cascadedIIP3",
      label: "Cascaded IIP3",
      symbol: "IIP3_in",
      unit: "dBm",
      precision: 1,
      format: "standard",
      tooltip: "Input-referred third-order intercept point of the cascade. Higher is better (less intermodulation distortion).",
      thresholds: {
        good: { min: 10 },
        warning: { min: 0 }
      }
    },
    {
      key: "cascadedOIP3",
      label: "Cascaded OIP3",
      symbol: "OIP3_out",
      unit: "dBm",
      precision: 1,
      format: "standard",
      tooltip: "Output-referred third-order intercept point. OIP3 = IIP3 + cascaded gain."
    }
  ],
  calculate: calculateNoiseFigureCascade,
  schematicSections: (inputs) => {
    const n = Math.round(inputs.numStages);
    const names = ["LNA", "Mixer", "IF Amp", "Stage 4"];
    const elements = Array.from({ length: n }, (_, i) => ({
      type: "R",
      placement: "series",
      label: `${names[i]} NF=${inputs[`stage${i + 1}NF`]}dB`
    }));
    return [{ label: "RF Signal Chain", elements }];
  },
  formula: {
    primary: "F_{total} = F_1 + \\frac{F_2-1}{G_1} + \\frac{F_3-1}{G_1 G_2} + \\cdots",
    latex: "F_{total} = F_1 + \\frac{F_2-1}{G_1} + \\frac{F_3-1}{G_1 G_2} + \\cdots, \\quad \\frac{1}{\\mathrm{IIP3}_{in}} = \\frac{1}{\\mathrm{IIP3}_1} + \\frac{G_1}{\\mathrm{IIP3}_2} + \\cdots",
    variables: [
      { symbol: "F_n", description: "Noise factor of stage n (linear: 10^(NF_dB/10))", unit: "" },
      { symbol: "G_n", description: "Power gain of stage n (linear: 10^(Gain_dB/10))", unit: "" },
      { symbol: "NF", description: "Noise figure in dB: 10\xB7log\u2081\u2080(F)", unit: "dB" },
      { symbol: "IIP3_n", description: "Input IP3 of stage n (mW)", unit: "mW" },
      { symbol: "OIP3", description: "IIP3_total + cascaded gain", unit: "dBm" }
    ],
    reference: 'Friis, "Noise Figures of Radio Receivers" (1944); Pozar Chapter 10; Razavi "RF Microelectronics"'
  },
  visualization: { type: "none" },
  relatedCalculators: ["rf-link-budget", "db-converter", "intermodulation-distortion", "mixer-spur-calculator"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" }
  ],
  verificationData: [
    {
      inputs: { stage1NF: 0, stage1Gain: 100, stage2NF: 10, stage2Gain: 10, stage3NF: 10, stage3Gain: 10, stage4NF: 10, numStages: 2 },
      expectedOutputs: { cascadedNF: 0 },
      tolerance: 0.01,
      source: "Stage 1 perfect NF dominates with high gain"
    },
    {
      inputs: { stage1NF: 3, stage1Gain: 0, stage2NF: 3, stage2Gain: 10, stage3NF: 3, stage3Gain: 10, stage4NF: 3, numStages: 2 },
      expectedOutputs: { cascadedNF: 4.77 },
      tolerance: 0.01,
      source: "Friis: F=2+(2-1)/1=3 \u2192 4.77dB"
    }
  ]
};

// src/lib/calculators/rf/skin-depth.ts
function calculateSkinDepth(inputs) {
  const { frequency, conductivity, relativePermeability } = inputs;
  const f_Hz = frequency * 1e6;
  if (f_Hz <= 0) {
    return { values: {}, errors: ["Frequency must be greater than 0"] };
  }
  if (conductivity <= 0) {
    return { values: {}, errors: ["Conductivity must be greater than 0"] };
  }
  const mu0 = 4 * Math.PI * 1e-7;
  const mu = mu0 * relativePermeability;
  const skinDepthM = Math.sqrt(1 / (Math.PI * f_Hz * mu * conductivity));
  const skinDepthUm = skinDepthM * 1e6;
  const skinDepthNm = skinDepthM * 1e9;
  const surfaceResistanceOhm = 1 / (conductivity * skinDepthM);
  const surfaceResistanceMOhm = surfaceResistanceOhm * 1e3;
  return {
    values: {
      skinDepthUm: Math.round(skinDepthUm * 1e4) / 1e4,
      skinDepthNm: Math.round(skinDepthNm * 10) / 10,
      surfaceResistance: Math.round(surfaceResistanceMOhm * 1e4) / 1e4
    }
  };
}
var skinDepth = {
  slug: "skin-depth",
  title: "Skin Depth Calculator",
  shortTitle: "Skin Depth",
  category: "rf",
  description: "Calculate the skin depth (penetration depth) of electromagnetic fields in conductors as a function of frequency and material properties.",
  keywords: ["skin depth calculator", "penetration depth", "skin effect", "conductor loss", "rf skin depth", "electromagnetic skin depth"],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      unitOptions: [
        { label: "kHz", factor: 1e-3 },
        { label: "MHz", factor: 1 },
        { label: "GHz", factor: 1e3 }
      ],
      defaultValue: 1e3,
      min: 1e-3,
      max: 1e6,
      step: 1,
      tooltip: "Operating frequency",
      presets: [
        { label: "1 MHz", values: { frequency: 1 } },
        { label: "10 MHz", values: { frequency: 10 } },
        { label: "100 MHz", values: { frequency: 100 } },
        { label: "1 GHz", values: { frequency: 1e3 } },
        { label: "10 GHz", values: { frequency: 1e4 } }
      ]
    },
    {
      key: "conductivity",
      label: "Conductivity",
      symbol: "\u03C3",
      unit: "S/m",
      defaultValue: 58e6,
      min: 1e3,
      max: 1e8,
      step: 1e6,
      tooltip: "Electrical conductivity of the conductor material",
      presets: [
        { label: "Copper (5.8\xD710\u2077)", values: { conductivity: 58e6 } },
        { label: "Silver (6.3\xD710\u2077)", values: { conductivity: 63e6 } },
        { label: "Gold (4.1\xD710\u2077)", values: { conductivity: 41e6 } },
        { label: "Aluminum (3.5\xD710\u2077)", values: { conductivity: 35e6 } },
        { label: "Brass (1.5\xD710\u2077)", values: { conductivity: 15e6 } },
        { label: "Nickel (1.45\xD710\u2077)", values: { conductivity: 145e5 } }
      ]
    },
    {
      key: "relativePermeability",
      label: "Relative Permeability",
      symbol: "\u03BC\u1D63",
      unit: "",
      defaultValue: 1,
      min: 1,
      max: 1e5,
      step: 1,
      tooltip: "Relative magnetic permeability of the conductor (1 for non-magnetic materials)",
      presets: [
        { label: "Copper / Al / Au / Ag (1)", values: { relativePermeability: 1 } },
        { label: "Nickel (600)", values: { relativePermeability: 600 } },
        { label: "Iron (5000)", values: { relativePermeability: 5e3 } }
      ]
    }
  ],
  outputs: [
    {
      key: "skinDepthUm",
      label: "Skin Depth",
      symbol: "\u03B4",
      unit: "\u03BCm",
      precision: 4,
      format: "standard",
      tooltip: "Skin depth (1/e penetration depth) in micrometers"
    },
    {
      key: "skinDepthNm",
      label: "Skin Depth",
      symbol: "\u03B4",
      unit: "nm",
      precision: 1,
      format: "standard",
      tooltip: "Skin depth in nanometers"
    },
    {
      key: "surfaceResistance",
      label: "Surface Resistance",
      symbol: "R\u209B",
      unit: "m\u03A9/\u25A1",
      precision: 4,
      format: "standard",
      tooltip: "Sheet resistance of the conductor surface (Rs = 1/(\u03C3\xB7\u03B4))"
    }
  ],
  calculate: calculateSkinDepth,
  formula: {
    primary: "\\delta = \\sqrt{\\frac{2}{\\omega \\mu \\sigma}} = \\sqrt{\\frac{1}{\\pi f \\mu_0 \\mu_r \\sigma}}",
    variables: [
      { symbol: "\u03B4", description: "Skin depth", unit: "m" },
      { symbol: "\u03C9", description: "Angular frequency (2\u03C0f)", unit: "rad/s" },
      { symbol: "\u03BC", description: "Magnetic permeability (\u03BC\u2080\xB7\u03BC\u1D63)", unit: "H/m" },
      { symbol: "\u03C3", description: "Electrical conductivity", unit: "S/m" }
    ],
    reference: 'Griffiths, "Introduction to Electrodynamics" 4th ed., Chapter 9'
  },
  visualization: { type: "none" },
  relatedCalculators: ["microstrip-impedance", "trace-resistance"],
  verificationData: [
    {
      inputs: { frequency: 1e3, conductivity: 58e6, relativePermeability: 1 },
      expectedOutputs: { skinDepthUm: 2.09 },
      tolerance: 0.02,
      source: "Griffiths Table 9.2 / standard reference: copper at 1 GHz \u2248 2.09 \u03BCm"
    },
    {
      inputs: { frequency: 100, conductivity: 58e6, relativePermeability: 1 },
      expectedOutputs: { skinDepthUm: 6.61 },
      tolerance: 0.02,
      source: "Standard reference: copper at 100 MHz \u2248 6.61 \u03BCm"
    }
  ]
};

// src/lib/calculators/rf/wavelength-frequency.ts
function calculateWavelengthFrequency(inputs) {
  const { frequency, medium } = inputs;
  const f_Hz = frequency * 1e6;
  if (f_Hz <= 0) {
    return { values: {}, errors: ["Frequency must be greater than 0"] };
  }
  if (medium < 1) {
    return { values: {}, errors: ["Relative permittivity must be \u2265 1"] };
  }
  const c = 299792458;
  const wavelengthM = c / f_Hz;
  const wavelengthMm = wavelengthM * 1e3;
  const actualWavelengthMm = wavelengthMm / Math.sqrt(medium);
  const halfWaveMm = actualWavelengthMm / 2;
  const quarterWaveMm = actualWavelengthMm / 4;
  const wavenumber = 2 * Math.PI / (actualWavelengthMm * 1e-3);
  return {
    values: {
      wavelengthMm: Math.round(wavelengthMm * 1e4) / 1e4,
      actualWavelengthMm: Math.round(actualWavelengthMm * 1e4) / 1e4,
      halfWaveMm: Math.round(halfWaveMm * 1e4) / 1e4,
      quarterWaveMm: Math.round(quarterWaveMm * 1e4) / 1e4,
      wavenumber: Math.round(wavenumber * 100) / 100
    }
  };
}
var wavelengthFrequency = {
  slug: "wavelength-frequency",
  title: "Wavelength & Frequency Calculator",
  shortTitle: "Wavelength / Frequency",
  category: "rf",
  description: "Convert between frequency, wavelength, and wave number in free space or medium. Calculate half-wave and quarter-wave lengths for antenna and transmission line design.",
  keywords: ["wavelength calculator", "frequency wavelength calculator", "rf wavelength", "antenna wavelength", "half wavelength", "quarter wave"],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      unitOptions: [
        { label: "Hz", factor: 1e-3 },
        { label: "kHz", factor: 1e-3 },
        { label: "MHz", factor: 1 },
        { label: "GHz", factor: 1e3 }
      ],
      defaultValue: 2400,
      min: 1e-3,
      max: 1e6,
      step: 1,
      tooltip: "Operating frequency",
      presets: [
        { label: "AM radio (1 MHz)", values: { frequency: 1 } },
        { label: "FM radio (100 MHz)", values: { frequency: 100 } },
        { label: "2.4 GHz WiFi", values: { frequency: 2400 } },
        { label: "5 GHz WiFi", values: { frequency: 5e3 } },
        { label: "24 GHz radar", values: { frequency: 24e3 } },
        { label: "77 GHz radar", values: { frequency: 77e3 } }
      ]
    },
    {
      key: "medium",
      label: "Relative Permittivity",
      symbol: "\u03B5\u1D63",
      unit: "",
      defaultValue: 1,
      min: 1,
      max: 100,
      step: 0.01,
      tooltip: "Relative permittivity \u03B5\u1D63 of the medium (1 = free space/air)",
      presets: [
        { label: "Free space / Air (1.0)", values: { medium: 1 } },
        { label: "PTFE (2.1)", values: { medium: 2.1 } },
        { label: "Rogers 4003C (3.38)", values: { medium: 3.38 } },
        { label: "FR4 (4.2)", values: { medium: 4.2 } },
        { label: "Water (80)", values: { medium: 80 } }
      ]
    }
  ],
  outputs: [
    {
      key: "wavelengthMm",
      label: "Free-Space Wavelength",
      symbol: "\u03BB\u2080",
      unit: "mm",
      precision: 2,
      format: "standard",
      tooltip: "Wavelength in free space (air)"
    },
    {
      key: "actualWavelengthMm",
      label: "Wavelength in Medium",
      symbol: "\u03BB",
      unit: "mm",
      precision: 2,
      format: "standard",
      tooltip: "Wavelength in the specified dielectric medium"
    },
    {
      key: "halfWaveMm",
      label: "Half-Wave Length",
      symbol: "\u03BB/2",
      unit: "mm",
      precision: 2,
      format: "standard",
      tooltip: "Half-wavelength in medium (\u03BB/2 dipole reference)"
    },
    {
      key: "quarterWaveMm",
      label: "Quarter-Wave Length",
      symbol: "\u03BB/4",
      unit: "mm",
      precision: 2,
      format: "standard",
      tooltip: "Quarter-wavelength in medium (\u03BB/4 monopole / stub reference)"
    },
    {
      key: "wavenumber",
      label: "Wavenumber",
      symbol: "k",
      unit: "rad/m",
      precision: 2,
      format: "standard",
      tooltip: "Wave number k = 2\u03C0/\u03BB in the medium"
    }
  ],
  calculate: calculateWavelengthFrequency,
  formula: {
    primary: "\\lambda = \\frac{c}{f\\sqrt{\\varepsilon_r}}",
    variables: [
      { symbol: "\u03BB", description: "Wavelength in medium", unit: "m" },
      { symbol: "c", description: "Speed of light (299.792458 mm/ns)", unit: "m/s" },
      { symbol: "f", description: "Frequency", unit: "Hz" },
      { symbol: "\u03B5\u1D63", description: "Relative permittivity of medium", unit: "" }
    ],
    reference: 'Balanis, "Antenna Theory" 3rd ed.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["rf-link-budget", "microstrip-impedance"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ],
  verificationData: [
    {
      inputs: { frequency: 2400, medium: 1 },
      expectedOutputs: { wavelengthMm: 124.9 },
      tolerance: 5e-3,
      source: "c/f = 299.792/2.4GHz = 124.9 mm"
    },
    {
      inputs: { frequency: 1e3, medium: 1 },
      expectedOutputs: { wavelengthMm: 299.8 },
      tolerance: 5e-3,
      source: "c/f = 299.792/1GHz = 299.8 mm"
    }
  ]
};

// src/lib/calculators/rf/coax-impedance.ts
function calculateCoaxImpedance(inputs) {
  const { innerDiameter: d, outerDiameter: D, dielectricConstant: er } = inputs;
  if (d <= 0 || D <= 0) {
    return { values: {}, errors: ["Diameters must be greater than 0"] };
  }
  if (D <= d) {
    return { values: {}, errors: ["Outer diameter must be greater than inner diameter"] };
  }
  if (er < 1) {
    return { values: {}, errors: ["Dielectric constant must be \u2265 1"] };
  }
  const ratio = D / d;
  const lnRatio = Math.log(ratio);
  const impedance = 60 / Math.sqrt(er) * lnRatio;
  const eps0 = 8854187817e-21;
  const capacitancePFm = 2 * Math.PI * eps0 * er / lnRatio * 1e12;
  const mu0 = 4 * Math.PI * 1e-7;
  const inductanceNHm = mu0 / (2 * Math.PI) * lnRatio * 1e9;
  const velocityFactor = 1 / Math.sqrt(er);
  const c = 299792458;
  const D_m = D * 1e-3;
  const cutoffFreqGHz = c / (Math.PI * D_m * Math.sqrt(er)) * 1e-9;
  return {
    values: {
      impedance: Math.round(impedance * 100) / 100,
      capacitancePFm: Math.round(capacitancePFm * 100) / 100,
      inductanceNHm: Math.round(inductanceNHm * 100) / 100,
      velocityFactor: Math.round(velocityFactor * 1e4) / 1e4,
      cutoffFreqGHz: Math.round(cutoffFreqGHz * 100) / 100
    }
  };
}
var coaxImpedance = {
  slug: "coax-impedance",
  title: "Coaxial Cable Impedance Calculator",
  shortTitle: "Coax Impedance",
  category: "rf",
  description: "Calculate coaxial cable characteristic impedance, capacitance, inductance per unit length, and cutoff frequency from inner/outer conductor dimensions and dielectric.",
  keywords: ["coax impedance calculator", "coaxial cable impedance", "coax characteristic impedance", "rg-58", "transmission line calculator"],
  inputs: [
    {
      key: "innerDiameter",
      label: "Inner Conductor Diameter",
      symbol: "d",
      unit: "mm",
      unitOptions: [
        { label: "mm", factor: 1 },
        { label: "mil", factor: 0.0254 },
        { label: "in", factor: 25.4 }
      ],
      defaultValue: 0.9,
      min: 0.01,
      max: 100,
      step: 0.01,
      tooltip: "Outer diameter of the inner conductor",
      presets: [
        { label: "RG-58", values: { innerDiameter: 0.9, outerDiameter: 2.95, dielectricConstant: 2.3 } },
        { label: "RG-59", values: { innerDiameter: 0.584, outerDiameter: 3.66, dielectricConstant: 2.3 } },
        { label: "RG-174", values: { innerDiameter: 0.48, outerDiameter: 1.8, dielectricConstant: 2.3 } },
        { label: "RG-213", values: { innerDiameter: 2.26, outerDiameter: 7.24, dielectricConstant: 2.26 } },
        { label: "LMR-400", values: { innerDiameter: 2.74, outerDiameter: 8.13, dielectricConstant: 1.38 } }
      ]
    },
    {
      key: "outerDiameter",
      label: "Outer Conductor Inner Diameter",
      symbol: "D",
      unit: "mm",
      unitOptions: [
        { label: "mm", factor: 1 },
        { label: "mil", factor: 0.0254 },
        { label: "in", factor: 25.4 }
      ],
      defaultValue: 2.95,
      min: 0.1,
      max: 200,
      step: 0.01,
      tooltip: "Inner diameter of the outer conductor (shield)"
    },
    {
      key: "dielectricConstant",
      label: "Dielectric Constant",
      symbol: "\u03B5\u1D63",
      unit: "",
      defaultValue: 2.2,
      min: 1,
      max: 20,
      step: 0.01,
      tooltip: "Relative permittivity of the insulating dielectric between conductors",
      presets: [
        { label: "Air (1.0)", values: { dielectricConstant: 1 } },
        { label: "PTFE (2.2)", values: { dielectricConstant: 2.2 } },
        { label: "Polyethylene (2.25)", values: { dielectricConstant: 2.25 } },
        { label: "Foam PE (1.45)", values: { dielectricConstant: 1.45 } },
        { label: "PVC (3.5)", values: { dielectricConstant: 3.5 } }
      ]
    }
  ],
  outputs: [
    {
      key: "impedance",
      label: "Characteristic Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Characteristic impedance of the coaxial cable",
      thresholds: {
        good: { min: 48, max: 52 },
        warning: { min: 45, max: 80 }
      }
    },
    {
      key: "capacitancePFm",
      label: "Capacitance",
      symbol: "C",
      unit: "pF/m",
      precision: 2,
      format: "standard",
      tooltip: "Distributed capacitance per meter of cable length"
    },
    {
      key: "inductanceNHm",
      label: "Inductance",
      symbol: "L",
      unit: "nH/m",
      precision: 2,
      format: "standard",
      tooltip: "Distributed inductance per meter of cable length"
    },
    {
      key: "velocityFactor",
      label: "Velocity Factor",
      symbol: "VF",
      unit: "",
      precision: 4,
      format: "standard",
      tooltip: "Signal propagation speed as fraction of speed of light (1/sqrt(\u03B5\u1D63))"
    },
    {
      key: "cutoffFreqGHz",
      label: "TE11 Cutoff Frequency",
      symbol: "fc",
      unit: "GHz",
      precision: 2,
      format: "standard",
      tooltip: "Frequency above which higher-order modes can propagate (TE11 mode)"
    }
  ],
  calculate: calculateCoaxImpedance,
  formula: {
    primary: "Z_0 = \\frac{60}{\\sqrt{\\varepsilon_r}} \\ln\\!\\left(\\frac{D}{d}\\right)",
    variables: [
      { symbol: "D", description: "Inner diameter of outer conductor", unit: "mm" },
      { symbol: "d", description: "Outer diameter of inner conductor", unit: "mm" },
      { symbol: "\u03B5\u1D63", description: "Relative permittivity of dielectric", unit: "" }
    ],
    reference: 'Wadell, "Transmission Line Design Handbook" 1991, Chapter 3'
  },
  visualization: { type: "cross-section", layers: ["inner", "dielectric", "outer"] },
  relatedCalculators: ["microstrip-impedance", "vswr-return-loss"],
  verificationData: [
    {
      inputs: { innerDiameter: 0.9, outerDiameter: 2.95, dielectricConstant: 2.3 },
      expectedOutputs: { impedance: 46.97 },
      tolerance: 0.01,
      source: "Z\u2080 = (60/\u221A2.3)\xB7ln(2.95/0.9) = 46.97\u03A9"
    },
    {
      inputs: { innerDiameter: 1, outerDiameter: 3.73, dielectricConstant: 1 },
      expectedOutputs: { impedance: 78.98 },
      tolerance: 0.01,
      source: "60\xB7ln(3.73) = 78.98\u03A9 air-dielectric coax"
    }
  ]
};

// src/lib/calculators/rf/coax-loss.ts
var CABLES = [
  { name: "LMR-400", freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [0.66, 1.5, 2.15, 3.08, 4.69, 6.73, 9.8, 11.5] },
  { name: "LMR-240", freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [1.1, 2.5, 3.6, 5.1, 7.8, 11.2, 16.4, 19.4] },
  { name: "LMR-200", freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [1.5, 3.3, 4.8, 6.9, 10.5, 15.1, 22.1, 26] },
  { name: "LMR-100", freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [3.3, 7.5, 10.8, 15.5, 23.8, 34.5, 51.5, 61] },
  { name: "RG-58/U", freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [2.9, 6.8, 10, 14.6, 23, 34, 52, 64] },
  { name: "RG-8X", freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [1.8, 4.2, 6.1, 8.9, 13.7, 20.1, 31, 38] },
  { name: "RG-213/U", freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [1.4, 3.2, 4.7, 6.8, 10.5, 15.5, 23.5, 28.5] },
  { name: "RG-174/U", freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [5.6, 13.1, 19, 28, 44, 65, 100, 120] },
  { name: "Belden 9913", freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [0.75, 1.7, 2.5, 3.6, 5.5, 7.9, 11.6, 13.7] },
  { name: 'Andrew LDF4-50A (7/8")', freqs: [10, 50, 100, 200, 450, 900, 1800, 2400], loss: [0.22, 0.49, 0.7, 1.01, 1.55, 2.24, 3.32, 3.95] }
];
function interpolateLoss(cable, freqMHz) {
  const { freqs, loss } = cable;
  if (freqMHz <= freqs[0]) return loss[0];
  if (freqMHz >= freqs[freqs.length - 1]) return loss[loss.length - 1];
  for (let i = 0; i < freqs.length - 1; i++) {
    if (freqMHz >= freqs[i] && freqMHz <= freqs[i + 1]) {
      const t = Math.log(freqMHz / freqs[i]) / Math.log(freqs[i + 1] / freqs[i]);
      return loss[i] + t * (loss[i + 1] - loss[i]);
    }
  }
  return loss[loss.length - 1];
}
function calculateCoaxLoss(inputs) {
  const { cableIndex, frequencyMHz, lengthM } = inputs;
  if (lengthM <= 0) return { values: {}, errors: ["Length must be greater than 0"] };
  if (frequencyMHz <= 0) return { values: {}, errors: ["Frequency must be greater than 0"] };
  const idx = Math.round(cableIndex);
  const cable = CABLES[Math.min(Math.max(idx, 0), CABLES.length - 1)];
  const lossPer100m = interpolateLoss(cable, frequencyMHz);
  const attenuation_dB = lossPer100m * lengthM / 100;
  const powerRemaining_pct = Math.pow(10, -attenuation_dB / 10) * 100;
  const voltageRemaining_pct = Math.pow(10, -attenuation_dB / 20) * 100;
  return {
    values: {
      attenuation_dB,
      lossPer100m,
      powerRemaining_pct,
      voltageRemaining_pct
    }
  };
}
var coaxLoss = {
  slug: "coax-loss",
  title: "Coaxial Cable Loss Calculator",
  shortTitle: "Coax Loss",
  category: "rf",
  description: "Calculate RF attenuation for common coaxial cables (LMR-400, RG-58, RG-213, and more). Enter cable type, frequency, and run length to get insertion loss in dB.",
  keywords: ["coax", "cable", "attenuation", "loss", "LMR-400", "RG-58", "insertion loss", "RF cable"],
  inputs: [
    {
      key: "cableIndex",
      label: "Cable Type",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: CABLES.length - 1,
      step: 1,
      tooltip: `0=${CABLES[0].name}, 1=${CABLES[1].name}, ... ${CABLES.length - 1}=${CABLES[CABLES.length - 1].name}`,
      presets: CABLES.map((c, i) => ({ label: c.name, values: { cableIndex: i } }))
    },
    {
      key: "frequencyMHz",
      label: "Frequency",
      unit: "MHz",
      defaultValue: 435,
      min: 1,
      max: 6e3
    },
    {
      key: "lengthM",
      label: "Cable Length",
      unit: "m",
      defaultValue: 10,
      min: 0.1,
      max: 1e4
    }
  ],
  outputs: [
    {
      key: "attenuation_dB",
      label: "Insertion Loss",
      unit: "dB",
      precision: 2,
      primary: true,
      thresholds: {
        good: { max: 3 },
        warning: { min: 3, max: 10 },
        danger: { max: 10 }
      }
    },
    {
      key: "lossPer100m",
      label: "Loss per 100 m",
      unit: "dB/100m",
      precision: 2
    },
    {
      key: "powerRemaining_pct",
      label: "Power at Load",
      unit: "%",
      precision: 1
    },
    {
      key: "voltageRemaining_pct",
      label: "Voltage at Load",
      unit: "%",
      precision: 1
    }
  ],
  calculate: calculateCoaxLoss,
  formula: {
    primary: "Loss (dB) = \u03B1(f) \xD7 L / 100",
    latex: "\\text{Loss} = \\alpha(f) \\times \\frac{L}{100}",
    variables: [
      { symbol: "\u03B1(f)", description: "Cable attenuation at frequency f", unit: "dB/100m" },
      { symbol: "L", description: "Cable length", unit: "m" }
    ],
    reference: "Times Microwave LMR cable datasheets; Belden cable catalog"
  },
  relatedCalculators: ["coax-impedance", "rf-link-budget", "vswr-return-loss", "link-margin"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" }
  ]
};

// src/lib/calculators/rf/ism-coexistence.ts
var BANDS = [
  { name: "2.4 GHz ISM (2400\u20132483.5 MHz)", bwMHz: 83.5 },
  { name: "868 MHz (Europe, 863\u2013870 MHz)", bwMHz: 7 },
  { name: "915 MHz (Americas, 902\u2013928 MHz)", bwMHz: 26 },
  { name: "5.8 GHz ISM (5725\u20135850 MHz)", bwMHz: 125 },
  { name: "433 MHz (Europe, 433.05\u2013434.79 MHz)", bwMHz: 1.74 }
];
function calculateIsmCoexistence(inputs) {
  const { dutyCycle1_pct, dutyCycle2_pct, channels1, channels2, txPowerOffset_dB } = inputs;
  if (channels1 <= 0 || channels2 <= 0) {
    return { values: {}, errors: ["Channel counts must be > 0"] };
  }
  const p1 = dutyCycle1_pct / 100;
  const p2 = dutyCycle2_pct / 100;
  const sharedChannelFraction = Math.min(1, 2 / (channels1 + channels2));
  const collisionProb_pct = p1 * p2 * sharedChannelFraction * 100;
  const captureEffect = txPowerOffset_dB >= 3 ? 1 - Math.min(0.9, (txPowerOffset_dB - 3) / 20) : 1;
  const effectiveCollision_pct = collisionProb_pct * captureEffect;
  const throughputImpact_pct = Math.min(99, effectiveCollision_pct * 2);
  const warnings = [];
  if (effectiveCollision_pct > 20) {
    warnings.push("High collision probability \u2014 consider frequency hopping, time-division coexistence, or moving to a less congested band");
  }
  return {
    values: {
      collisionProb_pct,
      effectiveCollision_pct,
      throughputImpact_pct,
      sharedChannelFraction: sharedChannelFraction * 100
    },
    warnings: warnings.length ? warnings : void 0
  };
}
var ismCoexistence = {
  slug: "ism-coexistence",
  title: "ISM Band Wireless Coexistence Calculator",
  shortTitle: "ISM Coexistence",
  category: "rf",
  description: "Estimate collision probability and throughput impact when WiFi, Bluetooth, Zigbee, LoRa, or other protocols share the same ISM band. Enter duty cycles, channel counts, and power offset.",
  keywords: ["ISM band", "coexistence", "WiFi", "Bluetooth", "Zigbee", "LoRa", "2.4 GHz", "interference", "collision"],
  inputs: [
    {
      key: "bandIndex",
      label: "ISM Band",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: BANDS.length - 1,
      step: 1,
      presets: BANDS.map((b, i) => ({ label: b.name, values: { bandIndex: i } }))
    },
    {
      key: "dutyCycle1_pct",
      label: "Protocol 1 Duty Cycle",
      unit: "%",
      defaultValue: 50,
      min: 0.01,
      max: 100,
      tooltip: "WiFi at moderate load \u2248 20\u201360%, BLE advertising \u2248 0.5\u20135%, Zigbee \u2248 1%"
    },
    {
      key: "channels1",
      label: "Protocol 1 Channels",
      unit: "",
      defaultValue: 3,
      min: 1,
      max: 100,
      step: 1,
      tooltip: "WiFi: 3 non-overlapping (1/6/11), BLE data: 37 channels, LoRaWAN EU: 8 channels"
    },
    { key: "dutyCycle2_pct", label: "Protocol 2 Duty Cycle", unit: "%", defaultValue: 5, min: 0.01, max: 100 },
    { key: "channels2", label: "Protocol 2 Channels", unit: "", defaultValue: 37, min: 1, max: 100, step: 1 },
    {
      key: "txPowerOffset_dB",
      label: "TX Power Offset (P1\u2212P2)",
      unit: "dB",
      defaultValue: 10,
      min: -30,
      max: 40,
      tooltip: "Positive = Protocol 1 is stronger. WiFi (20 dBm) vs BLE (10 dBm) = +10 dB"
    }
  ],
  outputs: [
    {
      key: "effectiveCollision_pct",
      label: "Effective Collision Rate",
      unit: "%",
      precision: 2,
      primary: true,
      thresholds: { good: { max: 5 }, warning: { min: 5, max: 20 }, danger: { min: 20 } }
    },
    { key: "collisionProb_pct", label: "Raw Collision Probability", unit: "%", precision: 2 },
    { key: "throughputImpact_pct", label: "Throughput Impact", unit: "%", precision: 1 },
    { key: "sharedChannelFraction", label: "Shared Channel Fraction", unit: "%", precision: 1 }
  ],
  calculate: calculateIsmCoexistence,
  formula: {
    primary: "P_collision = P\u2081 \xD7 P\u2082 \xD7 F_shared",
    latex: "P_{collision} = \\frac{DC_1}{100} \\times \\frac{DC_2}{100} \\times F_{shared}",
    variables: [
      { symbol: "DC\u2081, DC\u2082", description: "Duty cycles of each protocol", unit: "%" },
      { symbol: "F_shared", description: "Fraction of shared channel bandwidth", unit: "" }
    ]
  },
  relatedCalculators: ["rf-link-budget", "noise-figure-cascade", "free-space-path-loss"],
  liveWidgets: [
    { type: "ism-coexistence", position: "above-outputs", props: { bandMhz: 2400 } },
    { type: "space-weather", position: "below-outputs" }
  ]
};

// src/lib/calculators/rf/attenuator-designer.ts
var E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
var DECADES = [1, 10, 100, 1e3, 1e4, 1e5];
function nearestE24(value) {
  let nearest = value;
  let minErr = Infinity;
  for (const dec of DECADES) {
    for (const v of E24) {
      const candidate = v * dec;
      const err = Math.abs(candidate - value) / value;
      if (err < minErr) {
        minErr = err;
        nearest = candidate;
      }
    }
  }
  return nearest;
}
function calculateAttenuatorDesigner(inputs) {
  const { attenuation, impedance: Z0 } = inputs;
  if (attenuation <= 0) {
    return { values: {}, errors: ["Attenuation must be greater than 0 dB"] };
  }
  if (Z0 <= 0) {
    return { values: {}, errors: ["Impedance must be greater than 0 \u03A9"] };
  }
  const K = Math.pow(10, attenuation / 20);
  if (K <= 1) {
    return { values: {}, errors: ["Attenuation must produce K > 1 (attenuation > 0 dB)"] };
  }
  const piR1 = Z0 * (K + 1) / (K - 1);
  const piR2 = Z0 * (K * K - 1) / (2 * K);
  const tR1 = Z0 * (K - 1) / (K + 1);
  const tR2 = Z0 * 2 * K / (K * K - 1);
  return {
    values: {
      piR1: Math.round(piR1 * 100) / 100,
      piR2: Math.round(piR2 * 100) / 100,
      piR1Nearest: nearestE24(piR1),
      piR2Nearest: nearestE24(piR2),
      tR1: Math.round(tR1 * 100) / 100,
      tR2: Math.round(tR2 * 100) / 100,
      tR1Nearest: nearestE24(tR1),
      tR2Nearest: nearestE24(tR2)
    }
  };
}
var attenuatorDesigner = {
  slug: "attenuator-designer",
  title: "RF Attenuator Designer",
  shortTitle: "Attenuator Designer",
  category: "rf",
  description: "Design Pi (\u03C0) and T attenuator pads for any attenuation value and impedance. Returns standard resistor values for both topologies with nearest E24 values.",
  keywords: ["attenuator calculator", "rf attenuator design", "pi attenuator", "t attenuator", "pad calculator", "resistive attenuator"],
  inputs: [
    {
      key: "attenuation",
      label: "Attenuation",
      symbol: "A",
      unit: "dB",
      defaultValue: 6,
      min: 0.1,
      max: 40,
      step: 0.1,
      tooltip: "Desired attenuation in dB",
      presets: [
        { label: "3 dB", values: { attenuation: 3 } },
        { label: "6 dB", values: { attenuation: 6 } },
        { label: "10 dB", values: { attenuation: 10 } },
        { label: "20 dB", values: { attenuation: 20 } }
      ]
    },
    {
      key: "impedance",
      label: "System Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      defaultValue: 50,
      min: 1,
      max: 1e3,
      step: 1,
      tooltip: "Source and load impedance (must be equal for a matched pad)",
      presets: [
        { label: "50 \u03A9", values: { impedance: 50 } },
        { label: "75 \u03A9", values: { impedance: 75 } }
      ]
    }
  ],
  outputs: [
    {
      key: "piR1",
      label: "Pi Shunt Resistor (exact)",
      symbol: "R1\u03C0",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Pi topology: two equal shunt resistors (exact value)"
    },
    {
      key: "piR1Nearest",
      label: "Pi Shunt Resistor (E24)",
      symbol: "R1\u03C0 E24",
      unit: "\u03A9",
      precision: 0,
      format: "standard",
      tooltip: "Pi topology: nearest E24 standard value for shunt resistors"
    },
    {
      key: "piR2",
      label: "Pi Series Resistor (exact)",
      symbol: "R2\u03C0",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Pi topology: series resistor (exact value)"
    },
    {
      key: "piR2Nearest",
      label: "Pi Series Resistor (E24)",
      symbol: "R2\u03C0 E24",
      unit: "\u03A9",
      precision: 0,
      format: "standard",
      tooltip: "Pi topology: nearest E24 standard value for series resistor"
    },
    {
      key: "tR1",
      label: "T Series Resistor (exact)",
      symbol: "R1T",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "T topology: two equal series resistors (exact value)"
    },
    {
      key: "tR1Nearest",
      label: "T Series Resistor (E24)",
      symbol: "R1T E24",
      unit: "\u03A9",
      precision: 0,
      format: "standard",
      tooltip: "T topology: nearest E24 standard value for series resistors"
    },
    {
      key: "tR2",
      label: "T Shunt Resistor (exact)",
      symbol: "R2T",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "T topology: shunt resistor (exact value)"
    },
    {
      key: "tR2Nearest",
      label: "T Shunt Resistor (E24)",
      symbol: "R2T E24",
      unit: "\u03A9",
      precision: 0,
      format: "standard",
      tooltip: "T topology: nearest E24 standard value for shunt resistor"
    }
  ],
  calculate: calculateAttenuatorDesigner,
  formula: {
    primary: "K = 10^(A/20),  R\u2081\u03C0 = Z\u2080(K+1)/(K-1),  R\u2082\u03C0 = Z\u2080(K\xB2-1)/(2K)",
    latex: "K = 10^{A/20},\\quad R_{1\\pi} = Z_0\\dfrac{K+1}{K-1},\\quad R_{2\\pi} = Z_0\\dfrac{K^2-1}{2K}",
    variables: [
      { symbol: "K", description: "Voltage attenuation ratio (10^(A/20))", unit: "" },
      { symbol: "A", description: "Attenuation", unit: "dB" },
      { symbol: "Z\u2080", description: "System impedance", unit: "\u03A9" }
    ],
    reference: 'Vizmuller, "RF Design Guide" (1995); Matthaei et al. (1964)'
  },
  visualization: { type: "none" },
  relatedCalculators: ["vswr-return-loss", "db-converter", "rf-link-budget"],
  // Pi topology only — one row per physical component so KiCad sees shunt→series→shunt
  exportComponents: (_inputs, outputs) => [
    { qty: 1, description: "R1 (shunt)", value: `${outputs.piR1Nearest} \u03A9`, package: "0402", componentType: "R", placement: "shunt" },
    { qty: 1, description: "R2 (series)", value: `${outputs.piR2Nearest} \u03A9`, package: "0402", componentType: "R", placement: "series" },
    { qty: 1, description: "R3 (shunt)", value: `${outputs.piR1Nearest} \u03A9`, package: "0402", componentType: "R", placement: "shunt" }
  ],
  schematicSections: (_inputs, outputs) => [
    {
      label: "Pi Topology",
      elements: [
        { type: "R", placement: "shunt", label: `R1 ${outputs.piR1Nearest}\u03A9` },
        { type: "R", placement: "series", label: `R2 ${outputs.piR2Nearest}\u03A9` },
        { type: "R", placement: "shunt", label: `R3 ${outputs.piR1Nearest}\u03A9` }
      ]
    },
    {
      label: "T Topology",
      elements: [
        { type: "R", placement: "series", label: `R1 ${outputs.tR1Nearest}\u03A9` },
        { type: "R", placement: "shunt", label: `R2 ${outputs.tR2Nearest}\u03A9` },
        { type: "R", placement: "series", label: `R3 ${outputs.tR1Nearest}\u03A9` }
      ]
    }
  ],
  verificationData: [
    {
      inputs: { attenuation: 6, impedance: 50 },
      expectedOutputs: { piR1: 150.5, piR2: 37.3 },
      tolerance: 0.01,
      source: "RF Design Guide tables: K=1.995, R1=50*2.995/0.995=150.5\u03A9, R2=50*2.98/3.99=37.3\u03A9"
    }
  ]
};

// src/lib/calculators/rf/smith-chart.ts
function calculateSmithChart(inputs) {
  const { resistance: R, reactance: X, referenceImpedance: Z0 } = inputs;
  if (Z0 <= 0) {
    return { values: {}, errors: ["Reference impedance Z\u2080 must be > 0 \u03A9"] };
  }
  if (R < 0) {
    return { values: {}, errors: ["Resistance R must be \u2265 0 \u03A9"] };
  }
  const numReal = R - Z0;
  const numImag = X;
  const denReal = R + Z0;
  const denImag = X;
  const denMagSq = denReal * denReal + denImag * denImag;
  if (denMagSq === 0) {
    return { values: {}, errors: ["Denominator (Z + Z\u2080) cannot be zero"] };
  }
  const gammaReal = (numReal * denReal + numImag * denImag) / denMagSq;
  const gammaImag = (numImag * denReal - numReal * denImag) / denMagSq;
  const gammaMag = Math.sqrt(gammaReal * gammaReal + gammaImag * gammaImag);
  const gammaAngRad = Math.atan2(gammaImag, gammaReal);
  const gammaAngDeg = gammaAngRad * (180 / Math.PI);
  let vswr;
  if (gammaMag >= 0.9999) {
    vswr = 99999;
  } else {
    vswr = (1 + gammaMag) / (1 - gammaMag);
  }
  let returnLoss;
  if (gammaMag < 1e-10) {
    returnLoss = Infinity;
  } else {
    returnLoss = -20 * Math.log10(gammaMag);
  }
  const mismatchLoss = -10 * Math.log10(1 - gammaMag * gammaMag);
  const normalizedR = R / Z0;
  const normalizedX = X / Z0;
  return {
    values: {
      gamma_mag: gammaMag,
      gamma_ang: gammaAngDeg,
      vswr,
      returnLoss,
      mismatchLoss,
      normalizedR,
      normalizedX
    },
    intermediateValues: {
      gammaReal,
      gammaImag
    }
  };
}
var smithChart = {
  slug: "smith-chart",
  title: "Smith Chart Calculator",
  shortTitle: "Smith Chart",
  category: "rf",
  description: "Interactive Smith Chart for impedance matching and RF network analysis. Enter load impedance to visualize reflection coefficient, VSWR circle, and normalized impedance.",
  keywords: [
    "smith chart",
    "impedance matching",
    "reflection coefficient",
    "VSWR",
    "RF",
    "transmission line",
    "normalized impedance",
    "return loss",
    "microwave",
    "S11"
  ],
  inputs: [
    {
      key: "resistance",
      label: "Resistance",
      symbol: "R",
      unit: "\u03A9",
      defaultValue: 50,
      min: 0,
      step: 1,
      tooltip: "Real part of load impedance (must be \u2265 0)",
      presets: [
        { label: "Matched (50 \u03A9)", values: { resistance: 50, reactance: 0, referenceImpedance: 50 } },
        { label: "25 \u03A9 (VSWR 2)", values: { resistance: 25, reactance: 0, referenceImpedance: 50 } },
        { label: "100 \u03A9 (VSWR 2)", values: { resistance: 100, reactance: 0, referenceImpedance: 50 } },
        { label: "Short (0 \u03A9)", values: { resistance: 0, reactance: 0, referenceImpedance: 50 } },
        { label: "75 \u03A9 Cable", values: { resistance: 75, reactance: 0, referenceImpedance: 50 } },
        { label: "Reactive (50+j50)", values: { resistance: 50, reactance: 50, referenceImpedance: 50 } }
      ]
    },
    {
      key: "reactance",
      label: "Reactance",
      symbol: "X",
      unit: "\u03A9",
      defaultValue: 0,
      step: 1,
      tooltip: "Imaginary part of load impedance. Positive = inductive, negative = capacitive."
    },
    {
      key: "referenceImpedance",
      label: "Reference Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      defaultValue: 50,
      min: 1,
      step: 1,
      tooltip: "System characteristic impedance (typically 50 \u03A9 for RF, 75 \u03A9 for cable TV)"
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 1e3,
      min: 1e-3,
      step: 1,
      tooltip: "Operating frequency (informational \u2014 does not affect Smith Chart position)"
    }
  ],
  outputs: [
    {
      key: "gamma_mag",
      label: "Reflection Coefficient |\u0393|",
      symbol: "|\u0393|",
      unit: "",
      precision: 4,
      thresholds: {
        good: { max: 0.1 },
        warning: { max: 0.33 },
        danger: { max: 0.33 }
      }
    },
    {
      key: "gamma_ang",
      label: "Angle \u2220\u0393",
      symbol: "\u2220\u0393",
      unit: "\xB0",
      precision: 2
    },
    {
      key: "vswr",
      label: "VSWR",
      symbol: "VSWR",
      unit: ":1",
      precision: 3,
      thresholds: {
        good: { max: 1.5 },
        warning: { max: 3 },
        danger: { max: 3 }
      }
    },
    {
      key: "returnLoss",
      label: "Return Loss",
      symbol: "RL",
      unit: "dB",
      precision: 2,
      thresholds: {
        good: { min: 20 },
        warning: { min: 10 },
        danger: { min: 10 }
      }
    },
    {
      key: "mismatchLoss",
      label: "Mismatch Loss",
      symbol: "ML",
      unit: "dB",
      precision: 3,
      thresholds: {
        good: { max: 0.044 },
        warning: { max: 0.5 }
      }
    },
    {
      key: "normalizedR",
      label: "Normalized Resistance r",
      symbol: "r",
      unit: "",
      precision: 4
    },
    {
      key: "normalizedX",
      label: "Normalized Reactance x",
      symbol: "x",
      unit: "",
      precision: 4
    }
  ],
  calculate: calculateSmithChart,
  formula: {
    primary: "\u0393 = (Z - Z\u2080) / (Z + Z\u2080)",
    latex: "\\Gamma = \\frac{Z_L - Z_0}{Z_L + Z_0}, \\quad \\text{VSWR} = \\frac{1+|\\Gamma|}{1-|\\Gamma|}",
    variables: [
      { symbol: "\u0393", description: "Complex reflection coefficient", unit: "" },
      { symbol: "Z", description: "Load impedance R + jX", unit: "\u03A9" },
      { symbol: "Z\u2080", description: "Reference (characteristic) impedance", unit: "\u03A9" },
      { symbol: "|\u0393|", description: "Magnitude of reflection coefficient (0 = matched, 1 = total reflection)", unit: "" },
      { symbol: "VSWR", description: "Voltage Standing Wave Ratio = (1+|\u0393|)/(1\u2212|\u0393|)", unit: ":1" },
      { symbol: "RL", description: "Return Loss = \u221220 log\u2081\u2080|\u0393|", unit: "dB" }
    ],
    derivation: [
      "Normalize impedance: z = Z/Z\u2080 = r + jx",
      "\u0393 = (z \u2212 1)/(z + 1)",
      "Constant-r circles: center at (r/(r+1), 0), radius 1/(r+1)",
      "Constant-x arcs: center at (1, 1/x), radius |1/x|"
    ],
    reference: "Pozar, Microwave Engineering 4th Ed., Chapter 2"
  },
  visualization: { type: "smith-chart" },
  relatedCalculators: ["vswr-return-loss", "microstrip-impedance", "rf-link-budget", "coax-impedance"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ],
  faqs: [
    {
      question: "What is a Smith Chart?",
      answer: "A Smith Chart is a graphical tool developed by Phillip H. Smith in 1939 that maps complex impedance values to the complex reflection coefficient (\u0393) plane. The unit circle represents |\u0393| = 1 (total reflection). The chart overlays a grid of constant-resistance circles and constant-reactance arcs, making it easy to visualize impedance transformations, matching networks, and transmission-line effects without complex arithmetic."
    },
    {
      question: "How do I read a point on the Smith Chart?",
      answer: "Every point on the Smith Chart represents a normalized impedance z = r + jx. The horizontal axis is the real axis (pure resistance). Points on the right half are in the inductive region (positive reactance), points on the left half are capacitive (negative reactance). The center point (0,0 in \u0393-plane) corresponds to the perfectly matched impedance Z = Z\u2080. Moving along a constant-radius circle (VSWR circle) represents traveling along a lossless transmission line."
    },
    {
      question: "What does the VSWR circle show?",
      answer: "The VSWR circle is drawn centered at the origin of the \u0393-plane with radius |\u0393|. All impedances that lie on this circle have the same VSWR and return loss. As you move along a lossless transmission line, the impedance traces a path around this circle. This makes quarter-wave and half-wave transformer design straightforward on the Smith Chart."
    },
    {
      question: "What is normalized impedance?",
      answer: "Normalized impedance z = Z/Z\u2080 removes the system reference impedance, making the chart universal. For a 50 \u03A9 system, Z = 25 \u03A9 becomes z = 0.5, while Z = 100 \u03A9 becomes z = 2. The center of the Smith Chart always represents the normalized matched condition z = 1 + j0, regardless of whether Z\u2080 is 50 \u03A9, 75 \u03A9, or any other value."
    },
    {
      question: "How do I use the Smith Chart for matching network design?",
      answer: "Start by plotting your load impedance on the chart. To match to the center (z = 1), add series or shunt reactive elements to move the impedance toward the center. Series inductors move the point clockwise along constant-r circles; series capacitors move counterclockwise. Shunt elements move along constant-conductance circles. A common approach is the L-network: first add a shunt element to reach the r = 1 circle, then add a series element to reach the center."
    }
  ],
  verificationData: [
    {
      inputs: { resistance: 50, reactance: 0, referenceImpedance: 50, frequency: 1e3 },
      expectedOutputs: { gamma_mag: 0, vswr: 1, normalizedR: 1, normalizedX: 0 },
      tolerance: 1e-3,
      source: "Perfect match: Z = Z\u2080, \u0393 = 0"
    },
    {
      inputs: { resistance: 25, reactance: 0, referenceImpedance: 50, frequency: 1e3 },
      expectedOutputs: { gamma_mag: 0.3333, gamma_ang: 180, vswr: 2, returnLoss: 9.54 },
      tolerance: 0.01,
      source: "Pozar Table 2.3: Z=25\u03A9, Z\u2080=50\u03A9"
    },
    {
      inputs: { resistance: 0, reactance: 0, referenceImpedance: 50, frequency: 1e3 },
      expectedOutputs: { gamma_mag: 1, gamma_ang: 180, normalizedR: 0, normalizedX: 0 },
      tolerance: 1e-3,
      source: "Short circuit: Z = 0, \u0393 = \u22121"
    }
  ]
};

// src/lib/calculators/pcb/trace-width-current.ts
function calculateTraceWidth(inputs) {
  const { current, copperWeight, tempRise, traceLength, isExternal } = inputs;
  const copperMil = copperWeight * 1.37;
  const k = isExternal > 0.5 ? 0.048 : 0.024;
  const b = isExternal > 0.5 ? 0.44 : 0.44;
  const c = isExternal > 0.5 ? 0.725 : 0.725;
  const area2221 = Math.pow(current / (k * Math.pow(tempRise, b)), 1 / c);
  const width2221Mil = area2221 / copperMil;
  const width2221mm = width2221Mil * 0.0254;
  const factor2152 = isExternal > 0.5 ? 0.75 : 0.85;
  const width2152mm = width2221mm * factor2152;
  const rho20 = 172e-10;
  const alpha = 393e-5;
  const tempC = 25 + tempRise;
  const rho = rho20 * (1 + alpha * (tempC - 20));
  const widthM = width2221mm * 1e-3;
  const thicknessM = copperMil * 0.0254 * 1e-3;
  const lengthM = traceLength * 1e-3;
  const resistance = rho * lengthM / (widthM * thicknessM);
  const voltageDrop = current * resistance;
  const powerDiss = current * current * resistance;
  return {
    values: {
      width2221mm: Math.round(width2221mm * 1e3) / 1e3,
      width2152mm: Math.round(width2152mm * 1e3) / 1e3,
      resistance: Math.round(resistance * 1e6) / 1e6,
      voltageDrop: Math.round(voltageDrop * 1e4) / 1e4,
      powerDiss: Math.round(powerDiss * 1e4) / 1e4
    }
  };
}
var traceWidthCurrent = {
  slug: "trace-width-current",
  title: "PCB Trace Width Calculator (IPC-2221 / IPC-2152)",
  shortTitle: "Trace Width",
  category: "pcb",
  description: "Calculate minimum PCB trace width for a given current, copper weight, and temperature rise per IPC-2221 and IPC-2152 standards. Includes resistance and voltage drop.",
  keywords: ["trace width calculator", "pcb trace current", "ipc-2221 calculator", "ipc-2152", "pcb current capacity", "trace ampacity"],
  inputs: [
    {
      key: "current",
      label: "Current",
      symbol: "I",
      unit: "A",
      defaultValue: 1,
      min: 0.01,
      max: 100,
      step: 0.1,
      tooltip: "RMS current through the trace"
    },
    {
      key: "copperWeight",
      label: "Copper Weight",
      symbol: "T",
      unit: "oz",
      defaultValue: 1,
      min: 0.5,
      max: 4,
      step: 0.5,
      tooltip: "Copper thickness (1 oz = 35 \u03BCm = 1.37 mil)",
      presets: [
        { label: "\xBD oz", values: { copperWeight: 0.5 } },
        { label: "1 oz (standard)", values: { copperWeight: 1 } },
        { label: "2 oz", values: { copperWeight: 2 } },
        { label: "3 oz", values: { copperWeight: 3 } }
      ]
    },
    {
      key: "tempRise",
      label: "Temperature Rise",
      symbol: "\u0394T",
      unit: "\xB0C",
      defaultValue: 10,
      min: 1,
      max: 100,
      step: 1,
      tooltip: "Allowed temperature rise above ambient",
      presets: [
        { label: "5\xB0C (tight)", values: { tempRise: 5 } },
        { label: "10\xB0C (standard)", values: { tempRise: 10 } },
        { label: "20\xB0C (relaxed)", values: { tempRise: 20 } }
      ]
    },
    {
      key: "traceLength",
      label: "Trace Length",
      symbol: "L",
      unit: "mm",
      defaultValue: 100,
      min: 1,
      max: 1e4,
      step: 1,
      tooltip: "Length of the trace (for resistance/voltage drop)"
    },
    {
      key: "isExternal",
      label: "Layer Type",
      symbol: "",
      unit: "",
      defaultValue: 1,
      min: 0,
      max: 1,
      tooltip: "1 = external (outer) layer, 0 = internal layer",
      presets: [
        { label: "External layer", values: { isExternal: 1 } },
        { label: "Internal layer", values: { isExternal: 0 } }
      ]
    }
  ],
  outputs: [
    {
      key: "width2221mm",
      label: "Min Width (IPC-2221)",
      unit: "mm",
      precision: 3,
      thresholds: { warning: { min: 3 } }
    },
    {
      key: "width2152mm",
      label: "Min Width (IPC-2152)",
      unit: "mm",
      precision: 3
    },
    {
      key: "resistance",
      label: "DC Resistance",
      unit: "\u03A9",
      precision: 6,
      format: "engineering"
    },
    {
      key: "voltageDrop",
      label: "Voltage Drop",
      unit: "V",
      precision: 4,
      thresholds: { warning: { min: 0.1 } }
    },
    {
      key: "powerDiss",
      label: "Power Dissipation",
      unit: "W",
      precision: 4
    }
  ],
  calculate: calculateTraceWidth,
  formula: {
    primary: "A = \\left(\\frac{I}{k \\cdot \\Delta T^b}\\right)^{1/c}",
    variables: [
      { symbol: "A", description: "Cross-sectional area (mil\xB2)", unit: "mil\xB2" },
      { symbol: "I", description: "Current", unit: "A" },
      { symbol: "\u0394T", description: "Temperature rise above ambient", unit: "\xB0C" },
      { symbol: "k,b,c", description: "IPC-2221 empirical coefficients", unit: "" }
    ],
    reference: "IPC-2221B Section 6.2; IPC-2152"
  },
  visualization: { type: "none" },
  relatedCalculators: ["microstrip-impedance", "trace-resistance", "via-calculator"],
  verificationData: [
    {
      inputs: { current: 1, copperWeight: 1, tempRise: 10, traceLength: 100, isExternal: 1 },
      expectedOutputs: { width2221mm: 0.302 },
      tolerance: 0.02,
      source: "IPC-2221B formula: A=(I/(k\xB7\u0394T^b))^(1/c), k=0.048 b=0.44 c=0.725"
    },
    {
      inputs: { current: 5, copperWeight: 1, tempRise: 10, traceLength: 100, isExternal: 1 },
      expectedOutputs: { width2221mm: 2.782 },
      tolerance: 0.02,
      source: "IPC-2221B formula: A=(I/(k\xB7\u0394T^b))^(1/c), k=0.048 b=0.44 c=0.725"
    }
  ]
};

// src/lib/calculators/pcb/trace-resistance.ts
function calculateTraceResistance(inputs) {
  const { traceWidth, traceLength, copperThickness, temperature } = inputs;
  const rho20 = 172e-10;
  const alpha = 393e-5;
  const rho = rho20 * (1 + alpha * (temperature - 20));
  const widthM = traceWidth * 1e-3;
  const lengthM = traceLength * 1e-3;
  const thicknessM = copperThickness * 1e-6;
  const resistance = rho * lengthM / (widthM * thicknessM);
  const sheetResistance = rho / thicknessM * 1e3;
  return {
    values: {
      resistance: Math.round(resistance * 1e6) / 1e6,
      resistanceMOhm: Math.round(resistance * 1e6) / 1e3,
      sheetResistance: Math.round(sheetResistance * 100) / 100
    }
  };
}
var traceResistance = {
  slug: "trace-resistance",
  title: "PCB Trace Resistance Calculator",
  shortTitle: "Trace Resistance",
  category: "pcb",
  description: "Calculate PCB copper trace DC resistance from width, length, thickness, and temperature. Includes sheet resistance and temperature coefficient.",
  keywords: ["pcb trace resistance", "copper trace resistance", "trace impedance dc", "pcb resistance calculator"],
  inputs: [
    {
      key: "traceWidth",
      label: "Trace Width",
      unit: "mm",
      defaultValue: 0.5,
      min: 0.05,
      max: 50
    },
    {
      key: "traceLength",
      label: "Trace Length",
      unit: "mm",
      defaultValue: 100,
      min: 0.1,
      max: 1e4
    },
    {
      key: "copperThickness",
      label: "Copper Thickness",
      unit: "\u03BCm",
      defaultValue: 35,
      min: 1,
      max: 200,
      presets: [
        { label: "\xBD oz (17.5 \u03BCm)", values: { copperThickness: 17.5 } },
        { label: "1 oz (35 \u03BCm)", values: { copperThickness: 35 } },
        { label: "2 oz (70 \u03BCm)", values: { copperThickness: 70 } }
      ]
    },
    {
      key: "temperature",
      label: "Temperature",
      unit: "\xB0C",
      defaultValue: 25,
      min: -55,
      max: 150
    }
  ],
  outputs: [
    {
      key: "resistance",
      label: "Resistance",
      unit: "\u03A9",
      precision: 6,
      format: "engineering"
    },
    {
      key: "resistanceMOhm",
      label: "Resistance",
      unit: "m\u03A9",
      precision: 3
    },
    {
      key: "sheetResistance",
      label: "Sheet Resistance",
      unit: "m\u03A9/\u25A1",
      precision: 2
    }
  ],
  calculate: calculateTraceResistance,
  formula: {
    primary: "R = \\rho(T) \\cdot \\frac{L}{W \\cdot T_c}",
    variables: [
      { symbol: "\u03C1(T)", description: "Resistivity at temperature T", unit: "\u03A9\xB7m" },
      { symbol: "L", description: "Trace length", unit: "m" },
      { symbol: "W", description: "Trace width", unit: "m" },
      { symbol: "Tc", description: "Copper thickness", unit: "m" }
    ],
    reference: "IPC-2221B; copper \u03C1\u2082\u2080 = 1.72\xD710\u207B\u2078 \u03A9\xB7m, \u03B1 = 3.93\xD710\u207B\xB3 /\xB0C"
  },
  visualization: { type: "none" },
  relatedCalculators: ["trace-width-current", "microstrip-impedance"],
  verificationData: [
    {
      inputs: { traceWidth: 1, traceLength: 1e3, copperThickness: 35, temperature: 20 },
      expectedOutputs: { resistance: 0.491 },
      tolerance: 0.02,
      source: "\u03C1\u2082\u2080(Cu) = 1.72e-8 \u03A9\xB7m"
    }
  ]
};

// src/lib/calculators/pcb/differential-pair.ts
function calculateDifferentialPair(inputs) {
  const {
    traceWidth: w,
    traceSpacing: s,
    substrateHeight: h,
    dielectricConstant: er,
    copperThickness
  } = inputs;
  if (w <= 0 || s <= 0 || h <= 0 || er < 1 || copperThickness <= 0) {
    return { values: {}, errors: ["All inputs must be positive and dielectric constant \u2265 1"] };
  }
  const t = copperThickness / 1e3;
  if (t >= h) {
    return { values: {}, errors: ["Copper thickness must be less than substrate height"] };
  }
  const dw = t / Math.PI * (1 + Math.log(2 * h / t));
  const wEff = w + dw;
  const u = wEff / h;
  const a = 1 + 1 / 49 * Math.log((Math.pow(u, 4) + Math.pow(u / 52, 2)) / (Math.pow(u, 4) + 0.432)) + 1 / 18.7 * Math.log(1 + Math.pow(u / 18.1, 3));
  const b = 0.564 * Math.pow((er - 0.9) / (er + 3), 0.053);
  const erEff = (er + 1) / 2 + (er - 1) / 2 * Math.pow(1 + 10 / u, -a * b);
  const F = 6 + (2 * Math.PI - 6) * Math.exp(-Math.pow(30.666 / u, 0.7528));
  const z0Single = 60 / Math.sqrt(erEff) * Math.log(F / u + Math.sqrt(1 + 4 / (u * u)));
  const Q = 2 * s / w;
  const Qe = Math.exp(-Q * 0.347);
  const zodd = z0Single * (1 - Qe);
  const zeven = z0Single * (1 + Qe);
  const zdiff = 2 * zodd;
  const zcom = zeven / 2;
  return {
    values: {
      zdiff: Math.round(zdiff * 100) / 100,
      zcom: Math.round(zcom * 100) / 100,
      z0single: Math.round(z0Single * 100) / 100,
      zodd: Math.round(zodd * 100) / 100,
      zeven: Math.round(zeven * 100) / 100
    }
  };
}
var differentialPair = {
  slug: "differential-pair",
  title: "Differential Pair Impedance Calculator",
  shortTitle: "Differential Pair",
  category: "pcb",
  description: "Calculate differential (Zdiff) and common-mode (Zcom) impedance for edge-coupled microstrip differential pairs used in USB, HDMI, Ethernet, and high-speed serial interfaces.",
  keywords: [
    "differential pair calculator",
    "zdiff calculator",
    "differential impedance pcb",
    "edge coupled microstrip",
    "usb impedance",
    "hdmi impedance"
  ],
  inputs: [
    {
      key: "traceWidth",
      label: "Trace Width",
      symbol: "W",
      unit: "mm",
      defaultValue: 0.15,
      min: 0.05,
      max: 5,
      step: 0.01,
      tooltip: "Width of each individual trace in the differential pair"
    },
    {
      key: "traceSpacing",
      label: "Trace Spacing (edge-to-edge)",
      symbol: "S",
      unit: "mm",
      defaultValue: 0.15,
      min: 0.05,
      max: 5,
      step: 0.01,
      tooltip: "Edge-to-edge gap between the two traces"
    },
    {
      key: "substrateHeight",
      label: "Substrate Height",
      symbol: "H",
      unit: "mm",
      defaultValue: 0.1,
      min: 0.05,
      max: 5,
      step: 0.01,
      tooltip: "Dielectric thickness between trace and ground plane"
    },
    {
      key: "dielectricConstant",
      label: "Dielectric Constant",
      symbol: "\u03B5\u1D63",
      unit: "",
      defaultValue: 4.2,
      min: 1,
      max: 20,
      step: 0.01,
      tooltip: "Relative permittivity of the substrate material",
      presets: [
        { label: "FR4 (4.2)", values: { dielectricConstant: 4.2 } },
        { label: "Rogers 4003C (3.38)", values: { dielectricConstant: 3.38 } },
        { label: "PTFE (2.2)", values: { dielectricConstant: 2.2 } }
      ]
    },
    {
      key: "copperThickness",
      label: "Copper Thickness",
      symbol: "T",
      unit: "\u03BCm",
      defaultValue: 17.5,
      min: 5,
      max: 200,
      step: 0.5,
      tooltip: "Thickness of the copper trace (plating + base)",
      presets: [
        { label: "0.5 oz (17.5 \u03BCm)", values: { copperThickness: 17.5 } },
        { label: "1 oz (35 \u03BCm)", values: { copperThickness: 35 } },
        { label: "2 oz (70 \u03BCm)", values: { copperThickness: 70 } }
      ]
    }
  ],
  outputs: [
    {
      key: "zdiff",
      label: "Differential Impedance",
      symbol: "Z_diff",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Differential impedance (2 \xD7 Zodd)",
      thresholds: {
        good: { min: 88, max: 92 },
        warning: { min: 80, max: 100 }
      }
    },
    {
      key: "zcom",
      label: "Common-Mode Impedance",
      symbol: "Z_com",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Common-mode impedance (Zeven / 2)"
    },
    {
      key: "z0single",
      label: "Single-Ended Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Uncoupled single-ended impedance (Hammerstad-Jensen)"
    },
    {
      key: "zodd",
      label: "Odd-Mode Impedance",
      symbol: "Z_odd",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Odd-mode impedance (Zdiff / 2)"
    },
    {
      key: "zeven",
      label: "Even-Mode Impedance",
      symbol: "Z_even",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Even-mode impedance (2 \xD7 Zcom)"
    }
  ],
  calculate: calculateDifferentialPair,
  formula: {
    primary: "Z_{diff} = 2Z_{odd} \\approx 2Z_0(1-Qe),\\ Z_{com} = \\frac{Z_{even}}{2} \\approx \\frac{Z_0(1+Qe)}{2}",
    variables: [
      { symbol: "Z\u2080", description: "Single-ended microstrip impedance (Hammerstad-Jensen)", unit: "\u03A9" },
      { symbol: "Q", description: "Normalized edge-to-edge gap: 2S/W", unit: "" },
      { symbol: "Qe", description: "Empirical coupling coefficient: exp(\u22120.347Q)", unit: "" },
      { symbol: "Z_odd", description: "Odd-mode impedance = Z\u2080(1 \u2212 Qe)", unit: "\u03A9" },
      { symbol: "Z_even", description: "Even-mode impedance = Z\u2080(1 + Qe)", unit: "\u03A9" }
    ],
    reference: "IPC-2141A; Wadell Chapter 3.7"
  },
  visualization: {
    type: "cross-section",
    layers: ["trace1", "gap", "trace2", "substrate", "ground"]
  },
  relatedCalculators: ["microstrip-impedance", "trace-width-current"],
  verificationData: [
    {
      inputs: {
        traceWidth: 0.15,
        traceSpacing: 0.15,
        substrateHeight: 0.1,
        dielectricConstant: 4.2,
        copperThickness: 17.5
      },
      expectedOutputs: { zdiff: 55 },
      tolerance: 0.02,
      source: "IPC-2141A: tight coupling (S=W) on 0.1mm FR4, Zdiff \u2248 2\xD7Z_odd = 55\u03A9"
    }
  ]
};

// src/lib/calculators/pcb/via-calculator.ts
function calculateVia(inputs) {
  const {
    viaDiameter: d,
    padDiameter: D,
    boardThickness: T,
    dielectricConstant: er,
    copperThickness
    // μm (plating thickness)
    // signalLayer is accepted but does not affect current formulas in this approximation
  } = inputs;
  if (d <= 0 || D <= d) {
    return {
      values: {},
      errors: ["Pad diameter must be greater than via drill diameter"]
    };
  }
  if (T <= 0 || er < 1 || copperThickness <= 0) {
    return {
      values: {},
      errors: ["Board thickness, dielectric constant, and copper thickness must be positive"]
    };
  }
  const warnings = [];
  const impedance = 60 / Math.sqrt(er) * Math.log(D / d);
  const capacitancePF = 0.0554 * er * T * d / (D - d);
  const inductanceNH = 0.2 * T * (Math.log(4 * T / d) + 0.5);
  const aspectRatio = T / d;
  const dMil = d / 0.0254;
  const copperThicknessMil = copperThickness / 25.4;
  const rInnerMil = dMil / 2;
  const rOuterMil = rInnerMil + copperThicknessMil;
  const viaAreaMil2 = Math.PI * (rOuterMil * rOuterMil - rInnerMil * rInnerMil);
  const currentCapacityA = 0.048 * Math.pow(10, 0.44) * Math.pow(viaAreaMil2, 0.725);
  if (aspectRatio > 10) {
    warnings.push("Aspect ratio > 10 may cause plating issues");
  }
  if (d < 0.2) {
    warnings.push("Drill diameter < 0.2mm may be expensive");
  }
  if (D < d + 0.15) {
    warnings.push("Annular ring < 0.075mm each side");
  }
  return {
    values: {
      impedance: Math.round(impedance * 100) / 100,
      capacitancePF: Math.round(capacitancePF * 1e3) / 1e3,
      inductanceNH: Math.round(inductanceNH * 1e3) / 1e3,
      aspectRatio: Math.round(aspectRatio * 100) / 100,
      currentCapacityA: Math.round(currentCapacityA * 100) / 100
    },
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
var viaCalculator = {
  slug: "via-calculator",
  title: "PCB Via Calculator",
  shortTitle: "Via Calculator",
  category: "pcb",
  description: "Calculate PCB via impedance, capacitance, inductance, current capacity, aspect ratio, and DFM warnings. Covers through-hole and blind/buried vias.",
  keywords: [
    "pcb via calculator",
    "via impedance",
    "via capacitance",
    "via inductance",
    "via current capacity",
    "pcb via design"
  ],
  inputs: [
    {
      key: "viaDiameter",
      label: "Via Drill Diameter",
      symbol: "d",
      unit: "mm",
      defaultValue: 0.3,
      min: 0.1,
      max: 6,
      step: 0.05,
      tooltip: "Finished drill diameter of the via hole"
    },
    {
      key: "padDiameter",
      label: "Pad Diameter",
      symbol: "D",
      unit: "mm",
      defaultValue: 0.6,
      min: 0.2,
      max: 10,
      step: 0.05,
      tooltip: "Copper pad diameter surrounding the via"
    },
    {
      key: "boardThickness",
      label: "Board Thickness",
      symbol: "T",
      unit: "mm",
      defaultValue: 1.6,
      min: 0.1,
      max: 10,
      step: 0.1,
      tooltip: "Total PCB thickness (for aspect ratio and inductance)",
      presets: [
        { label: "0.8mm", values: { boardThickness: 0.8 } },
        { label: "1.6mm (standard)", values: { boardThickness: 1.6 } },
        { label: "2.4mm", values: { boardThickness: 2.4 } }
      ]
    },
    {
      key: "dielectricConstant",
      label: "Dielectric Constant",
      symbol: "\u03B5\u1D63",
      unit: "",
      defaultValue: 4.2,
      min: 1,
      max: 20,
      step: 0.01,
      tooltip: "Relative permittivity of the board material",
      presets: [
        { label: "FR4 (4.2)", values: { dielectricConstant: 4.2 } },
        { label: "Rogers 4003C (3.38)", values: { dielectricConstant: 3.38 } }
      ]
    },
    {
      key: "copperThickness",
      label: "Copper Plating Thickness",
      symbol: "T_cu",
      unit: "\u03BCm",
      defaultValue: 25,
      min: 5,
      max: 100,
      step: 1,
      tooltip: "Plated copper wall thickness inside the via barrel"
    },
    {
      key: "signalLayer",
      label: "Signal Layer",
      symbol: "",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      tooltip: "0 = inner layer, 1 = outer layer",
      presets: [
        { label: "Inner layer", values: { signalLayer: 0 } },
        { label: "Outer layer", values: { signalLayer: 1 } }
      ]
    }
  ],
  outputs: [
    {
      key: "impedance",
      label: "Via Impedance",
      symbol: "Z_via",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Characteristic impedance of the via (coaxial approximation)"
    },
    {
      key: "capacitancePF",
      label: "Via Capacitance",
      symbol: "C_via",
      unit: "pF",
      precision: 3,
      format: "standard",
      tooltip: "Parasitic capacitance of the via (IPC-2141A)"
    },
    {
      key: "inductanceNH",
      label: "Via Inductance",
      symbol: "L_via",
      unit: "nH",
      precision: 3,
      format: "standard",
      tooltip: "Parasitic inductance of the via (Wheeler)"
    },
    {
      key: "aspectRatio",
      label: "Aspect Ratio",
      symbol: "AR",
      unit: "",
      precision: 2,
      format: "standard",
      tooltip: "Board thickness / drill diameter. Keep \u2264 10:1 for reliable plating.",
      thresholds: {
        good: { max: 8 },
        warning: { max: 10 },
        danger: { min: 10 }
      }
    },
    {
      key: "currentCapacityA",
      label: "Current Capacity",
      symbol: "I_max",
      unit: "A",
      precision: 2,
      format: "standard",
      tooltip: "Estimated maximum current at 10\xB0C temperature rise (IPC-2221)"
    }
  ],
  calculate: calculateVia,
  formula: {
    primary: "C_{via} \\approx \\frac{0.0554\\,\\varepsilon_r\\,T\\,d}{D-d}\\ \\text{pF},\\quad L_{via} \\approx 0.2h\\left(\\ln\\frac{4h}{d}+0.5\\right)\\ \\text{nH}",
    variables: [
      { symbol: "T", description: "Board thickness", unit: "mm" },
      { symbol: "d", description: "Via drill diameter", unit: "mm" },
      { symbol: "D", description: "Pad diameter", unit: "mm" },
      { symbol: "\u03B5\u1D63", description: "Dielectric constant", unit: "" },
      { symbol: "h", description: "Via height (= board thickness)", unit: "mm" }
    ],
    reference: 'IPC-2141A; Howard Johnson "High-Speed Signal Propagation"'
  },
  visualization: { type: "none" },
  relatedCalculators: ["trace-width-current", "microstrip-impedance"],
  verificationData: [
    {
      inputs: {
        viaDiameter: 0.3,
        padDiameter: 0.6,
        boardThickness: 1.6,
        dielectricConstant: 4.2,
        copperThickness: 25,
        signalLayer: 0
      },
      expectedOutputs: { aspectRatio: 5.33 },
      tolerance: 0.01,
      source: "1.6 / 0.3 = 5.33"
    }
  ]
};

// src/lib/calculators/pcb/stackup-builder.ts
function hammerstadJensen(w, h, er, tMm) {
  const dw = tMm / Math.PI * (1 + Math.log(2 * h / tMm));
  const wEff = w + dw;
  const u = wEff / h;
  const a = 1 + 1 / 49 * Math.log((Math.pow(u, 4) + Math.pow(u / 52, 2)) / (Math.pow(u, 4) + 0.432)) + 1 / 18.7 * Math.log(1 + Math.pow(u / 18.1, 3));
  const b = 0.564 * Math.pow((er - 0.9) / (er + 3), 0.053);
  const erEff = (er + 1) / 2 + (er - 1) / 2 * Math.pow(1 + 10 / u, -a * b);
  const F = 6 + (2 * Math.PI - 6) * Math.exp(-Math.pow(30.666 / u, 0.7528));
  return 60 / Math.sqrt(erEff) * Math.log(F / u + Math.sqrt(1 + 4 / (u * u)));
}
function inverseWheeler(z0, er) {
  if (z0 > 44) {
    const A = z0 / 60 * Math.sqrt((er + 1) / 2) + (er - 1) / (er + 1) * (0.23 + 0.11 / er);
    return 8 * Math.exp(A) / (Math.exp(2 * A) - 2);
  } else {
    const B = 377 * Math.PI / (2 * z0 * Math.sqrt(er));
    return 2 / Math.PI * (B - 1 - Math.log(2 * B - 1) + (er - 1) / (2 * er) * (Math.log(B - 1) + 0.39 - 0.61 / er));
  }
}
function calculateStackup(inputs) {
  const {
    // layerCount is accepted but not used in current simplified model
    targetImpedance: z0,
    dielectricH1,
    dielectricH2,
    dielectricH3,
    copperWeight,
    dielectricConstant: er
  } = inputs;
  if (z0 <= 0 || er < 2 || dielectricH1 <= 0 || dielectricH2 <= 0 || dielectricH3 <= 0) {
    return {
      values: {},
      errors: ["All dielectric heights and impedance must be positive; dielectric constant \u2265 2"]
    };
  }
  const warnings = [];
  const tMm = copperWeight * 35 / 1e3;
  const totalThicknessMm = dielectricH1 + dielectricH2 + dielectricH3;
  const whRatioL1 = inverseWheeler(z0, er);
  const traceWidthL1mm = whRatioL1 * dielectricH1;
  const whRatioL3 = inverseWheeler(z0, er);
  const traceWidthL3mm = whRatioL3 * dielectricH2;
  const safeTMm = Math.min(tMm, dielectricH1 * 0.5, dielectricH2 * 0.5);
  const achievedImpedanceL1 = hammerstadJensen(traceWidthL1mm, dielectricH1, er, safeTMm);
  const achievedImpedanceL3 = hammerstadJensen(traceWidthL3mm, dielectricH2, er, safeTMm);
  if (totalThicknessMm < 0.5) {
    warnings.push("Very thin board: warping risk");
  }
  if (dielectricH1 < 0.08) {
    warnings.push("Prepreg too thin for standard fab");
  }
  return {
    values: {
      traceWidthL1mm: Math.round(traceWidthL1mm * 1e3) / 1e3,
      traceWidthL3mm: Math.round(traceWidthL3mm * 1e3) / 1e3,
      achievedImpedanceL1: Math.round(achievedImpedanceL1 * 100) / 100,
      achievedImpedanceL3: Math.round(achievedImpedanceL3 * 100) / 100,
      totalThicknessMm: Math.round(totalThicknessMm * 1e3) / 1e3
    },
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
var stackupBuilder = {
  slug: "stackup-builder",
  title: "PCB Stackup Impedance Calculator",
  shortTitle: "Stackup Builder",
  category: "pcb",
  description: "Calculate characteristic impedance for common PCB stackup configurations. Select layer count, dielectric thickness, and copper weight to get target trace width for 50\u03A9 or custom impedance.",
  keywords: [
    "pcb stackup calculator",
    "pcb layer stack",
    "stackup impedance",
    "pcb dielectric thickness",
    "impedance control stackup"
  ],
  inputs: [
    {
      key: "layerCount",
      label: "Layer Count",
      symbol: "N",
      unit: "",
      defaultValue: 4,
      min: 2,
      max: 8,
      step: 2,
      tooltip: "Number of copper layers (even numbers only)",
      presets: [
        { label: "2-layer", values: { layerCount: 2 } },
        { label: "4-layer", values: { layerCount: 4 } },
        { label: "6-layer", values: { layerCount: 6 } },
        { label: "8-layer", values: { layerCount: 8 } }
      ]
    },
    {
      key: "targetImpedance",
      label: "Target Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      defaultValue: 50,
      min: 25,
      max: 150,
      step: 1,
      tooltip: "Target characteristic impedance for trace width calculation"
    },
    {
      key: "dielectricH1",
      label: "Dielectric H1 (L1 to L2)",
      symbol: "H1",
      unit: "mm",
      defaultValue: 0.2,
      min: 0.05,
      max: 2,
      step: 0.01,
      tooltip: "Prepreg thickness between L1 (top) and L2"
    },
    {
      key: "dielectricH2",
      label: "Dielectric H2 (L2 to L3 core)",
      symbol: "H2",
      unit: "mm",
      defaultValue: 1.2,
      min: 0.1,
      max: 5,
      step: 0.05,
      tooltip: "Core thickness between L2 and L3"
    },
    {
      key: "dielectricH3",
      label: "Dielectric H3 (L3 to L4)",
      symbol: "H3",
      unit: "mm",
      defaultValue: 0.2,
      min: 0.05,
      max: 2,
      step: 0.01,
      tooltip: "Prepreg thickness between L3 and L4 (bottom)"
    },
    {
      key: "copperWeight",
      label: "Copper Weight",
      symbol: "T_cu",
      unit: "oz",
      defaultValue: 1,
      min: 0.5,
      max: 3,
      step: 0.5,
      tooltip: "Copper foil weight (1 oz = 35 \u03BCm)",
      presets: [
        { label: "0.5 oz", values: { copperWeight: 0.5 } },
        { label: "1 oz (standard)", values: { copperWeight: 1 } },
        { label: "2 oz", values: { copperWeight: 2 } }
      ]
    },
    {
      key: "dielectricConstant",
      label: "Dielectric Constant",
      symbol: "\u03B5\u1D63",
      unit: "",
      defaultValue: 4.2,
      min: 2,
      max: 12,
      step: 0.01,
      tooltip: "Relative permittivity of the board material at design frequency",
      presets: [
        { label: "FR4 (4.2)", values: { dielectricConstant: 4.2 } },
        { label: "FR4-HF (3.8)", values: { dielectricConstant: 3.8 } },
        { label: "Rogers 4003C (3.38)", values: { dielectricConstant: 3.38 } },
        { label: "Rogers 4350B (3.48)", values: { dielectricConstant: 3.48 } }
      ]
    }
  ],
  outputs: [
    {
      key: "traceWidthL1mm",
      label: "Trace Width L1 (surface)",
      symbol: "W_L1",
      unit: "mm",
      precision: 3,
      format: "standard",
      tooltip: "Trace width for target impedance on L1 (surface microstrip over L2)"
    },
    {
      key: "traceWidthL3mm",
      label: "Trace Width L3 (inner)",
      symbol: "W_L3",
      unit: "mm",
      precision: 3,
      format: "standard",
      tooltip: "Trace width for target impedance on L3 (inner microstrip referencing L2)"
    },
    {
      key: "achievedImpedanceL1",
      label: "Achieved Z\u2080 L1",
      symbol: "Z\u2080_L1",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Actual impedance achieved with calculated L1 trace width (Hammerstad-Jensen verification)",
      thresholds: {
        good: { min: 48, max: 52 },
        warning: { min: 45, max: 55 }
      }
    },
    {
      key: "achievedImpedanceL3",
      label: "Achieved Z\u2080 L3",
      symbol: "Z\u2080_L3",
      unit: "\u03A9",
      precision: 2,
      format: "standard",
      tooltip: "Actual impedance achieved with calculated L3 trace width (Hammerstad-Jensen verification)",
      thresholds: {
        good: { min: 48, max: 52 },
        warning: { min: 45, max: 55 }
      }
    },
    {
      key: "totalThicknessMm",
      label: "Total Board Thickness",
      symbol: "T_board",
      unit: "mm",
      precision: 3,
      format: "standard",
      tooltip: "Sum of all dielectric layers (H1 + H2 + H3)"
    }
  ],
  calculate: calculateStackup,
  formula: {
    primary: "A = \\frac{Z_0}{60}\\sqrt{\\frac{\\varepsilon_r+1}{2}} + \\frac{\\varepsilon_r-1}{\\varepsilon_r+1}\\left(0.23+\\frac{0.11}{\\varepsilon_r}\\right),\\quad \\frac{W}{H} = \\frac{8e^A}{e^{2A}-2}",
    variables: [
      { symbol: "Z\u2080", description: "Target characteristic impedance", unit: "\u03A9" },
      { symbol: "\u03B5\u1D63", description: "Dielectric constant", unit: "" },
      { symbol: "A", description: "Wheeler intermediate parameter", unit: "" },
      { symbol: "W/H", description: "Trace width to height ratio", unit: "" },
      { symbol: "H", description: "Dielectric layer thickness", unit: "mm" }
    ],
    reference: 'Wheeler (1977); Pozar "Microwave Engineering" 4th ed.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["microstrip-impedance", "differential-pair", "trace-width-current"],
  verificationData: [
    {
      inputs: {
        layerCount: 4,
        targetImpedance: 50,
        dielectricH1: 0.2,
        dielectricH2: 1.2,
        dielectricH3: 0.2,
        copperWeight: 1,
        dielectricConstant: 4.2
      },
      expectedOutputs: { totalThicknessMm: 1.6 },
      tolerance: 0.01,
      source: "0.2 + 1.2 + 0.2 = 1.6mm standard 4L"
    }
  ]
};

// src/lib/calculators/power/voltage-divider.ts
function calculateVoltageDivider(inputs) {
  const { vin, r1, r2 } = inputs;
  if (r1 + r2 === 0) return { values: {}, errors: ["R1 + R2 must be > 0"] };
  const vout = vin * r2 / (r1 + r2);
  const current = vin / (r1 + r2);
  const rThev = r1 * r2 / (r1 + r2);
  const powerR1 = current * current * r1;
  const powerR2 = current * current * r2;
  const ratio = r2 / (r1 + r2);
  return {
    values: {
      vout: Math.round(vout * 1e4) / 1e4,
      current: Math.round(current * 1e6) / 1e6,
      rThev: Math.round(rThev * 100) / 100,
      powerR1: Math.round(powerR1 * 1e6) / 1e6,
      powerR2: Math.round(powerR2 * 1e6) / 1e6,
      ratio: Math.round(ratio * 1e4) / 1e4
    }
  };
}
var voltageDivider = {
  slug: "voltage-divider",
  title: "Voltage Divider Calculator",
  shortTitle: "Voltage Divider",
  category: "power",
  description: "Calculate voltage divider output voltage, current, Th\xE9venin impedance, and power dissipation from Vin, R1, and R2. Ideal for bias networks and level shifting.",
  keywords: ["voltage divider calculator", "resistor divider", "voltage divider formula", "thevenin impedance", "vout calculator"],
  inputs: [
    {
      key: "vin",
      label: "Input Voltage",
      symbol: "V\u1D62\u2099",
      unit: "V",
      defaultValue: 5,
      min: 0,
      max: 1e3,
      step: 0.1
    },
    {
      key: "r1",
      label: "R1 (top)",
      symbol: "R\u2081",
      unit: "\u03A9",
      defaultValue: 1e4,
      min: 1,
      max: 1e7,
      step: 100,
      unitOptions: [
        { label: "\u03A9", factor: 1 },
        { label: "k\u03A9", factor: 1e3 },
        { label: "M\u03A9", factor: 1e6 }
      ]
    },
    {
      key: "r2",
      label: "R2 (bottom)",
      symbol: "R\u2082",
      unit: "\u03A9",
      defaultValue: 1e4,
      min: 1,
      max: 1e7,
      step: 100,
      unitOptions: [
        { label: "\u03A9", factor: 1 },
        { label: "k\u03A9", factor: 1e3 },
        { label: "M\u03A9", factor: 1e6 }
      ]
    }
  ],
  outputs: [
    {
      key: "vout",
      label: "Output Voltage",
      symbol: "V\u2092\u1D64\u209C",
      unit: "V",
      precision: 4
    },
    {
      key: "ratio",
      label: "Division Ratio",
      symbol: "R\u2082/(R\u2081+R\u2082)",
      unit: "",
      precision: 4
    },
    {
      key: "current",
      label: "Quiescent Current",
      unit: "A",
      precision: 6,
      format: "engineering"
    },
    {
      key: "rThev",
      label: "Th\xE9venin Impedance",
      symbol: "R\u209C\u2095",
      unit: "\u03A9",
      precision: 2
    },
    {
      key: "powerR1",
      label: "Power in R1",
      unit: "W",
      precision: 6,
      format: "engineering"
    },
    {
      key: "powerR2",
      label: "Power in R2",
      unit: "W",
      precision: 6,
      format: "engineering"
    }
  ],
  calculate: calculateVoltageDivider,
  exportComponents: (inputs) => {
    const fmtR = (ohm) => ohm >= 1e6 ? `${+(ohm / 1e6).toPrecision(3)} M\u03A9` : ohm >= 1e3 ? `${+(ohm / 1e3).toPrecision(3)} k\u03A9` : `${ohm} \u03A9`;
    return [
      { qty: 1, description: "R1 (top)", value: fmtR(inputs.r1), package: "0402", componentType: "R", placement: "series" },
      { qty: 1, description: "R2 (bottom)", value: fmtR(inputs.r2), package: "0402", componentType: "R", placement: "shunt" }
    ];
  },
  schematicSections: (inputs) => {
    const fmtR = (ohm) => ohm >= 1e6 ? `${+(ohm / 1e6).toPrecision(3)}M\u03A9` : ohm >= 1e3 ? `${+(ohm / 1e3).toPrecision(3)}k\u03A9` : `${ohm}\u03A9`;
    return [{
      label: "Voltage Divider",
      elements: [
        { type: "R", placement: "series", label: `R1 ${fmtR(inputs.r1)}` },
        { type: "R", placement: "shunt", label: `R2 ${fmtR(inputs.r2)}` }
      ]
    }];
  },
  formula: {
    primary: "V_{out} = V_{in} \\cdot \\frac{R_2}{R_1 + R_2}",
    variables: [
      { symbol: "V\u1D62\u2099", description: "Input voltage", unit: "V" },
      { symbol: "R\u2081", description: "Top resistor", unit: "\u03A9" },
      { symbol: "R\u2082", description: "Bottom resistor", unit: "\u03A9" }
    ]
  },
  visualization: { type: "circuit-schematic", svgId: "voltage-divider" },
  relatedCalculators: ["ohms-law", "led-resistor"],
  verificationData: [
    {
      inputs: { vin: 10, r1: 1e4, r2: 1e4 },
      expectedOutputs: { vout: 5, ratio: 0.5, rThev: 5e3 },
      tolerance: 1e-3,
      source: "Trivial: equal resistors"
    }
  ]
};

// src/lib/calculators/power/led-resistor.ts
function calculateLEDResistor(inputs) {
  const { vSupply, vForward, iForward } = inputs;
  const vDrop = vSupply - vForward;
  if (vDrop <= 0) {
    return { values: {}, errors: ["Supply voltage must be greater than LED forward voltage"] };
  }
  const rExact = vDrop / (iForward / 1e3);
  const power = vDrop * (iForward / 1e3);
  const e24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
  const decades = [1, 10, 100, 1e3, 1e4, 1e5];
  let nearest = rExact;
  let minErr = Infinity;
  for (const dec of decades) {
    for (const v of e24) {
      const val = v * dec;
      const err = Math.abs(val - rExact) / rExact;
      if (err < minErr) {
        minErr = err;
        nearest = val;
      }
    }
  }
  const iActual = vDrop / nearest * 1e3;
  const pNearest = vDrop * (iActual / 1e3);
  return {
    values: {
      rExact: Math.round(rExact * 100) / 100,
      rNearest: nearest,
      iActual: Math.round(iActual * 100) / 100,
      power: Math.round(power * 1e4) / 1e4,
      pNearest: Math.round(pNearest * 1e4) / 1e4
    }
  };
}
var ledResistor = {
  slug: "led-resistor",
  title: "LED Current Limiting Resistor Calculator",
  shortTitle: "LED Resistor",
  category: "power",
  description: "Calculate the correct current limiting resistor for an LED. Shows exact value, nearest E24 standard, actual current, and power dissipation.",
  keywords: ["led resistor calculator", "led current limiting resistor", "led series resistor", "led circuit calculator"],
  inputs: [
    {
      key: "vSupply",
      label: "Supply Voltage",
      symbol: "Vs",
      unit: "V",
      defaultValue: 5,
      min: 0.1,
      max: 48,
      step: 0.1,
      presets: [
        { label: "3.3 V", values: { vSupply: 3.3 } },
        { label: "5 V", values: { vSupply: 5 } },
        { label: "12 V", values: { vSupply: 12 } },
        { label: "24 V", values: { vSupply: 24 } }
      ]
    },
    {
      key: "vForward",
      label: "LED Forward Voltage",
      symbol: "Vf",
      unit: "V",
      defaultValue: 2,
      min: 0.5,
      max: 5,
      step: 0.05,
      presets: [
        { label: "Red (1.8\u20132.0 V)", values: { vForward: 1.9 } },
        { label: "Yellow/Green (2.0\u20132.2 V)", values: { vForward: 2.1 } },
        { label: "Blue/White (3.0\u20133.4 V)", values: { vForward: 3.2 } },
        { label: "IR (1.2\u20131.5 V)", values: { vForward: 1.3 } }
      ]
    },
    {
      key: "iForward",
      label: "Desired Current",
      symbol: "If",
      unit: "mA",
      defaultValue: 20,
      min: 0.1,
      max: 1e3,
      step: 1,
      presets: [
        { label: "1 mA (indicator)", values: { iForward: 1 } },
        { label: "5 mA (low power)", values: { iForward: 5 } },
        { label: "20 mA (standard)", values: { iForward: 20 } },
        { label: "50 mA (high brightness)", values: { iForward: 50 } }
      ]
    }
  ],
  outputs: [
    { key: "rExact", label: "Exact Resistance", unit: "\u03A9", precision: 2 },
    { key: "rNearest", label: "Nearest E24", unit: "\u03A9", precision: 0 },
    { key: "iActual", label: "Actual Current", unit: "mA", precision: 2 },
    { key: "power", label: "Power (exact R)", unit: "W", precision: 4, format: "engineering" },
    { key: "pNearest", label: "Power (E24 R)", unit: "W", precision: 4, format: "engineering" }
  ],
  calculate: calculateLEDResistor,
  formula: {
    primary: "R = \\frac{V_s - V_f}{I_f}",
    variables: [
      { symbol: "Vs", description: "Supply voltage", unit: "V" },
      { symbol: "Vf", description: "LED forward voltage", unit: "V" },
      { symbol: "If", description: "Desired forward current", unit: "A" }
    ]
  },
  visualization: { type: "circuit-schematic", svgId: "led-resistor" },
  relatedCalculators: ["voltage-divider", "ohms-law"],
  exportComponents: (_inputs, outputs) => {
    const r = outputs?.rNearest ?? 0;
    const fmtR = (ohm) => ohm >= 1e6 ? `${+(ohm / 1e6).toPrecision(3)} M\u03A9` : ohm >= 1e3 ? `${+(ohm / 1e3).toPrecision(3)} k\u03A9` : `${ohm} \u03A9`;
    return [
      { qty: 1, description: "R (current limiting)", value: fmtR(r), package: "0402", componentType: "R", placement: "series" }
    ];
  },
  verificationData: [
    {
      inputs: { vSupply: 5, vForward: 2, iForward: 20 },
      expectedOutputs: { rExact: 150 },
      tolerance: 1e-3,
      source: "Trivial: (5-2)/0.02 = 150\u03A9"
    }
  ]
};

// src/lib/calculators/power/buck-converter.ts
function calculateBuckConverter(inputs) {
  const { vin, vout, iout, fsw, deltaIL, deltaVout } = inputs;
  if (vout >= vin) {
    return { values: {}, errors: ["Output voltage must be less than input voltage"] };
  }
  const D = vout / vin;
  const fsw_Hz = fsw * 1e3;
  const deltaIL_A = deltaIL / 100 * iout;
  const L_min = (vin - vout) * D / (fsw_Hz * deltaIL_A);
  const inductorUH = L_min * 1e6;
  const deltaVout_V = deltaVout / 100 * vout;
  const Cout_min = deltaIL_A / (8 * fsw_Hz * deltaVout_V);
  const coutUF = Cout_min * 1e6;
  const Cin_min = iout * D * (1 - D) / (fsw_Hz * deltaVout_V);
  const cinUF = Cin_min * 1e6;
  const ilPeak = iout + deltaIL_A / 2;
  const dutyCycle = D * 100;
  return {
    values: {
      dutyCycle,
      inductorUH,
      coutUF,
      cinUF,
      ilPeak
    }
  };
}
var buckConverter = {
  slug: "buck-converter",
  title: "Buck Converter Design Calculator",
  shortTitle: "Buck Converter",
  category: "power",
  description: "Design a synchronous buck (step-down) converter: calculate duty cycle, inductor value, output capacitor, and input capacitor.",
  keywords: ["buck converter calculator", "step down converter", "dc dc converter design", "inductor value buck", "duty cycle calculator", "switching regulator design"],
  inputs: [
    {
      key: "vin",
      label: "Input Voltage",
      symbol: "V\u1D62\u2099",
      unit: "V",
      defaultValue: 12,
      min: 1,
      max: 100
    },
    {
      key: "vout",
      label: "Output Voltage",
      symbol: "V\u2092\u1D64\u209C",
      unit: "V",
      defaultValue: 5,
      min: 0.5,
      max: 99
    },
    {
      key: "iout",
      label: "Output Current",
      symbol: "I\u2092\u1D64\u209C",
      unit: "A",
      defaultValue: 1,
      min: 0.01,
      max: 50
    },
    {
      key: "fsw",
      label: "Switching Frequency",
      symbol: "f\u209Bw",
      unit: "kHz",
      defaultValue: 500,
      min: 10,
      max: 5e3,
      unitOptions: [
        { label: "kHz", factor: 1 },
        { label: "MHz", factor: 1e3 }
      ],
      presets: [
        { label: "100 kHz", values: { fsw: 100 } },
        { label: "300 kHz", values: { fsw: 300 } },
        { label: "500 kHz", values: { fsw: 500 } },
        { label: "1 MHz", values: { fsw: 1e3 } }
      ]
    },
    {
      key: "deltaIL",
      label: "Inductor Current Ripple",
      symbol: "\u0394IL",
      unit: "%",
      defaultValue: 30,
      min: 5,
      max: 80,
      tooltip: "Inductor current ripple as % of output current. Typical: 20-40%."
    },
    {
      key: "deltaVout",
      label: "Output Voltage Ripple",
      symbol: "\u0394V\u2092\u1D64\u209C",
      unit: "%",
      defaultValue: 1,
      min: 0.1,
      max: 10,
      tooltip: "Output voltage ripple as % of Vout. Typical: 0.5-2%."
    }
  ],
  outputs: [
    {
      key: "dutyCycle",
      label: "Duty Cycle",
      symbol: "D",
      unit: "%",
      precision: 2,
      thresholds: {
        good: { min: 5, max: 90 },
        danger: { min: 5 }
      }
    },
    {
      key: "inductorUH",
      label: "Minimum Inductance",
      symbol: "L\u2098\u1D62\u2099",
      unit: "\u03BCH",
      precision: 3
    },
    {
      key: "coutUF",
      label: "Output Capacitance",
      symbol: "C\u2092\u1D64\u209C",
      unit: "\u03BCF",
      precision: 3
    },
    {
      key: "cinUF",
      label: "Input Capacitance",
      symbol: "C\u1D62\u2099",
      unit: "\u03BCF",
      precision: 3
    },
    {
      key: "ilPeak",
      label: "Peak Inductor Current",
      symbol: "IL_peak",
      unit: "A",
      precision: 3
    }
  ],
  calculate: calculateBuckConverter,
  formula: {
    primary: "D = \\frac{V_{out}}{V_{in}},\\quad L_{min} = \\frac{(V_{in}-V_{out})\\cdot D}{f_{sw}\\cdot \\Delta I_L}",
    variables: [
      { symbol: "D", description: "Duty cycle", unit: "" },
      { symbol: "V\u1D62\u2099", description: "Input voltage", unit: "V" },
      { symbol: "V\u2092\u1D64\u209C", description: "Output voltage", unit: "V" },
      { symbol: "f\u209Bw", description: "Switching frequency", unit: "Hz" },
      { symbol: "\u0394IL", description: "Inductor current ripple", unit: "A" }
    ],
    reference: 'Erickson & Maksimovic, "Fundamentals of Power Electronics" 3rd ed.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["ldo-thermal", "voltage-divider"],
  verificationData: [
    {
      inputs: { vin: 12, vout: 5, iout: 1, fsw: 500, deltaIL: 30, deltaVout: 1 },
      expectedOutputs: { dutyCycle: 41.67, inductorUH: 19.44 },
      tolerance: 0.02,
      source: "Erickson & Maksimovic example"
    }
  ]
};

// src/lib/calculators/power/ldo-thermal.ts
function calculateLdoThermal(inputs) {
  const { vin, vout, iload, thetaJA, tamb, tjMax } = inputs;
  if (vout >= vin) {
    return { values: {}, errors: ["Output voltage must be less than input voltage"] };
  }
  const iload_A = iload / 1e3;
  const pdiss = (vin - vout) * iload_A;
  const tj = tamb + thetaJA * pdiss;
  if (tj > tjMax) {
    return {
      values: {},
      errors: ["Junction temperature exceeds maximum \u2014 increase heatsinking or reduce load"]
    };
  }
  const margin = tjMax - tj;
  const dropoutV = vin - vout;
  const efficiencyPct = vout / vin * 100;
  return {
    values: {
      pdiss,
      tj,
      margin,
      dropoutV,
      efficiencyPct
    }
  };
}
var ldoThermal = {
  slug: "ldo-thermal",
  title: "LDO Thermal Calculator",
  shortTitle: "LDO Thermal",
  category: "power",
  description: "Calculate LDO regulator power dissipation, junction temperature, thermal margin, and minimum dropout voltage for thermal design validation.",
  keywords: ["ldo thermal calculator", "linear regulator thermal", "junction temperature", "power dissipation ldo", "thermal resistance", "dropout voltage"],
  inputs: [
    {
      key: "vin",
      label: "Input Voltage",
      symbol: "V\u1D62\u2099",
      unit: "V",
      defaultValue: 5,
      min: 0.5,
      max: 60
    },
    {
      key: "vout",
      label: "Output Voltage",
      symbol: "V\u2092\u1D64\u209C",
      unit: "V",
      defaultValue: 3.3,
      min: 0.5,
      max: 59
    },
    {
      key: "iload",
      label: "Load Current",
      symbol: "I\u2097\u2092\u2090d",
      unit: "mA",
      defaultValue: 500,
      min: 1,
      max: 5e3
    },
    {
      key: "thetaJA",
      label: "Thermal Resistance \u03B8JA",
      symbol: "\u03B8JA",
      unit: "\xB0C/W",
      defaultValue: 50,
      min: 1,
      max: 500,
      tooltip: "\u03B8JA from datasheet. SOT-23: ~150\xB0C/W, TO-252: ~50\xB0C/W, TO-220: ~5\xB0C/W",
      presets: [
        { label: "SOT-23 (150)", values: { thetaJA: 150 } },
        { label: "SOT-223 (70)", values: { thetaJA: 70 } },
        { label: "TO-252 (50)", values: { thetaJA: 50 } },
        { label: "TO-220 (5)", values: { thetaJA: 5 } }
      ]
    },
    {
      key: "tamb",
      label: "Ambient Temperature",
      symbol: "T\u2090\u2098b",
      unit: "\xB0C",
      defaultValue: 25,
      min: -40,
      max: 85
    },
    {
      key: "tjMax",
      label: "Max Junction Temperature",
      symbol: "TJ_max",
      unit: "\xB0C",
      defaultValue: 125,
      min: 85,
      max: 175,
      presets: [
        { label: "125\xB0C", values: { tjMax: 125 } },
        { label: "150\xB0C", values: { tjMax: 150 } },
        { label: "175\xB0C", values: { tjMax: 175 } }
      ]
    }
  ],
  outputs: [
    {
      key: "pdiss",
      label: "Power Dissipation",
      symbol: "Pdiss",
      unit: "W",
      precision: 3,
      thresholds: {
        good: { max: 0.5 },
        warning: { max: 1 },
        danger: { max: 2 }
      }
    },
    {
      key: "tj",
      label: "Junction Temperature",
      symbol: "TJ",
      unit: "\xB0C",
      precision: 1,
      thresholds: {
        good: { max: 100 },
        warning: { max: 115 },
        danger: { max: 125 }
      }
    },
    {
      key: "margin",
      label: "Thermal Headroom",
      symbol: "\u0394T",
      unit: "\xB0C",
      precision: 1,
      thresholds: {
        good: { min: 25 },
        warning: { min: 10 },
        danger: { min: 0 }
      }
    },
    {
      key: "dropoutV",
      label: "Dropout Voltage",
      symbol: "Vdropout",
      unit: "V",
      precision: 3
    },
    {
      key: "efficiencyPct",
      label: "Efficiency",
      symbol: "\u03B7",
      unit: "%",
      precision: 1,
      thresholds: {
        warning: { max: 70 },
        danger: { max: 50 }
      }
    }
  ],
  calculate: calculateLdoThermal,
  formula: {
    primary: "P_{diss} = (V_{in} - V_{out}) \\cdot I_{load},\\quad T_J = T_{amb} + \\theta_{JA} \\cdot P_{diss}",
    variables: [
      { symbol: "Pdiss", description: "Power dissipation", unit: "W" },
      { symbol: "V\u1D62\u2099", description: "Input voltage", unit: "V" },
      { symbol: "V\u2092\u1D64\u209C", description: "Output voltage", unit: "V" },
      { symbol: "I\u2097\u2092\u2090d", description: "Load current", unit: "A" },
      { symbol: "TJ", description: "Junction temperature", unit: "\xB0C" },
      { symbol: "T\u2090\u2098b", description: "Ambient temperature", unit: "\xB0C" },
      { symbol: "\u03B8JA", description: "Thermal resistance junction-to-ambient", unit: "\xB0C/W" }
    ],
    reference: "Texas Instruments Application Note SLVA061; IEC 60747-6"
  },
  visualization: { type: "none" },
  relatedCalculators: ["buck-converter", "voltage-divider"],
  verificationData: [
    {
      inputs: { vin: 5, vout: 3.3, iload: 500, thetaJA: 50, tamb: 25, tjMax: 125 },
      expectedOutputs: { pdiss: 0.85, tj: 67.5, margin: 57.5 },
      tolerance: 0.01,
      source: "TI LDO design guide"
    }
  ]
};

// src/lib/calculators/power/battery-life.ts
function calculateBatteryLife(inputs) {
  const { capacity, avgCurrent, dutyCycle, selfDischarge, cutoffSoc } = inputs;
  if (capacity <= 0) {
    return { values: {}, errors: ["Capacity must be greater than zero"] };
  }
  if (avgCurrent <= 0) {
    return { values: {}, errors: ["Average current must be greater than zero"] };
  }
  const effectiveCurrent = avgCurrent * (dutyCycle / 100);
  const usableCapacity = capacity * (1 - cutoffSoc / 100);
  const selfDischargePerHour = capacity * (selfDischarge / 100) / (30 * 24);
  const totalDrainPerHour = effectiveCurrent + selfDischargePerHour;
  if (totalDrainPerHour <= 0) {
    return { values: {}, errors: ["Total drain per hour must be greater than zero"] };
  }
  const runtimeHours = usableCapacity / totalDrainPerHour;
  const runtimeDays = runtimeHours / 24;
  const usableCapacityMAh = usableCapacity;
  return {
    values: {
      runtimeHours: Math.round(runtimeHours * 10) / 10,
      runtimeDays: Math.round(runtimeDays * 100) / 100,
      effectiveCurrent: Math.round(effectiveCurrent * 100) / 100,
      usableCapacityMAh: Math.round(usableCapacityMAh)
    }
  };
}
var batteryLife = {
  slug: "battery-life",
  title: "Battery Life Calculator",
  shortTitle: "Battery Life",
  category: "power",
  description: "Estimate battery runtime for IoT and portable devices given average current draw, duty cycle, self-discharge rate, and depth-of-discharge cutoff. Suitable for LiPo, alkaline, NiMH, and coin-cell batteries.",
  keywords: ["battery life calculator", "battery runtime", "iot battery life", "duty cycle battery", "mah runtime calculator", "self-discharge battery", "battery capacity hours"],
  inputs: [
    {
      key: "capacity",
      label: "Battery Capacity",
      symbol: "C",
      unit: "mAh",
      defaultValue: 2e3,
      min: 1,
      max: 1e5,
      presets: [
        { label: "AA (2500 mAh)", values: { capacity: 2500 } },
        { label: "18650 (3000 mAh)", values: { capacity: 3e3 } },
        { label: "LiPo 1S (1000 mAh)", values: { capacity: 1e3 } },
        { label: "CR2032 (230 mAh)", values: { capacity: 230 } }
      ]
    },
    {
      key: "avgCurrent",
      label: "Average Current Draw",
      symbol: "I\u2090\u1D65g",
      unit: "mA",
      defaultValue: 100,
      min: 1e-3,
      max: 1e4,
      tooltip: "Average current drawn by the device during active operation"
    },
    {
      key: "dutyCycle",
      label: "Duty Cycle",
      symbol: "D",
      unit: "%",
      defaultValue: 100,
      min: 1e-3,
      max: 100,
      tooltip: "Percentage of time the device is active and drawing current. 100% = continuous operation.",
      presets: [
        { label: "Continuous (100%)", values: { dutyCycle: 100 } },
        { label: "50%", values: { dutyCycle: 50 } },
        { label: "10%", values: { dutyCycle: 10 } },
        { label: "1%", values: { dutyCycle: 1 } }
      ]
    },
    {
      key: "selfDischarge",
      label: "Self-Discharge Rate",
      symbol: "R\u209Bd",
      unit: "%/month",
      defaultValue: 2,
      min: 0,
      max: 30,
      tooltip: "Monthly self-discharge rate of the battery. LiPo: ~2%, NiMH: ~15%, Alkaline: ~1%",
      presets: [
        { label: "LiPo (2%/mo)", values: { selfDischarge: 2 } },
        { label: "NiMH (15%/mo)", values: { selfDischarge: 15 } },
        { label: "Alkaline (1%/mo)", values: { selfDischarge: 1 } },
        { label: "None (0%)", values: { selfDischarge: 0 } }
      ]
    },
    {
      key: "cutoffSoc",
      label: "Cutoff State of Charge",
      symbol: "SoC_min",
      unit: "%",
      defaultValue: 20,
      min: 0,
      max: 80,
      tooltip: "Minimum state of charge at which the device stops operating. 20% = device shuts off with 20% capacity remaining."
    }
  ],
  outputs: [
    {
      key: "runtimeHours",
      label: "Runtime",
      symbol: "t",
      unit: "h",
      precision: 1,
      tooltip: "Estimated battery runtime in hours"
    },
    {
      key: "runtimeDays",
      label: "Runtime",
      symbol: "t_days",
      unit: "days",
      precision: 2,
      tooltip: "Estimated battery runtime in days",
      thresholds: {
        good: { min: 7 },
        warning: { min: 1, max: 7 },
        danger: { min: 1 }
      }
    },
    {
      key: "effectiveCurrent",
      label: "Effective Current",
      symbol: "I_eff",
      unit: "mA",
      precision: 2,
      tooltip: "Actual average current after applying duty cycle"
    },
    {
      key: "usableCapacityMAh",
      label: "Usable Capacity",
      symbol: "C_usable",
      unit: "mAh",
      precision: 0,
      tooltip: "Capacity available after accounting for the cutoff state of charge"
    }
  ],
  calculate: calculateBatteryLife,
  formula: {
    primary: "I_{eff} = I_{avg} \\cdot \\frac{D}{100},\\quad t = \\frac{C \\cdot (1 - SoC_{min}/100)}{I_{eff} + R_{sd}}",
    variables: [
      { symbol: "I_eff", description: "Effective current after duty cycle", unit: "mA" },
      { symbol: "I_avg", description: "Average current draw", unit: "mA" },
      { symbol: "D", description: "Duty cycle", unit: "%" },
      { symbol: "C", description: "Battery capacity", unit: "mAh" },
      { symbol: "SoC_min", description: "Cutoff state of charge", unit: "%" },
      { symbol: "R_sd", description: "Self-discharge per hour", unit: "mAh/h" }
    ],
    derivation: [
      "Effective current = avgCurrent \xD7 (dutyCycle / 100)",
      "Usable capacity = capacity \xD7 (1 \u2212 cutoffSoc / 100)",
      "Self-discharge per hour = capacity \xD7 (selfDischarge / 100) / (30 \xD7 24)",
      "Total drain per hour = effectiveCurrent + selfDischargePerHour",
      "Runtime (h) = usableCapacity / totalDrainPerHour"
    ],
    reference: "Nordic Semiconductor PWR Profiler methodology; Texas Instruments SLUA364"
  },
  visualization: { type: "none" },
  relatedCalculators: ["buck-converter", "ldo-thermal", "voltage-divider"],
  verificationData: [
    {
      inputs: { capacity: 2e3, avgCurrent: 100, dutyCycle: 100, selfDischarge: 2, cutoffSoc: 20 },
      expectedOutputs: { runtimeHours: 15.99, runtimeDays: 0.67 },
      tolerance: 0.02,
      source: "Direct calculation: usable=1600mAh, selfDisch=0.05556mAh/hr, total=100.0556mAh/hr, t=1600/100.0556=15.99h"
    }
  ]
};

// src/lib/e-series.ts
var E12_BASE = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
var E24_BASE = [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
var E48_BASE = [1, 1.05, 1.1, 1.15, 1.21, 1.27, 1.33, 1.4, 1.47, 1.54, 1.62, 1.69, 1.78, 1.87, 1.96, 2.05, 2.15, 2.26, 2.37, 2.49, 2.61, 2.74, 2.87, 3.01, 3.16, 3.32, 3.48, 3.65, 3.83, 4.02, 4.22, 4.42, 4.64, 4.87, 5.11, 5.36, 5.62, 5.9, 6.19, 6.49, 6.81, 7.15, 7.5, 7.87, 8.25, 8.66, 9.09, 9.53];
var E96_BASE = [1, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.4, 1.43, 1.47, 1.5, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74, 1.78, 1.82, 1.87, 1.91, 1.96, 2, 2.05, 2.1, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.8, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24, 3.32, 3.4, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49, 5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32, 7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76];
var SERIES_MAP = {
  E12: E12_BASE,
  E24: E24_BASE,
  E48: E48_BASE,
  E96: E96_BASE
};
function snapToESeries(value, series) {
  if (value <= 0) return { snapped: 0, error: 0 };
  const base = SERIES_MAP[series];
  const exponent = Math.floor(Math.log10(value));
  const mantissa = value / Math.pow(10, exponent);
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < base.length; i++) {
    const dist = Math.abs(mantissa - base[i]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  const distToNext = Math.abs(mantissa - 10);
  let snapped;
  if (distToNext < bestDist) {
    snapped = Math.pow(10, exponent + 1);
  } else {
    snapped = base[bestIdx] * Math.pow(10, exponent);
  }
  const error = (snapped - value) / value * 100;
  return { snapped, error };
}

// src/lib/calculators/signal/filter-designer.ts
var BUTTERWORTH_G = {
  1: [1],
  2: [1.4142, 1.4142],
  3: [1, 2, 1],
  4: [0.7654, 1.8478, 1.8478, 0.7654],
  5: [0.618, 1.618, 2, 1.618, 0.618],
  6: [0.5176, 1.4142, 1.9319, 1.9319, 1.4142, 0.5176],
  7: [0.445, 1.247, 1.8019, 2, 1.8019, 1.247, 0.445],
  8: [0.3902, 1.1111, 1.6629, 1.9616, 1.9616, 1.6629, 1.1111, 0.3902],
  9: [0.3473, 1, 1.5321, 1.8794, 2, 1.8794, 1.5321, 1, 0.3473],
  10: [0.3129, 0.908, 1.4142, 1.782, 1.9754, 1.9754, 1.782, 1.4142, 0.908, 0.3129]
};
var CHEBYSHEV_05_G = {
  1: [0.6986],
  2: [1.4029, 0.7071],
  3: [1.5963, 1.0967, 1.5963],
  4: [1.6703, 1.1926, 1.5733, 0.8419],
  5: [1.7058, 1.2296, 1.5963, 1.2296, 1.7058],
  6: [1.7254, 1.2479, 1.6032, 1.2479, 1.7254, 0.8696],
  7: [1.7372, 1.2583, 1.6062, 1.2583, 1.7372, 1.2583, 1.7372],
  8: [1.7451, 1.2647, 1.6075, 1.2647, 1.7451, 1.2647, 1.7451, 0.8796],
  9: [1.7504, 1.269, 1.6082, 1.269, 1.7504, 1.269, 1.7504, 1.269, 1.7504],
  10: [1.7543, 1.2721, 1.6087, 1.2721, 1.7543, 1.2721, 1.7543, 1.2721, 1.7543, 0.8842]
};
function calculateFilterDesigner(inputs) {
  const { responseType = 0, filterType, fc, order, impedance, qFactor: qFactor2, eSeries = 0 } = inputs;
  if (fc <= 0) {
    return { values: {}, errors: ["Cutoff frequency must be greater than zero"] };
  }
  if (impedance <= 0) {
    return { values: {}, errors: ["Impedance must be greater than zero"] };
  }
  const clampedOrder = Math.round(Math.min(10, Math.max(1, order)));
  const omega_c = 2 * Math.PI * fc;
  const isChebyshev = Math.round(responseType) === 1;
  const gTable = isChebyshev ? CHEBYSHEV_05_G : BUTTERWORTH_G;
  const g = gTable[clampedOrder] ?? gTable[1];
  const tau = 1 / omega_c;
  const tau_ns = clampedOrder === 1 && !isChebyshev ? tau * 1e9 : 0;
  const elementC_nF = [0, 0, 0, 0, 0];
  const elementL_uH = [0, 0, 0, 0, 0];
  if (clampedOrder === 1 && !isChebyshev) {
    elementC_nF[0] = tau / impedance * 1e9;
    elementL_uH[0] = 0;
  } else {
    for (let k = 0; k < clampedOrder; k++) {
      const gk = g[k];
      if (k % 2 === 0) {
        const cIndex = Math.floor(k / 2);
        if (filterType === 1) {
          elementL_uH[cIndex] = impedance / (omega_c * gk) * 1e6;
        } else {
          elementC_nF[cIndex] = gk / (omega_c * impedance) * 1e9;
        }
      } else {
        const lIndex = Math.floor(k / 2);
        if (filterType === 1) {
          elementC_nF[lIndex] = 1 / (omega_c * gk * impedance) * 1e9;
        } else {
          elementL_uH[lIndex] = gk * impedance / omega_c * 1e6;
        }
      }
    }
  }
  let finalC1_nF = elementC_nF[0];
  let finalL1_uH = elementL_uH[0];
  if (clampedOrder === 1 && !isChebyshev) {
    finalL1_uH = tau * impedance * 1e6;
  }
  let attenuation_at_2fc;
  if (isChebyshev) {
    const epsilon = Math.sqrt(Math.pow(10, 0.5 / 10) - 1);
    const Tn = Math.cosh(clampedOrder * Math.acosh(2));
    attenuation_at_2fc = 10 * Math.log10(1 + epsilon * epsilon * Tn * Tn);
  } else {
    attenuation_at_2fc = 10 * Math.log10(1 + Math.pow(2, 2 * clampedOrder));
  }
  let bandwidth_Hz = 0;
  let fLow_Hz = 0;
  let fHigh_Hz = 0;
  if (filterType === 2) {
    bandwidth_Hz = fc / qFactor2;
    fLow_Hz = fc - bandwidth_Hz / 2;
    fHigh_Hz = fc + bandwidth_Hz / 2;
  }
  let maxComponentError = 0;
  let fcShiftPercent = 0;
  const eSeriesName = `E${Math.round(eSeries)}`;
  const validSeries = ["E12", "E24", "E48", "E96"];
  if (eSeries > 0 && validSeries.includes(eSeriesName)) {
    const snapValue = (val) => {
      if (val <= 0) return val;
      const result = snapToESeries(val, eSeriesName);
      maxComponentError = Math.max(maxComponentError, Math.abs(result.error));
      return result.snapped;
    };
    finalC1_nF = snapValue(finalC1_nF);
    finalL1_uH = snapValue(finalL1_uH);
    elementC_nF[1] = snapValue(elementC_nF[1]);
    elementL_uH[1] = snapValue(elementL_uH[1]);
    elementC_nF[2] = snapValue(elementC_nF[2]);
    elementL_uH[2] = snapValue(elementL_uH[2]);
    elementC_nF[3] = snapValue(elementC_nF[3]);
    elementL_uH[3] = snapValue(elementL_uH[3]);
    elementC_nF[4] = snapValue(elementC_nF[4]);
    elementL_uH[4] = snapValue(elementL_uH[4]);
    fcShiftPercent = maxComponentError * 0.5;
  }
  return {
    values: {
      C1_nF: finalC1_nF,
      L1_uH: finalL1_uH,
      C3_nF: elementC_nF[1],
      L4_uH: elementL_uH[1],
      C5_nF: elementC_nF[2],
      L6_uH: elementL_uH[2],
      C7_nF: elementC_nF[3],
      L8_uH: elementL_uH[3],
      C9_nF: elementC_nF[4],
      L10_uH: elementL_uH[4],
      tau_ns,
      attenuation_at_2fc,
      bandwidth_Hz,
      fLow_Hz,
      fHigh_Hz,
      maxComponentError,
      fcShiftPercent
    }
  };
}
var filterDesigner = {
  slug: "filter-designer",
  title: "Passive RC/LC Filter Designer",
  shortTitle: "Filter Designer",
  category: "signal",
  description: "Design passive Butterworth and Chebyshev Type I (0.5 dB ripple) low-pass, high-pass, and band-pass filters up to order 10. Calculates all LC ladder element values, time constant, and stopband attenuation.",
  keywords: ["filter designer", "rc filter calculator", "lc filter", "butterworth filter", "chebyshev filter", "low pass filter design", "high pass filter", "band pass filter", "passive filter components", "lc ladder", "filter order"],
  inputs: [
    {
      key: "responseType",
      label: "Response Type",
      symbol: "Type",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 1,
      tooltip: "0 = Butterworth (maximally flat), 1 = Chebyshev Type I (0.5 dB ripple, steeper rolloff)"
    },
    {
      key: "filterType",
      label: "Filter Type",
      symbol: "Type",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 2,
      step: 1,
      tooltip: "0 = Low-pass, 1 = High-pass, 2 = Band-pass"
    },
    {
      key: "fc",
      label: "Cutoff Frequency",
      symbol: "f_c",
      unit: "Hz",
      defaultValue: 1e3,
      min: 1,
      max: 1e7,
      tooltip: "Filter cutoff frequency (-3dB point)",
      presets: [
        { label: "100 Hz", values: { fc: 100 } },
        { label: "1 kHz", values: { fc: 1e3 } },
        { label: "10 kHz", values: { fc: 1e4 } },
        { label: "100 kHz", values: { fc: 1e5 } }
      ]
    },
    {
      key: "order",
      label: "Filter Order",
      symbol: "n",
      unit: "",
      defaultValue: 2,
      min: 1,
      max: 10,
      step: 1,
      tooltip: "Filter order (1\u201310). Higher orders give steeper rolloff: n \xD7 20 dB/decade."
    },
    {
      key: "impedance",
      label: "Characteristic Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      defaultValue: 50,
      min: 1,
      max: 1e4,
      tooltip: "Source/load impedance. 50 \u03A9 is standard for RF systems; 600 \u03A9 for audio."
    },
    {
      key: "qFactor",
      label: "Quality Factor",
      symbol: "Q",
      unit: "",
      defaultValue: 1,
      min: 0.1,
      max: 100,
      tooltip: "Higher Q = narrower bandwidth. Relevant for band-pass filter type (type=2)."
    },
    {
      key: "eSeries",
      label: "E-Series Snapping",
      symbol: "E",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 96,
      step: 1,
      tooltip: "0 = Ideal values, 12 = E12 (10%), 24 = E24 (5%), 48 = E48 (2%), 96 = E96 (1%). Snaps component values to nearest standard value.",
      presets: [
        { label: "Ideal", values: { eSeries: 0 } },
        { label: "E12 (10%)", values: { eSeries: 12 } },
        { label: "E24 (5%)", values: { eSeries: 24 } },
        { label: "E48 (2%)", values: { eSeries: 48 } },
        { label: "E96 (1%)", values: { eSeries: 96 } }
      ]
    }
  ],
  outputs: [
    {
      key: "C1_nF",
      label: "Element 1 (C\u2081)",
      symbol: "C\u2081",
      unit: "nF",
      precision: 3,
      tooltip: "First shunt capacitor value for the filter prototype"
    },
    {
      key: "L1_uH",
      label: "Element 2 (L\u2082)",
      symbol: "L\u2082",
      unit: "\u03BCH",
      precision: 3,
      tooltip: "Second element \u2014 series inductor for the filter prototype"
    },
    {
      key: "C3_nF",
      label: "Element 3 (C\u2083)",
      symbol: "C\u2083",
      unit: "nF",
      precision: 3,
      tooltip: "Third element \u2014 shunt capacitor (order \u2265 3)"
    },
    {
      key: "L4_uH",
      label: "Element 4 (L\u2084)",
      symbol: "L\u2084",
      unit: "\u03BCH",
      precision: 3,
      tooltip: "Fourth element \u2014 series inductor (order \u2265 4)"
    },
    {
      key: "C5_nF",
      label: "Element 5 (C\u2085)",
      symbol: "C\u2085",
      unit: "nF",
      precision: 3,
      tooltip: "Fifth element \u2014 shunt capacitor (order \u2265 5)"
    },
    {
      key: "L6_uH",
      label: "Element 6 (L\u2086)",
      symbol: "L\u2086",
      unit: "\u03BCH",
      precision: 3,
      tooltip: "Sixth element \u2014 series inductor (order \u2265 6)"
    },
    {
      key: "C7_nF",
      label: "Element 7 (C\u2087)",
      symbol: "C\u2087",
      unit: "nF",
      precision: 3,
      tooltip: "Seventh element \u2014 shunt capacitor (order \u2265 7)"
    },
    {
      key: "L8_uH",
      label: "Element 8 (L\u2088)",
      symbol: "L\u2088",
      unit: "\u03BCH",
      precision: 3,
      tooltip: "Eighth element \u2014 series inductor (order \u2265 8)"
    },
    {
      key: "C9_nF",
      label: "Element 9 (C\u2089)",
      symbol: "C\u2089",
      unit: "nF",
      precision: 3,
      tooltip: "Ninth element \u2014 shunt capacitor (order \u2265 9)"
    },
    {
      key: "L10_uH",
      label: "Element 10 (L\u2081\u2080)",
      symbol: "L\u2081\u2080",
      unit: "\u03BCH",
      precision: 3,
      tooltip: "Tenth element \u2014 series inductor (order = 10)"
    },
    {
      key: "tau_ns",
      label: "Time Constant \u03C4",
      symbol: "\u03C4",
      unit: "ns",
      precision: 2,
      tooltip: "RC time constant (1st-order Butterworth only)"
    },
    {
      key: "attenuation_at_2fc",
      label: "Attenuation at 2\xD7fc",
      symbol: "A(2f_c)",
      unit: "dB",
      precision: 1,
      tooltip: "Stopband attenuation at twice the cutoff frequency"
    },
    {
      key: "bandwidth_Hz",
      label: "Bandwidth",
      symbol: "BW",
      unit: "Hz",
      precision: 1,
      tooltip: "Band-pass filter 3dB bandwidth (band-pass mode only)"
    },
    {
      key: "fLow_Hz",
      label: "Lower -3dB Frequency",
      symbol: "f_L",
      unit: "Hz",
      precision: 1,
      tooltip: "Lower -3dB corner frequency (band-pass mode only)"
    },
    {
      key: "fHigh_Hz",
      label: "Upper -3dB Frequency",
      symbol: "f_H",
      unit: "Hz",
      precision: 1,
      tooltip: "Upper -3dB corner frequency (band-pass mode only)"
    },
    {
      key: "maxComponentError",
      label: "Max Component Error",
      symbol: "E_max",
      unit: "%",
      precision: 1,
      tooltip: "Largest deviation from ideal value after E-series snapping",
      thresholds: {
        good: { max: 2 },
        warning: { min: 2, max: 5 },
        danger: { min: 5 }
      }
    },
    {
      key: "fcShiftPercent",
      label: "Est. Cutoff Shift",
      symbol: "\u0394f_c",
      unit: "%",
      precision: 1,
      tooltip: "Estimated shift in -3dB frequency due to component rounding"
    }
  ],
  calculate: calculateFilterDesigner,
  formula: {
    primary: "C_k = \\frac{g_k}{\\omega_c \\cdot Z_0},\\quad L_k = \\frac{g_k \\cdot Z_0}{\\omega_c}",
    latex: "C_k = \\frac{g_k}{\\omega_c \\cdot Z_0},\\quad L_k = \\frac{g_k \\cdot Z_0}{\\omega_c}",
    variables: [
      { symbol: "g_k", description: "Normalized prototype element value (Butterworth or Chebyshev)", unit: "" },
      { symbol: "\u03C9_c", description: "Angular cutoff frequency (2\u03C0f_c)", unit: "rad/s" },
      { symbol: "Z\u2080", description: "Characteristic impedance", unit: "\u03A9" },
      { symbol: "\u03C4", description: "RC time constant", unit: "s" },
      { symbol: "f_c", description: "Cutoff frequency", unit: "Hz" },
      { symbol: "Q", description: "Quality factor", unit: "" },
      { symbol: "n", description: "Filter order (1\u201310)", unit: "" }
    ],
    derivation: [
      "Butterworth prototype g-values are normalized to \u03C9_c = 1 rad/s, Z_0 = 1 \u03A9",
      "Chebyshev Type I filters trade passband ripple for steeper rolloff than Butterworth.",
      "0.5 dB ripple is the most common choice, balancing passband flatness against selectivity.",
      "Denormalize: C_k = g_k / (\u03C9_c \xD7 Z_0), L_k = g_k \xD7 Z_0 / \u03C9_c",
      "For order 1: \u03C4 = 1/\u03C9_c, C = \u03C4/Z_0, L = \u03C4 \xD7 Z_0",
      "Band-pass BW = f_c / Q; f_L = f_c \u2212 BW/2; f_H = f_c + BW/2",
      "Butterworth stopband: A = 10 \xD7 log10(1 + (f/f_c)^(2n))",
      "Chebyshev stopband: A = 10 \xD7 log10(1 + \u03B5\xB2 \xD7 T_n(f/f_c)\xB2), where \u03B5 = \u221A(10^(ripple/10) \u2212 1)",
      "T_n(x) = cosh(n \xD7 acosh(x)) for x \u2265 1 (Chebyshev polynomial of the first kind)."
    ],
    reference: "Williams & Taylor, Electronic Filter Design Handbook 4th ed.; Zverev, Handbook of Filter Synthesis"
  },
  visualization: { type: "bode-plot", freqRange: [1, 1e7] },
  relatedCalculators: ["rc-time-constant", "sampling-nyquist", "lc-resonance"],
  exportComponents: (inputs, outputs) => {
    const filterType = Math.round(inputs.filterType ?? 0);
    const order = Math.round(Math.min(10, Math.max(1, inputs.order ?? 1)));
    const rows = [];
    const cKeys = ["C1_nF", "C3_nF", "C5_nF", "C7_nF", "C9_nF"];
    const lKeys = ["L1_uH", "L4_uH", "L6_uH", "L8_uH", "L10_uH"];
    for (let k = 0; k < order; k++) {
      const elemNum = k + 1;
      if (k % 2 === 0) {
        const cIdx = Math.floor(k / 2);
        const cKey = cKeys[cIdx];
        const cVal = outputs[cKey];
        if (filterType === 1) {
          if (cVal) {
            rows.push({ qty: 1, description: `L${elemNum}`, value: `${cVal.toPrecision(4)} \xB5H`, package: "0402", componentType: "L", placement: "shunt" });
          }
        } else {
          if (cVal) {
            const cPlace = filterType === 2 ? "series" : "shunt";
            rows.push({ qty: 1, description: `C${elemNum}`, value: `${cVal.toPrecision(4)} nF`, package: "0402", componentType: "C", placement: cPlace });
          }
        }
      } else {
        const lIdx = Math.floor(k / 2);
        const lKeyMap = ["L1_uH", "L4_uH", "L6_uH", "L8_uH", "L10_uH"];
        const lKey = lKeyMap[lIdx];
        const lVal = outputs[lKey];
        if (filterType === 1) {
          if (lVal) {
            rows.push({ qty: 1, description: `C${elemNum}`, value: `${lVal.toPrecision(4)} nF`, package: "0402", componentType: "C", placement: "series" });
          }
        } else {
          if (lVal) {
            rows.push({ qty: 1, description: `L${elemNum}`, value: `${lVal.toPrecision(4)} \xB5H`, package: "0402", componentType: "L", placement: "series" });
          }
        }
      }
    }
    return rows;
  },
  schematicSections: (inputs, outputs) => {
    const filterType = Math.round(inputs.filterType ?? 0);
    const order = Math.round(Math.min(10, Math.max(1, inputs.order ?? 1)));
    const responseType = Math.round(inputs.responseType ?? 0);
    const responseNames = ["Butterworth", "Chebyshev 0.5dB"];
    const cKeys = ["C1_nF", "C3_nF", "C5_nF", "C7_nF", "C9_nF"];
    const lKeys = ["L1_uH", "L4_uH", "L6_uH", "L8_uH", "L10_uH"];
    const elements = [];
    if (filterType === 2) {
      const lVal = outputs.L1_uH;
      const cVal = outputs.C1_nF;
      elements.push({ type: "L", placement: "series", label: `L ${lVal?.toPrecision(4) ?? "?"}\xB5H` });
      elements.push({ type: "C", placement: "series", label: `C ${cVal?.toPrecision(4) ?? "?"}nF` });
    } else {
      for (let k = 0; k < order; k++) {
        const cIdx = Math.floor(k / 2);
        const lIdx = Math.floor(k / 2);
        if (k % 2 === 0) {
          if (filterType === 0) {
            const val = outputs[cKeys[cIdx]];
            elements.push({ type: "C", placement: "shunt", label: `C ${val?.toPrecision(4) ?? "?"}nF` });
          } else {
            const val = outputs[cKeys[cIdx]];
            elements.push({ type: "C", placement: "series", label: `C ${val?.toPrecision(4) ?? "?"}nF` });
          }
        } else {
          if (filterType === 0) {
            const lKeyMap = ["L1_uH", "L4_uH", "L6_uH", "L8_uH", "L10_uH"];
            const val = outputs[lKeyMap[lIdx]];
            elements.push({ type: "L", placement: "series", label: `L ${val?.toPrecision(4) ?? "?"}\xB5H` });
          } else {
            const lKeyMap = ["L1_uH", "L4_uH", "L6_uH", "L8_uH", "L10_uH"];
            const val = outputs[lKeyMap[lIdx]];
            elements.push({ type: "L", placement: "shunt", label: `L ${val?.toPrecision(4) ?? "?"}\xB5H` });
          }
        }
      }
      if (order === 1) {
        if (filterType === 0) {
          elements.push({ type: "C", placement: "shunt", label: `C ${outputs.C1_nF?.toPrecision(4) ?? "?"}nF` });
        } else {
          elements.push({ type: "L", placement: "shunt", label: `L ${outputs.L1_uH?.toPrecision(4) ?? "?"}\xB5H` });
        }
      }
    }
    const typeNames = ["Low-Pass", "High-Pass", "Band-Pass"];
    return [{ label: `${responseNames[responseType] ?? "Filter"} ${typeNames[filterType] ?? "Filter"} \u2014 Order ${order}`, elements }];
  },
  liveWidgets: [
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ],
  verificationData: [
    {
      inputs: { responseType: 0, filterType: 0, fc: 1e3, order: 1, impedance: 50, qFactor: 1, eSeries: 0 },
      expectedOutputs: { C1_nF: 3183.1, tau_ns: 159155 },
      tolerance: 0.02,
      source: "Direct calculation: \u03C4 = 1/(2\u03C0\xD71000) = 159.155\u03BCs; C = \u03C4/50 = 3183.1 nF"
    }
  ]
};

// src/lib/calculators/signal/sampling-nyquist.ts
function calculateSamplingNyquist(inputs) {
  const { signalFreq, samplingRate, adcBits, channels } = inputs;
  if (signalFreq <= 0) {
    return { values: {}, errors: ["Signal bandwidth must be greater than zero"] };
  }
  if (samplingRate <= 0) {
    return { values: {}, errors: ["Sampling rate must be greater than zero"] };
  }
  if (adcBits < 1) {
    return { values: {}, errors: ["ADC resolution must be at least 1 bit"] };
  }
  const nyquistRate_Hz = 2 * signalFreq;
  const oversamplingRatio = samplingRate / nyquistRate_Hz;
  const aliasFreq_Hz = oversamplingRatio < 1 ? Math.abs(samplingRate - signalFreq) : 0;
  const dynamicRangeDB = 6.02 * adcBits + 1.76;
  const snr_dB = dynamicRangeDB;
  const dataRateMbps = samplingRate * adcBits * channels / 1e6;
  const antiAliasingFC_Hz = samplingRate / 2;
  const warnings = [];
  if (oversamplingRatio < 1) {
    warnings.push("Sampling below Nyquist rate \u2014 aliasing will occur");
  }
  return {
    values: {
      nyquistRate_Hz,
      oversamplingRatio,
      aliasFreq_Hz,
      dynamicRangeDB,
      snr_dB,
      dataRateMbps,
      antiAliasingFC_Hz
    },
    warnings
  };
}
var samplingNyquist = {
  slug: "sampling-nyquist",
  title: "Nyquist Sampling Theorem Calculator",
  shortTitle: "Nyquist Sampling",
  category: "signal",
  description: "Calculate Nyquist sampling rate, oversampling ratio, aliasing frequency, ADC dynamic range, SNR, and data rate. Verify that your sampling rate satisfies the Nyquist criterion and avoid aliasing in your system.",
  keywords: ["nyquist theorem calculator", "sampling rate calculator", "aliasing calculator", "adc dynamic range", "oversampling ratio", "nyquist frequency", "snr calculator", "data rate calculator"],
  inputs: [
    {
      key: "signalFreq",
      label: "Signal Bandwidth / Max Frequency",
      symbol: "f_sig",
      unit: "Hz",
      defaultValue: 1e4,
      min: 1,
      max: 1e9,
      tooltip: "Maximum frequency component in the signal (or signal bandwidth for baseband signals)",
      presets: [
        { label: "Audio (20 kHz)", values: { signalFreq: 2e4 } },
        { label: "Voice (4 kHz)", values: { signalFreq: 4e3 } },
        { label: "AM radio (10 kHz)", values: { signalFreq: 1e4 } },
        { label: "FM stereo (53 kHz)", values: { signalFreq: 53e3 } }
      ]
    },
    {
      key: "samplingRate",
      label: "Sampling Rate",
      symbol: "f_s",
      unit: "Sa/s",
      defaultValue: 44100,
      min: 1,
      max: 1e12,
      tooltip: "Number of samples taken per second",
      presets: [
        { label: "Audio CD (44100)", values: { samplingRate: 44100 } },
        { label: "Audio 48 kHz", values: { samplingRate: 48e3 } },
        { label: "Audio 96 kHz", values: { samplingRate: 96e3 } },
        { label: "I/Q baseband 2\xD7BW", values: { samplingRate: 2e4 } }
      ]
    },
    {
      key: "adcBits",
      label: "ADC Resolution",
      symbol: "N",
      unit: "bits",
      defaultValue: 16,
      min: 4,
      max: 24,
      step: 1,
      tooltip: "Number of bits in the ADC. Each additional bit adds ~6 dB of dynamic range.",
      presets: [
        { label: "8-bit", values: { adcBits: 8 } },
        { label: "12-bit", values: { adcBits: 12 } },
        { label: "16-bit", values: { adcBits: 16 } },
        { label: "24-bit", values: { adcBits: 24 } }
      ]
    },
    {
      key: "channels",
      label: "Number of Channels",
      symbol: "Ch",
      unit: "",
      defaultValue: 1,
      min: 1,
      max: 32,
      step: 1,
      tooltip: "Number of parallel ADC channels (e.g., 2 for stereo, 1 for mono)"
    }
  ],
  outputs: [
    {
      key: "nyquistRate_Hz",
      label: "Nyquist Rate",
      symbol: "f_N",
      unit: "Hz",
      precision: 1,
      tooltip: "Minimum sampling rate required to avoid aliasing (= 2 \xD7 signal bandwidth)",
      format: "engineering"
    },
    {
      key: "oversamplingRatio",
      label: "Oversampling Ratio",
      symbol: "OSR",
      unit: "",
      precision: 3,
      tooltip: "Ratio of actual sampling rate to Nyquist rate. Values < 1 indicate aliasing.",
      thresholds: {
        good: { min: 2 },
        warning: { min: 1, max: 2 },
        danger: { max: 1 }
      }
    },
    {
      key: "aliasFreq_Hz",
      label: "Alias Frequency",
      symbol: "f_alias",
      unit: "Hz",
      precision: 1,
      tooltip: "Frequency at which aliased signal appears. Zero if no aliasing.",
      format: "engineering"
    },
    {
      key: "dynamicRangeDB",
      label: "Dynamic Range",
      symbol: "DR",
      unit: "dB",
      precision: 2,
      tooltip: "Theoretical dynamic range of the ADC: DR = 6.02\xD7N + 1.76 dB"
    },
    {
      key: "snr_dB",
      label: "Ideal SNR",
      symbol: "SNR",
      unit: "dB",
      precision: 2,
      tooltip: "Signal-to-quantization-noise ratio for an ideal ADC at full scale"
    },
    {
      key: "dataRateMbps",
      label: "Raw Data Rate",
      symbol: "DR",
      unit: "Mbps",
      precision: 3,
      tooltip: "Uncompressed raw data rate = sampling rate \xD7 ADC bits \xD7 channels"
    },
    {
      key: "antiAliasingFC_Hz",
      label: "Anti-Aliasing Filter fc",
      symbol: "f_aa",
      unit: "Hz",
      precision: 1,
      tooltip: "Maximum anti-aliasing filter cutoff frequency (= fs / 2, the Nyquist frequency)",
      format: "engineering"
    }
  ],
  calculate: calculateSamplingNyquist,
  formula: {
    primary: "f_N = 2 f_{sig},\\quad OSR = \\frac{f_s}{f_N},\\quad SNR = 6.02N + 1.76\\text{ dB}",
    variables: [
      { symbol: "f_N", description: "Nyquist rate (minimum sampling rate)", unit: "Hz" },
      { symbol: "f_sig", description: "Signal maximum frequency / bandwidth", unit: "Hz" },
      { symbol: "f_s", description: "Actual sampling rate", unit: "Sa/s" },
      { symbol: "OSR", description: "Oversampling ratio", unit: "" },
      { symbol: "N", description: "ADC resolution", unit: "bits" },
      { symbol: "SNR", description: "Signal-to-quantization-noise ratio", unit: "dB" }
    ],
    derivation: [
      "Nyquist theorem: f_s \u2265 2 \xD7 f_max to avoid aliasing",
      "Oversampling ratio OSR = f_s / (2 \xD7 f_sig)",
      "When OSR < 1, alias frequency = |f_s \u2212 f_sig|",
      "Ideal ADC SNR (SQNR) = 6.02 \xD7 N + 1.76 dB",
      "Raw data rate = f_s \xD7 N \xD7 channels (bits/sec)",
      "Anti-aliasing filter must have cutoff \u2264 f_s / 2"
    ],
    reference: 'Nyquist, H. (1928). "Certain Topics in Telegraph Transmission Theory". AIEE Transactions. Shannon-Nyquist sampling theorem.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["filter-designer", "rc-time-constant", "rf-link-budget"],
  verificationData: [
    {
      inputs: { signalFreq: 1e4, samplingRate: 44100, adcBits: 16, channels: 1 },
      expectedOutputs: { nyquistRate_Hz: 2e4, oversamplingRatio: 2.205, dynamicRangeDB: 98.08 },
      tolerance: 0.01,
      source: "Direct calculation: f_N=20000Hz, OSR=44100/20000=2.205, DR=6.02\xD716+1.76=98.08 dB"
    }
  ]
};

// src/lib/calculators/antenna/dipole-antenna.ts
function calculateDipoleAntenna(inputs) {
  const { frequency, velocityFactor } = inputs;
  if (frequency <= 0) {
    return { values: {}, errors: ["Frequency must be greater than 0"] };
  }
  if (velocityFactor <= 0 || velocityFactor > 1) {
    return { values: {}, errors: ["Velocity factor must be between 0 and 1"] };
  }
  const c_m_s = 299792458;
  const lambda_m = c_m_s / (frequency * 1e6);
  const halfWaveLength_mm = 1e3 * velocityFactor * lambda_m / 2;
  const quarterWaveLength_mm = halfWaveLength_mm / 2;
  const gainDbi = 2.15;
  const gainDbd = 0;
  const inputImpedance_ohm = 73.1;
  const radiationResistance_ohm = 73.1;
  const z0 = 50;
  const z2 = inputImpedance_ohm;
  const gamma = Math.abs((z2 - z0) / (z2 + z0));
  const feedpointVswr_50 = (1 + gamma) / (1 - gamma);
  return {
    values: {
      halfWaveLength_mm: Math.round(halfWaveLength_mm * 10) / 10,
      quarterWaveLength_mm: Math.round(quarterWaveLength_mm * 10) / 10,
      gainDbi: Math.round(gainDbi * 100) / 100,
      inputImpedance_ohm: Math.round(inputImpedance_ohm * 10) / 10,
      feedpointVswr_50: Math.round(feedpointVswr_50 * 100) / 100,
      lambda_m: Math.round(lambda_m * 1e4) / 1e4
    },
    intermediateValues: {
      radiationResistance_ohm,
      gainDbd
    }
  };
}
var dipoleAntenna = {
  slug: "dipole-antenna",
  title: "Half-Wave Dipole Antenna Calculator",
  shortTitle: "Dipole Antenna",
  category: "antenna",
  description: "Calculate the physical length, wavelength, gain, radiation resistance, and 50\u03A9 VSWR for a half-wave dipole antenna at any frequency. Supports velocity factor for insulated wire.",
  keywords: [
    "dipole antenna calculator",
    "half wave dipole",
    "antenna length calculator",
    "dipole length frequency",
    "antenna design",
    "radiation resistance",
    "dipole gain dbi"
  ],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 433,
      min: 1,
      max: 6e3,
      step: 0.1,
      tooltip: "Operating frequency in MHz",
      presets: [
        { label: "433 MHz (ISM)", values: { frequency: 433 } },
        { label: "868 MHz (EU ISM)", values: { frequency: 868 } },
        { label: "915 MHz (US ISM)", values: { frequency: 915 } },
        { label: "2400 MHz (WiFi/BT)", values: { frequency: 2400 } }
      ]
    },
    {
      key: "velocityFactor",
      label: "Velocity Factor",
      symbol: "VF",
      unit: "",
      defaultValue: 0.97,
      min: 0.5,
      max: 1,
      step: 0.01,
      tooltip: "Free space \u2248 0.97; with insulation ~0.95"
    }
  ],
  outputs: [
    {
      key: "halfWaveLength_mm",
      label: "Half-Wave Length",
      symbol: "L_{\u03BB/2}",
      unit: "mm",
      precision: 1,
      tooltip: "Total dipole length for half-wave resonance"
    },
    {
      key: "quarterWaveLength_mm",
      label: "Quarter-Wave Length",
      symbol: "L_{\u03BB/4}",
      unit: "mm",
      precision: 1,
      tooltip: "Each dipole arm length (quarter wavelength)"
    },
    {
      key: "gainDbi",
      label: "Antenna Gain",
      symbol: "G",
      unit: "dBi",
      precision: 2,
      tooltip: "Theoretical gain of half-wave dipole (2.15 dBi)"
    },
    {
      key: "inputImpedance_ohm",
      label: "Input Impedance",
      symbol: "Z_{in}",
      unit: "\u03A9",
      precision: 1,
      tooltip: "Centre-fed radiation resistance \u2248 73.1 \u03A9"
    },
    {
      key: "feedpointVswr_50",
      label: "VSWR (vs 50\u03A9)",
      symbol: "VSWR_{50}",
      unit: ":1",
      precision: 2,
      tooltip: "VSWR when fed directly with 50\u03A9 coax (no matching)",
      thresholds: {
        good: { max: 1.5 },
        warning: { max: 2 },
        danger: { min: 2 }
      }
    },
    {
      key: "lambda_m",
      label: "Free-Space Wavelength",
      symbol: "\u03BB",
      unit: "m",
      precision: 4
    }
  ],
  calculate: calculateDipoleAntenna,
  formula: {
    primary: "L_{\\lambda/2} = \\frac{v_f \\cdot c}{2f}, \\quad Z_{in} \\approx 73.1\\,\\Omega, \\quad G = 2.15\\,\\text{dBi}",
    variables: [
      { symbol: "L_{\u03BB/2}", description: "Half-wave dipole total length", unit: "m" },
      { symbol: "v_f", description: "Velocity factor of the wire", unit: "" },
      { symbol: "c", description: "Speed of light (299 792 458 m/s)", unit: "m/s" },
      { symbol: "f", description: "Operating frequency", unit: "Hz" },
      { symbol: "Z_{in}", description: "Input impedance (radiation resistance)", unit: "\u03A9" },
      { symbol: "G", description: "Antenna gain", unit: "dBi" }
    ],
    derivation: [
      "\u03BB = c / f",
      "L_{\u03BB/2} = v_f \xD7 \u03BB / 2",
      "L_{\u03BB/4} = L_{\u03BB/2} / 2",
      "|\u0393| = |Z_{in} \u2212 50| / (Z_{in} + 50)",
      "VSWR = (1 + |\u0393|) / (1 \u2212 |\u0393|)"
    ],
    reference: 'Balanis, "Antenna Theory: Analysis and Design", 4th ed., Chapter 4'
  },
  visualization: { type: "none" },
  relatedCalculators: [
    "patch-antenna",
    "eirp-calculator",
    "rf-link-budget",
    "vswr-return-loss"
  ],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ],
  verificationData: [
    {
      inputs: { frequency: 433, velocityFactor: 0.97 },
      expectedOutputs: { halfWaveLength_mm: 335.7, lambda_m: 0.6924 },
      tolerance: 0.02,
      source: "\u03BB = 299792458/433e6 = 0.6924 m; L = 0.97\xD70.6924/2\xD71000 = 335.7 mm"
    },
    {
      inputs: { frequency: 2400, velocityFactor: 0.97 },
      expectedOutputs: { halfWaveLength_mm: 60.6 },
      tolerance: 0.02,
      source: "\u03BB = 299792458/2400e6 = 0.1249 m; L = 0.97\xD70.1249/2\xD71000 = 60.6 mm"
    }
  ]
};

// src/lib/calculators/antenna/patch-antenna.ts
function calculatePatchAntenna(inputs) {
  const { frequency, dielectricConstant, substrateHeight, feedOffset } = inputs;
  if (frequency <= 0) {
    return { values: {}, errors: ["Frequency must be greater than 0"] };
  }
  if (dielectricConstant < 1) {
    return { values: {}, errors: ["Dielectric constant must be \u2265 1"] };
  }
  if (substrateHeight <= 0) {
    return { values: {}, errors: ["Substrate height must be greater than 0"] };
  }
  const c = 299792458;
  const f_Hz = frequency * 1e9;
  const er = dielectricConstant;
  const h = substrateHeight * 1e-3;
  const lambda = c / f_Hz;
  const patchWidth_m = lambda / 2 * Math.sqrt(2 / (er + 1));
  const uRatio = patchWidth_m / h;
  const erEff = (er + 1) / 2 + (er - 1) / 2 * Math.pow(1 + 12 / uRatio, -0.5);
  const deltaL = 0.412 * h * ((erEff + 0.3) * (uRatio + 0.264)) / ((erEff - 0.258) * (uRatio + 0.8));
  const patchLength_m = lambda / (2 * Math.sqrt(erEff)) - 2 * deltaL;
  const patchWidth_mm = patchWidth_m * 1e3;
  const patchLength_mm = patchLength_m * 1e3;
  if (patchLength_mm <= 0) {
    return {
      values: {},
      errors: ["Computed patch length is non-positive \u2014 check substrate height and dielectric constant"]
    };
  }
  const Rin_raw = 90 * (er * er) / (er - 1) * Math.pow(patchLength_m / patchWidth_m, 2);
  const edgeFeedImpedance_ohm = Math.min(Math.max(Rin_raw, 50), 500);
  const insetFeedPosition_mm = feedOffset > 0 ? feedOffset : patchLength_mm / Math.PI * Math.acos(Math.sqrt(50 / edgeFeedImpedance_ohm));
  const gainDbi = 7;
  return {
    values: {
      patchWidth_mm: Math.round(patchWidth_mm * 100) / 100,
      patchLength_mm: Math.round(patchLength_mm * 100) / 100,
      effectiveDielectric: Math.round(erEff * 1e4) / 1e4,
      edgeFeedImpedance_ohm: Math.round(edgeFeedImpedance_ohm * 10) / 10,
      gainDbi: Math.round(gainDbi * 10) / 10
    },
    intermediateValues: {
      lambda_mm: Math.round(lambda * 1e5) / 100,
      deltaL_mm: Math.round(deltaL * 1e6) / 1e3,
      insetFeedPosition_mm: Math.round(insetFeedPosition_mm * 100) / 100
    }
  };
}
var patchAntenna = {
  slug: "patch-antenna",
  title: "Microstrip Patch Antenna Calculator",
  shortTitle: "Patch Antenna",
  category: "antenna",
  description: "Calculate rectangular microstrip patch antenna dimensions (width, length) using the Transmission Line Model. Outputs effective dielectric constant, edge-feed impedance, and nominal gain for common substrates like FR4 and Rogers.",
  keywords: [
    "patch antenna calculator",
    "microstrip patch antenna",
    "patch antenna dimensions",
    "rectangular patch antenna",
    "antenna substrate",
    "effective dielectric constant",
    "fr4 antenna design"
  ],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "GHz",
      defaultValue: 2.45,
      min: 0.1,
      max: 100,
      step: 0.01,
      tooltip: "Operating frequency in GHz",
      presets: [
        { label: "2.4 GHz WiFi", values: { frequency: 2.45 } },
        { label: "5.8 GHz WiFi", values: { frequency: 5.8 } },
        { label: "28 GHz 5G mmWave", values: { frequency: 28 } }
      ]
    },
    {
      key: "dielectricConstant",
      label: "Dielectric Constant",
      symbol: "\u03B5r",
      unit: "",
      defaultValue: 4.4,
      min: 1,
      max: 30,
      step: 0.01,
      tooltip: "FR4 \u2248 4.4; Rogers RO4003C \u2248 3.55; Air = 1",
      presets: [
        { label: "FR4 (\u03B5r=4.4)", values: { dielectricConstant: 4.4 } },
        { label: "Rogers RO4003C (\u03B5r=3.55)", values: { dielectricConstant: 3.55 } },
        { label: "Air (\u03B5r=1)", values: { dielectricConstant: 1 } }
      ]
    },
    {
      key: "substrateHeight",
      label: "Substrate Height",
      symbol: "h",
      unit: "mm",
      defaultValue: 1.6,
      min: 0.1,
      max: 10,
      step: 0.01,
      tooltip: "Dielectric substrate thickness"
    },
    {
      key: "feedOffset",
      label: "Feed Offset",
      symbol: "x\u2080",
      unit: "mm",
      defaultValue: 0,
      min: 0,
      max: 50,
      step: 0.1,
      tooltip: "0 = edge feed; adjust for 50\u03A9 match (inset feed position)"
    }
  ],
  outputs: [
    {
      key: "patchWidth_mm",
      label: "Patch Width",
      symbol: "W",
      unit: "mm",
      precision: 2,
      tooltip: "Resonant patch width (determines polarisation direction)"
    },
    {
      key: "patchLength_mm",
      label: "Patch Length",
      symbol: "L",
      unit: "mm",
      precision: 2,
      tooltip: "Resonant patch length (determines resonant frequency)"
    },
    {
      key: "effectiveDielectric",
      label: "Effective Dielectric",
      symbol: "\u03B5r_eff",
      unit: "",
      precision: 4,
      tooltip: "Effective dielectric constant accounting for fringing fields"
    },
    {
      key: "edgeFeedImpedance_ohm",
      label: "Edge Feed Impedance",
      symbol: "R_{in}",
      unit: "\u03A9",
      precision: 1,
      tooltip: "Input impedance at the radiating edge (typically 100\u2013300\u03A9)",
      thresholds: {
        good: { min: 50, max: 300 },
        warning: { min: 30, max: 500 }
      }
    },
    {
      key: "gainDbi",
      label: "Nominal Gain",
      symbol: "G",
      unit: "dBi",
      precision: 1,
      tooltip: "Typical single-element patch gain (6\u20138 dBi)"
    }
  ],
  calculate: calculatePatchAntenna,
  formula: {
    primary: "W = \\frac{c}{2f}\\sqrt{\\frac{2}{\\varepsilon_r+1}}, \\quad L = \\frac{c}{2f\\sqrt{\\varepsilon_{r,\\text{eff}}}} - 2\\Delta L",
    variables: [
      { symbol: "W", description: "Patch width", unit: "m" },
      { symbol: "L", description: "Patch length", unit: "m" },
      { symbol: "\u03B5r", description: "Substrate relative permittivity", unit: "" },
      { symbol: "\u03B5r_eff", description: "Effective relative permittivity", unit: "" },
      { symbol: "\u0394L", description: "End-effect fringing extension", unit: "m" },
      { symbol: "c", description: "Speed of light (299 792 458 m/s)", unit: "m/s" },
      { symbol: "f", description: "Operating frequency", unit: "Hz" }
    ],
    derivation: [
      "\u03BB = c / f",
      "W = \u03BB/2 \xD7 sqrt(2/(\u03B5r+1))",
      "\u03B5r_eff = (\u03B5r+1)/2 + (\u03B5r\u22121)/2 \xD7 (1 + 12h/W)^(\u22120.5)",
      "\u0394L = 0.412h \xD7 (\u03B5r_eff+0.3)(W/h+0.264) / [(\u03B5r_eff\u22120.258)(W/h+0.8)]",
      "L = \u03BB/(2\u221A\u03B5r_eff) \u2212 2\u0394L"
    ],
    reference: 'Balanis, "Antenna Theory: Analysis and Design", 4th ed., Chapter 14'
  },
  visualization: { type: "none" },
  relatedCalculators: [
    "dipole-antenna",
    "eirp-calculator",
    "microstrip-impedance"
  ],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ],
  verificationData: [
    {
      inputs: { frequency: 2.45, dielectricConstant: 4.4, substrateHeight: 1.6, feedOffset: 0 },
      expectedOutputs: { patchLength_mm: 28.8, edgeFeedImpedance_ohm: 306.8 },
      tolerance: 0.05,
      source: "\u03BB=122.4mm; W=37.2mm; L=28.8mm; Rin=90\xB7\u03B5r\xB2/(\u03B5r-1)\xB7(L/W)\xB2=306.8\u03A9 (Balanis Ch.14, Derneryd 1978)"
    }
  ]
};

// src/lib/calculators/antenna/eirp-calculator.ts
function calculateEirp(inputs) {
  const {
    txPower_dbm,
    cableLoss_db,
    antennaGain_dbi,
    regulatoryLimit_dbm
  } = inputs;
  const eirp_dbm = txPower_dbm - cableLoss_db + antennaGain_dbi;
  const erp_dbm = eirp_dbm - 2.15;
  const eirp_w = Math.pow(10, (eirp_dbm - 30) / 10);
  const margin_db = regulatoryLimit_dbm - eirp_dbm;
  const maxPermittedGain_dbi = regulatoryLimit_dbm - txPower_dbm + cableLoss_db;
  const warnings = [];
  if (margin_db < 0) {
    warnings.push("EIRP exceeds regulatory limit");
  }
  return {
    values: {
      eirp_dbm: Math.round(eirp_dbm * 100) / 100,
      erp_dbm: Math.round(erp_dbm * 100) / 100,
      eirp_w: Math.round(eirp_w * 1e3) / 1e3,
      margin_db: Math.round(margin_db * 100) / 100,
      maxPermittedGain_dbi: Math.round(maxPermittedGain_dbi * 100) / 100
    },
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
var eirpCalculator = {
  slug: "eirp-calculator",
  title: "EIRP / ERP Regulatory Calculator",
  shortTitle: "EIRP / ERP",
  category: "antenna",
  description: "Calculate Effective Isotropic Radiated Power (EIRP) and ERP from transmit power, cable loss, and antenna gain. Check compliance against FCC, ETSI, and ISM-band regulatory limits.",
  keywords: [
    "eirp calculator",
    "effective isotropic radiated power",
    "erp calculator",
    "fcc part 15 eirp",
    "etsi eirp limit",
    "regulatory compliance rf",
    "antenna gain eirp",
    "transmit power calculator"
  ],
  inputs: [
    {
      key: "txPower_dbm",
      label: "TX Power",
      symbol: "P_{TX}",
      unit: "dBm",
      defaultValue: 20,
      min: -30,
      max: 60,
      step: 0.1,
      tooltip: "Transmitter output power at the RF connector"
    },
    {
      key: "cableLoss_db",
      label: "Cable / Connector Loss",
      symbol: "L_{cable}",
      unit: "dB",
      defaultValue: 1,
      min: 0,
      max: 30,
      step: 0.1,
      tooltip: "Total feedline and connector losses (positive value)"
    },
    {
      key: "antennaGain_dbi",
      label: "Antenna Gain",
      symbol: "G_{ant}",
      unit: "dBi",
      defaultValue: 2.15,
      min: -20,
      max: 40,
      step: 0.1,
      tooltip: "Antenna gain in dBi; 2.15 dBi = half-wave dipole"
    },
    {
      key: "regulatoryLimit_dbm",
      label: "Regulatory EIRP Limit",
      symbol: "EIRP_{max}",
      unit: "dBm",
      defaultValue: 36,
      min: -20,
      max: 60,
      step: 0.1,
      tooltip: "Maximum permitted EIRP per applicable regulation",
      presets: [
        { label: "FCC Part 15 (36 dBm)", values: { regulatoryLimit_dbm: 36 } },
        { label: "ETSI 2.4 GHz (20 dBm)", values: { regulatoryLimit_dbm: 20 } },
        { label: "ISM 433 MHz (14 dBm)", values: { regulatoryLimit_dbm: 14 } }
      ]
    }
  ],
  outputs: [
    {
      key: "eirp_dbm",
      label: "EIRP",
      symbol: "EIRP",
      unit: "dBm",
      precision: 2,
      tooltip: "Effective Isotropic Radiated Power = P_TX \u2212 L_cable + G_ant"
    },
    {
      key: "erp_dbm",
      label: "ERP",
      symbol: "ERP",
      unit: "dBm",
      precision: 2,
      tooltip: "Effective Radiated Power (relative to half-wave dipole): EIRP \u2212 2.15 dB"
    },
    {
      key: "eirp_w",
      label: "EIRP",
      symbol: "EIRP",
      unit: "W",
      precision: 3,
      tooltip: "EIRP in watts"
    },
    {
      key: "margin_db",
      label: "Regulatory Margin",
      symbol: "M",
      unit: "dB",
      precision: 2,
      tooltip: "Headroom below the regulatory limit; negative = non-compliant",
      thresholds: {
        good: { min: 3 },
        warning: { min: 0 },
        danger: { max: 0 }
      }
    },
    {
      key: "maxPermittedGain_dbi",
      label: "Max Permitted Antenna Gain",
      symbol: "G_{max}",
      unit: "dBi",
      precision: 2,
      tooltip: "Highest antenna gain that keeps EIRP within the regulatory limit"
    }
  ],
  calculate: calculateEirp,
  formula: {
    primary: "EIRP_{dBm} = P_{TX} - L_{cable} + G_{ant}, \\quad ERP_{dBm} = EIRP_{dBm} - 2.15",
    variables: [
      { symbol: "P_{TX}", description: "Transmitter output power", unit: "dBm" },
      { symbol: "L_{cable}", description: "Cable and connector loss", unit: "dB" },
      { symbol: "G_{ant}", description: "Antenna gain", unit: "dBi" },
      { symbol: "EIRP", description: "Effective Isotropic Radiated Power", unit: "dBm" },
      { symbol: "ERP", description: "Effective Radiated Power (vs dipole)", unit: "dBm" },
      { symbol: "M", description: "Regulatory margin", unit: "dB" }
    ],
    derivation: [
      "EIRP [dBm] = P_TX \u2212 L_cable + G_ant",
      "ERP [dBm] = EIRP [dBm] \u2212 2.15",
      "EIRP [W] = 10^((EIRP_dBm \u2212 30) / 10)",
      "Margin [dB] = EIRP_limit \u2212 EIRP",
      "G_max [dBi] = EIRP_limit \u2212 P_TX + L_cable"
    ],
    reference: "FCC Part 15 \xA715.247; ETSI EN 300 328; IEEE Std 149-1979"
  },
  visualization: { type: "none" },
  relatedCalculators: [
    "rf-link-budget",
    "dipole-antenna",
    "patch-antenna",
    "db-converter"
  ],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ],
  verificationData: [
    {
      inputs: {
        txPower_dbm: 20,
        cableLoss_db: 1,
        antennaGain_dbi: 2.15,
        regulatoryLimit_dbm: 36
      },
      expectedOutputs: { eirp_dbm: 21.15, margin_db: 14.85 },
      tolerance: 0.01,
      source: "EIRP = 20 \u2212 1 + 2.15 = 21.15 dBm; margin = 36 \u2212 21.15 = 14.85 dB"
    }
  ]
};

// src/lib/calculators/general/ohms-law.ts
function calculateOhmsLaw(inputs) {
  let { voltage: V, current: I, resistance: R, power: P } = inputs;
  const known = [V, I, R, P].filter((v) => v >= 0).length;
  if (known < 2) return { values: {}, errors: ["Provide at least 2 values"] };
  if (V >= 0 && I >= 0) {
    R = V / I;
    P = V * I;
  } else if (V >= 0 && R >= 0) {
    I = V / R;
    P = V * V / R;
  } else if (V >= 0 && P >= 0) {
    I = P / V;
    R = V * V / P;
  } else if (I >= 0 && R >= 0) {
    V = I * R;
    P = I * I * R;
  } else if (I >= 0 && P >= 0) {
    V = P / I;
    R = P / (I * I);
  } else if (R >= 0 && P >= 0) {
    V = Math.sqrt(P * R);
    I = Math.sqrt(P / R);
  }
  if (!isFinite(V) || !isFinite(I) || !isFinite(R) || !isFinite(P)) {
    return { values: {}, errors: ["Division by zero \u2014 ensure non-zero denominators"] };
  }
  return {
    values: {
      voltage: Math.round(V * 1e4) / 1e4,
      current: Math.round(I * 1e4) / 1e4,
      resistance: Math.round(R * 1e4) / 1e4,
      power: Math.round(P * 1e4) / 1e4
    }
  };
}
var ohmsLaw = {
  slug: "ohms-law",
  title: "Ohm's Law Calculator",
  shortTitle: "Ohm's Law",
  category: "general",
  description: "Calculate voltage, current, resistance, and power using Ohm's Law. Enter any two values to solve for the remaining two quantities.",
  keywords: ["ohm's law calculator", "voltage current resistance", "ohms law formula", "V=IR calculator", "power dissipation calculator"],
  inputs: [
    { key: "voltage", label: "Voltage", symbol: "V", unit: "V", defaultValue: 5, min: 0, max: 1e6, tooltip: "Set to -1 to solve for this value" },
    { key: "current", label: "Current", symbol: "I", unit: "A", defaultValue: -1, min: -1, max: 1e6, tooltip: "Set to -1 to solve for this value" },
    { key: "resistance", label: "Resistance", symbol: "R", unit: "\u03A9", defaultValue: 1e3, min: -1, max: 1e12, tooltip: "Set to -1 to solve for this value" },
    { key: "power", label: "Power", symbol: "P", unit: "W", defaultValue: -1, min: -1, max: 1e12, tooltip: "Set to -1 to solve for this value" }
  ],
  outputs: [
    { key: "voltage", label: "Voltage", symbol: "V", unit: "V", precision: 4 },
    { key: "current", label: "Current", symbol: "I", unit: "A", precision: 4, format: "engineering" },
    { key: "resistance", label: "Resistance", symbol: "R", unit: "\u03A9", precision: 4, format: "engineering" },
    { key: "power", label: "Power", symbol: "P", unit: "W", precision: 4, format: "engineering" }
  ],
  calculate: calculateOhmsLaw,
  formula: {
    primary: "V = IR, \\quad P = VI = I^2 R = \\frac{V^2}{R}",
    latex: "V = IR, \\quad P = IV = I^2R = \\frac{V^2}{R}",
    variables: [
      { symbol: "V", description: "Voltage", unit: "V" },
      { symbol: "I", description: "Current", unit: "A" },
      { symbol: "R", description: "Resistance", unit: "\u03A9" },
      { symbol: "P", description: "Power", unit: "W" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["voltage-divider", "rc-time-constant", "led-resistor"],
  verificationData: [
    {
      inputs: { voltage: 12, current: 2, resistance: -1, power: -1 },
      expectedOutputs: { resistance: 6, power: 24 },
      tolerance: 1e-3,
      source: "Trivial"
    }
  ]
};

// src/lib/calculators/general/resistor-color-code.ts
var MULTIPLIERS = {
  0: 1,
  1: 10,
  2: 100,
  3: 1e3,
  4: 1e4,
  5: 1e5,
  6: 1e6,
  7: 1e7,
  8: 1e8,
  9: 1e9,
  10: 0.1,
  11: 0.01
};
var TOLERANCES = {
  1: 1,
  2: 2,
  5: 0.5,
  6: 0.25,
  7: 0.1,
  8: 0.05,
  10: 5,
  11: 10
};
function calculateColorCode(inputs) {
  const { band1, band2, band3, multiplier, tolerance, numBands } = inputs;
  const is5band = numBands >= 5;
  let baseValue;
  if (is5band) {
    baseValue = band1 * 100 + band2 * 10 + band3;
  } else {
    baseValue = band1 * 10 + band2;
  }
  const mult = MULTIPLIERS[multiplier] ?? 1;
  const resistance = baseValue * mult;
  const tol = TOLERANCES[tolerance] ?? 20;
  const minR = resistance * (1 - tol / 100);
  const maxR = resistance * (1 + tol / 100);
  return {
    values: {
      resistance,
      tolerance: tol,
      minResistance: Math.round(minR * 1e3) / 1e3,
      maxResistance: Math.round(maxR * 1e3) / 1e3
    }
  };
}
var resistorColorCode = {
  slug: "resistor-color-code",
  title: "Resistor Color Code Calculator",
  shortTitle: "Color Code",
  category: "general",
  description: "Decode resistor color bands to resistance value and tolerance. Supports 4-band, 5-band, and 6-band resistors. Instant color band to ohms conversion.",
  keywords: ["resistor color code", "resistor color calculator", "color band resistor", "resistor bands decoder", "4 band resistor", "5 band resistor"],
  inputs: [
    {
      key: "numBands",
      label: "Number of Bands",
      unit: "",
      defaultValue: 4,
      min: 4,
      max: 6,
      presets: [
        { label: "4-band", values: { numBands: 4 } },
        { label: "5-band", values: { numBands: 5 } }
      ]
    },
    {
      key: "band1",
      label: "Band 1 (1st digit)",
      unit: "",
      defaultValue: 1,
      // Brown
      min: 0,
      max: 9,
      tooltip: "Color: 0=Blk 1=Brn 2=Red 3=Org 4=Yel 5=Grn 6=Blu 7=Vio 8=Gry 9=Wht"
    },
    {
      key: "band2",
      label: "Band 2 (2nd digit)",
      unit: "",
      defaultValue: 0,
      // Black
      min: 0,
      max: 9
    },
    {
      key: "band3",
      label: "Band 3 (3rd digit / multiplier for 4-band)",
      unit: "",
      defaultValue: 4,
      // Yellow → ×10000 for 4-band use multiplier field
      min: 0,
      max: 11,
      tooltip: "For 4-band resistors this is actually the multiplier; for 5-band it is the 3rd digit"
    },
    {
      key: "multiplier",
      label: "Multiplier Band",
      unit: "",
      defaultValue: 2,
      // ×100
      min: 0,
      max: 11,
      tooltip: "10=Gold(\xD70.1) 11=Silver(\xD70.01)"
    },
    {
      key: "tolerance",
      label: "Tolerance Band",
      unit: "",
      defaultValue: 10,
      // Gold = 5%
      min: 1,
      max: 11,
      presets: [
        { label: "Gold (5%)", values: { tolerance: 10 } },
        { label: "Silver (10%)", values: { tolerance: 11 } },
        { label: "Brown (1%)", values: { tolerance: 1 } },
        { label: "Red (2%)", values: { tolerance: 2 } }
      ]
    }
  ],
  outputs: [
    { key: "resistance", label: "Resistance", unit: "\u03A9", precision: 3, format: "engineering" },
    { key: "tolerance", label: "Tolerance", unit: "%", precision: 2 },
    { key: "minResistance", label: "Min Value", unit: "\u03A9", precision: 3, format: "engineering" },
    { key: "maxResistance", label: "Max Value", unit: "\u03A9", precision: 3, format: "engineering" }
  ],
  calculate: calculateColorCode,
  formula: {
    primary: "R = (10 \\cdot d_1 + d_2) \\times 10^n",
    variables: [
      { symbol: "d\u2081,d\u2082", description: "First and second digit bands", unit: "" },
      { symbol: "n", description: "Multiplier exponent", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["ohms-law", "voltage-divider"],
  verificationData: [
    {
      inputs: { numBands: 4, band1: 1, band2: 0, band3: 0, multiplier: 2, tolerance: 10 },
      expectedOutputs: { resistance: 1e3, tolerance: 5 },
      tolerance: 1e-3,
      source: "1k\u03A9 5% resistor: Brown-Black-Red-Gold"
    }
  ]
};

// src/lib/calculators/general/rc-time-constant.ts
function calculateRC(inputs) {
  const { resistance, capacitance } = inputs;
  const capF = capacitance * 1e-9;
  const tau = resistance * capF;
  const tauUs = tau * 1e6;
  const t63 = tau;
  const t99 = tau * Math.log(100);
  const f3db = 1 / (2 * Math.PI * tau);
  return {
    values: {
      tauUs: Math.round(tauUs * 1e3) / 1e3,
      t63us: Math.round(t63 * 1e6 * 1e3) / 1e3,
      t99us: Math.round(t99 * 1e6 * 100) / 100,
      f3db: Math.round(f3db * 100) / 100
    }
  };
}
var rcTimeConstant = {
  slug: "rc-time-constant",
  title: "RC Time Constant Calculator",
  shortTitle: "RC Time Constant",
  category: "general",
  description: "Calculate RC circuit time constant \u03C4, charge time to 63.2% and 99%, and \u22123dB cutoff frequency. Essential for filter and timing circuit design.",
  keywords: ["rc time constant calculator", "rc circuit", "time constant tau", "rc filter cutoff frequency", "capacitor charge time"],
  inputs: [
    {
      key: "resistance",
      label: "Resistance",
      symbol: "R",
      unit: "\u03A9",
      defaultValue: 1e4,
      min: 1,
      max: 1e9,
      unitOptions: [
        { label: "\u03A9", factor: 1 },
        { label: "k\u03A9", factor: 1e3 },
        { label: "M\u03A9", factor: 1e6 }
      ]
    },
    {
      key: "capacitance",
      label: "Capacitance",
      symbol: "C",
      unit: "nF",
      defaultValue: 100,
      min: 1e-3,
      max: 1e9,
      unitOptions: [
        { label: "pF", factor: 1e-3 },
        { label: "nF", factor: 1 },
        { label: "\u03BCF", factor: 1e3 },
        { label: "mF", factor: 1e6 }
      ]
    }
  ],
  outputs: [
    { key: "tauUs", label: "Time Constant \u03C4", symbol: "\u03C4", unit: "\u03BCs", precision: 3 },
    { key: "t63us", label: "Time to 63.2%", unit: "\u03BCs", precision: 3 },
    { key: "t99us", label: "Time to 99%", unit: "\u03BCs", precision: 2 },
    { key: "f3db", label: "\u22123dB Frequency", unit: "Hz", precision: 2, format: "engineering" }
  ],
  calculate: calculateRC,
  formula: {
    primary: "\\tau = RC, \\quad f_{-3dB} = \\frac{1}{2\\pi RC}",
    variables: [
      { symbol: "\u03C4", description: "Time constant", unit: "s" },
      { symbol: "R", description: "Resistance", unit: "\u03A9" },
      { symbol: "C", description: "Capacitance", unit: "F" }
    ]
  },
  visualization: { type: "xy-plot", xLabel: "Time (\u03BCs)", yLabel: "Voltage (%)" },
  relatedCalculators: ["ohms-law", "lc-resonance"],
  verificationData: [
    {
      inputs: { resistance: 1e4, capacitance: 100 },
      expectedOutputs: { tauUs: 1e3, f3db: 159.15 },
      tolerance: 1e-3,
      source: "10k\u03A9 \xD7 100nF = 1ms, 1/(2\u03C0\xD70.001) \u2248 159.15 Hz"
    }
  ]
};

// src/lib/calculators/general/series-parallel-resistor.ts
function calculateSeriesParallel(inputs) {
  const { r1, r2, r3, r4, componentType } = inputs;
  const candidates = [r1, r2, r3, r4];
  const activeValues = candidates.filter((v) => v > 0);
  if (activeValues.length < 2) {
    return { values: {}, errors: ["Need at least 2 values"] };
  }
  let seriesTotal;
  let parallelTotal;
  if (componentType === 1) {
    seriesTotal = 1 / activeValues.reduce((sum, v) => sum + 1 / v, 0);
    parallelTotal = activeValues.reduce((sum, v) => sum + v, 0);
  } else {
    seriesTotal = activeValues.reduce((sum, v) => sum + v, 0);
    parallelTotal = 1 / activeValues.reduce((sum, v) => sum + 1 / v, 0);
  }
  let voltDividerRatio = 0;
  if (componentType === 0 && activeValues.length === 2) {
    voltDividerRatio = r2 / (r1 + r2);
  }
  return {
    values: {
      seriesTotal,
      parallelTotal,
      voltDividerRatio
    }
  };
}
var seriesParallelResistor = {
  slug: "series-parallel-resistor",
  title: "Series / Parallel Resistor, Capacitor & Inductor Calculator",
  shortTitle: "Series/Parallel R\xB7C\xB7L",
  category: "general",
  description: "Calculate the equivalent series and parallel combination of up to four resistors, capacitors, or inductors. Also computes the voltage divider ratio for two-resistor networks.",
  keywords: [
    "series parallel resistor calculator",
    "parallel resistor calculator",
    "capacitor in series",
    "capacitor in parallel",
    "inductor series parallel",
    "voltage divider ratio",
    "equivalent resistance"
  ],
  inputs: [
    {
      key: "r1",
      label: "R1 (or C1 in nF / L1 in \u03BCH)",
      symbol: "R1",
      unit: "\u03A9",
      defaultValue: 1e3,
      min: 1e-3,
      max: 1e9
    },
    {
      key: "r2",
      label: "R2 (or C2 in nF / L2 in \u03BCH)",
      symbol: "R2",
      unit: "\u03A9",
      defaultValue: 1e3,
      min: 0,
      max: 1e9
    },
    {
      key: "r3",
      label: "R3 (optional)",
      symbol: "R3",
      unit: "\u03A9",
      defaultValue: 0,
      min: 0,
      max: 1e9,
      tooltip: "Set to 0 to ignore. R3 for 3-resistor combinations."
    },
    {
      key: "r4",
      label: "R4 (optional)",
      symbol: "R4",
      unit: "\u03A9",
      defaultValue: 0,
      min: 0,
      max: 1e9,
      tooltip: "Set to 0 to ignore."
    },
    {
      key: "componentType",
      label: "Component Type",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 2,
      step: 1,
      tooltip: "0=Resistor (\u03A9), 1=Capacitor (nF), 2=Inductor (\u03BCH)"
    }
  ],
  outputs: [
    {
      key: "seriesTotal",
      label: "Series Total",
      unit: "\u03A9 / nF / \u03BCH",
      precision: 4,
      format: "engineering",
      tooltip: "Series Resistance (\u03A9) / Series Capacitance (nF) / Series Inductance (\u03BCH)"
    },
    {
      key: "parallelTotal",
      label: "Parallel Total",
      unit: "\u03A9 / nF / \u03BCH",
      precision: 4,
      format: "engineering",
      tooltip: "Parallel Resistance (\u03A9) / Parallel Capacitance (nF) / Parallel Inductance (\u03BCH)"
    },
    {
      key: "voltDividerRatio",
      label: "Voltage Divider Ratio (R2 only)",
      symbol: "Vout/Vin",
      unit: "V/V",
      precision: 4,
      tooltip: "Output voltage as a fraction of input voltage (Vout/Vin = R2/(R1+R2)). Only valid for two-resistor networks."
    }
  ],
  calculate: calculateSeriesParallel,
  formula: {
    primary: "R_{series} = R_1 + R_2 + \\ldots, \\quad \\frac{1}{R_{parallel}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\ldots",
    variables: [
      { symbol: "R_series", description: "Total series resistance / inductance", unit: "\u03A9 or \u03BCH" },
      { symbol: "R_parallel", description: "Total parallel resistance / inductance", unit: "\u03A9 or \u03BCH" },
      { symbol: "C_series", description: "1/C_total = 1/C1 + 1/C2 (caps in series)", unit: "nF" },
      { symbol: "C_parallel", description: "C_total = C1 + C2 (caps in parallel)", unit: "nF" }
    ],
    derivation: [
      "Resistors/Inductors in series: R_total = R1 + R2 + R3 + ...",
      "Resistors/Inductors in parallel: 1/R_total = 1/R1 + 1/R2 + 1/R3 + ...",
      "Capacitors in series: 1/C_total = 1/C1 + 1/C2 + ... (opposite to resistors)",
      "Capacitors in parallel: C_total = C1 + C2 + ...",
      "Voltage divider: Vout/Vin = R2 / (R1 + R2)"
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["ohms-law", "voltage-divider", "rc-time-constant", "lc-resonance"],
  verificationData: [
    {
      inputs: { r1: 1e3, r2: 1e3, r3: 0, r4: 0, componentType: 0 },
      expectedOutputs: { seriesTotal: 2e3, parallelTotal: 500 },
      tolerance: 1e-3,
      source: "1k\u03A9 + 1k\u03A9 = 2k\u03A9 series; 1/(1/1000+1/1000) = 500\u03A9 parallel"
    }
  ]
};

// src/lib/calculators/general/lc-resonance.ts
function calculateLCResonance(inputs) {
  const { inductance, capacitance, resistance, circuitType } = inputs;
  if (inductance <= 0) {
    return { values: {}, errors: ["Inductance must be greater than 0"] };
  }
  if (capacitance <= 0) {
    return { values: {}, errors: ["Capacitance must be greater than 0"] };
  }
  const L_H = inductance * 1e-6;
  const C_F = capacitance * 1e-12;
  const f0_Hz = 1 / (2 * Math.PI * Math.sqrt(L_H * C_F));
  const f0_MHz = f0_Hz / 1e6;
  const characteristicImpedance_ohm = Math.sqrt(L_H / C_F);
  let qFactor2;
  if (resistance > 0) {
    if (circuitType === 1) {
      qFactor2 = resistance / characteristicImpedance_ohm;
    } else {
      qFactor2 = characteristicImpedance_ohm / resistance;
    }
  } else {
    qFactor2 = 9999;
  }
  const bandwidth_kHz = qFactor2 > 0 ? f0_Hz / qFactor2 / 1e3 : 0;
  const wavelength_m = 299792458 / f0_Hz;
  return {
    values: {
      f0_MHz,
      characteristicImpedance_ohm,
      qFactor: qFactor2,
      bandwidth_kHz,
      wavelength_m
    }
  };
}
var lcResonance = {
  slug: "lc-resonance",
  title: "LC Resonance Calculator",
  shortTitle: "LC Resonance",
  category: "general",
  description: "Calculate the resonant frequency, characteristic impedance, Q factor, and bandwidth of a series or parallel LC tank circuit. Enter inductance, capacitance, and optional series resistance.",
  keywords: [
    "lc resonance calculator",
    "tank circuit frequency",
    "lc circuit calculator",
    "resonant frequency formula",
    "q factor calculator",
    "lc bandwidth",
    "parallel resonance",
    "series resonance"
  ],
  inputs: [
    {
      key: "inductance",
      label: "Inductance",
      symbol: "L",
      unit: "\u03BCH",
      defaultValue: 10,
      min: 1e-3,
      max: 1e6,
      presets: [
        { label: "100 nH (0.1 \u03BCH)", values: { inductance: 0.1 } },
        { label: "10 \u03BCH", values: { inductance: 10 } },
        { label: "100 \u03BCH", values: { inductance: 100 } },
        { label: "1 mH (1000 \u03BCH)", values: { inductance: 1e3 } }
      ]
    },
    {
      key: "capacitance",
      label: "Capacitance",
      symbol: "C",
      unit: "pF",
      defaultValue: 100,
      min: 0.01,
      max: 1e9,
      presets: [
        { label: "10 pF", values: { capacitance: 10 } },
        { label: "100 pF", values: { capacitance: 100 } },
        { label: "1000 pF (1nF)", values: { capacitance: 1e3 } },
        { label: "10000 pF (10nF)", values: { capacitance: 1e4 } }
      ]
    },
    {
      key: "resistance",
      label: "Series Resistance",
      symbol: "R",
      unit: "\u03A9",
      defaultValue: 0,
      min: 0,
      max: 1e4,
      tooltip: "Series resistance for Q and bandwidth. Set 0 for ideal LC."
    },
    {
      key: "circuitType",
      label: "Circuit Type",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 1,
      tooltip: "0=Series LC, 1=Parallel LC (tank)"
    }
  ],
  outputs: [
    {
      key: "f0_MHz",
      label: "Resonant Frequency",
      symbol: "f\u2080",
      unit: "MHz",
      precision: 4
    },
    {
      key: "characteristicImpedance_ohm",
      label: "Characteristic Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      precision: 2,
      format: "engineering",
      tooltip: "Z\u2080 = \u221A(L/C)"
    },
    {
      key: "qFactor",
      label: "Q Factor",
      symbol: "Q",
      unit: "",
      precision: 2,
      thresholds: {
        good: { min: 10 },
        warning: { min: 1, max: 10 },
        danger: { max: 1 }
      }
    },
    {
      key: "bandwidth_kHz",
      label: "\u22123 dB Bandwidth",
      symbol: "BW",
      unit: "kHz",
      precision: 3,
      format: "engineering"
    },
    {
      key: "wavelength_m",
      label: "Free-Space Wavelength",
      symbol: "\u03BB",
      unit: "m",
      precision: 4,
      format: "engineering",
      tooltip: "Free-space wavelength at the resonant frequency: \u03BB = c / f\u2080"
    }
  ],
  calculate: calculateLCResonance,
  exportComponents: (inputs) => {
    const isParallel = inputs.circuitType === 1;
    return [
      { qty: 1, description: "L", value: `${inputs.inductance} \u03BCH`, package: "0402", componentType: "L", placement: isParallel ? "shunt" : "series" },
      { qty: 1, description: "C", value: `${inputs.capacitance} pF`, package: "0402", componentType: "C", placement: isParallel ? "shunt" : "series" }
    ];
  },
  schematicSections: (inputs) => {
    const isParallel = inputs.circuitType === 1;
    const lLabel = `L ${inputs.inductance}\u03BCH`;
    const cLabel = `C ${inputs.capacitance}pF`;
    return [{
      label: isParallel ? "Parallel LC Tank" : "Series LC",
      elements: isParallel ? [
        { type: "L", placement: "shunt", label: lLabel },
        { type: "C", placement: "shunt", label: cLabel }
      ] : [
        { type: "L", placement: "series", label: lLabel },
        { type: "C", placement: "series", label: cLabel }
      ]
    }];
  },
  formula: {
    primary: "f_0 = \\frac{1}{2\\pi\\sqrt{LC}}, \\quad Z_0 = \\sqrt{\\frac{L}{C}}, \\quad Q = \\frac{Z_0}{R}",
    variables: [
      { symbol: "f\u2080", description: "Resonant frequency", unit: "Hz" },
      { symbol: "L", description: "Inductance", unit: "H" },
      { symbol: "C", description: "Capacitance", unit: "F" },
      { symbol: "Z\u2080", description: "Characteristic impedance", unit: "\u03A9" },
      { symbol: "Q", description: "Quality factor", unit: "" },
      { symbol: "R", description: "Series resistance", unit: "\u03A9" },
      { symbol: "BW", description: "\u22123 dB bandwidth = f\u2080 / Q", unit: "Hz" }
    ],
    derivation: [
      "At resonance, inductive reactance equals capacitive reactance: \u03C9L = 1/(\u03C9C)",
      "Solving for \u03C9: \u03C9\u2080 = 1/\u221A(LC), therefore f\u2080 = 1/(2\u03C0\u221A(LC))",
      "Characteristic impedance: Z\u2080 = \u221A(L/C)",
      "Series Q: Q = Z\u2080/R = (1/R)\u221A(L/C)",
      "Parallel Q: Q = R/Z\u2080 = R\u221A(C/L)",
      "Bandwidth: BW = f\u2080/Q"
    ],
    reference: "Terman, Radio Engineers' Handbook, McGraw-Hill, 1943"
  },
  visualization: { type: "bode-plot", freqRange: [1e3, 1e9] },
  relatedCalculators: ["rc-time-constant", "filter-designer", "series-parallel-resistor", "coax-impedance"],
  verificationData: [
    {
      inputs: { inductance: 10, capacitance: 100, resistance: 0, circuitType: 0 },
      expectedOutputs: { f0_MHz: 5.032, characteristicImpedance_ohm: 316.23 },
      tolerance: 0.01,
      source: "L=10\u03BCH, C=100pF: f\u2080=1/(2\u03C0\u221A(10e-6\xD7100e-12))\u22485.032 MHz; Z\u2080=\u221A(10e-6/100e-12)=\u221A(1e5)\u2248316.2 \u03A9"
    }
  ]
};

// src/lib/calculators/general/opamp-gain.ts
function calculateOpampGain(inputs) {
  const { configuration, r1, r2, gbwProduct, supplyVoltage } = inputs;
  if (r1 <= 0) {
    return { values: {}, errors: ["R1 (feedback resistor) must be greater than 0"] };
  }
  if (r2 <= 0) {
    return { values: {}, errors: ["R2 (input resistor) must be greater than 0"] };
  }
  if (gbwProduct <= 0) {
    return { values: {}, errors: ["GBW product must be greater than 0"] };
  }
  let gain;
  let gainMagnitude;
  let inputImpedance_kohm;
  if (configuration === 0) {
    gain = -(r1 / r2);
    gainMagnitude = r1 / r2;
    inputImpedance_kohm = r2;
  } else if (configuration === 2) {
    gain = r1 / r2;
    gainMagnitude = r1 / r2;
    inputImpedance_kohm = 2 * r2;
  } else {
    gain = 1 + r1 / r2;
    gainMagnitude = gain;
    inputImpedance_kohm = 1e9;
  }
  const gainDb = 20 * Math.log10(gainMagnitude);
  const f3db_kHz = gbwProduct * 1e3 / gainMagnitude;
  const slewRateLimit_vus = supplyVoltage * f3db_kHz * 2 * Math.PI / 1e6;
  const maxOutputVpp = supplyVoltage * 0.8;
  return {
    values: {
      gain,
      gainDb,
      f3db_kHz,
      inputImpedance_kohm,
      maxOutputVpp
    }
  };
}
var opampGain = {
  slug: "opamp-gain",
  title: "Op-Amp Gain & Bandwidth Calculator",
  shortTitle: "Op-Amp Gain",
  category: "general",
  description: "Calculate op-amp voltage gain, gain in dB, \u22123 dB bandwidth, and input impedance for inverting, non-inverting, and differential amplifier configurations.",
  keywords: [
    "op amp gain calculator",
    "operational amplifier gain",
    "inverting amplifier gain",
    "non-inverting amplifier",
    "gain bandwidth product",
    "opamp bandwidth calculator",
    "differential amplifier gain"
  ],
  inputs: [
    {
      key: "configuration",
      label: "Amplifier Configuration",
      unit: "",
      defaultValue: 1,
      min: 0,
      max: 2,
      step: 1,
      tooltip: "0=Inverting, 1=Non-inverting, 2=Differential"
    },
    {
      key: "r1",
      label: "R1 (feedback resistor Rf)",
      symbol: "Rf",
      unit: "k\u03A9",
      defaultValue: 10,
      min: 1e-3,
      max: 1e4
    },
    {
      key: "r2",
      label: "R2 (input resistor Rin)",
      symbol: "Rin",
      unit: "k\u03A9",
      defaultValue: 1,
      min: 1e-3,
      max: 1e4
    },
    {
      key: "gbwProduct",
      label: "Gain-Bandwidth Product",
      symbol: "GBW",
      unit: "MHz",
      defaultValue: 1,
      min: 1e-3,
      max: 1e4,
      tooltip: "Op-amp gain-bandwidth product from datasheet. LM741=1MHz, TL071=3MHz, NE5534=10MHz"
    },
    {
      key: "supplyVoltage",
      label: "Supply Voltage (total)",
      symbol: "Vcc",
      unit: "V",
      defaultValue: 15,
      min: 1.8,
      max: 60,
      tooltip: "Total supply: \xB115V \u2192 enter 30V"
    }
  ],
  outputs: [
    {
      key: "gain",
      label: "Voltage Gain (V/V)",
      symbol: "Av",
      unit: "V/V",
      precision: 3,
      tooltip: "Negative value indicates phase inversion (inverting configuration)"
    },
    {
      key: "gainDb",
      label: "Voltage Gain",
      symbol: "Av",
      unit: "dB",
      precision: 2,
      thresholds: {
        warning: { min: 60 }
      },
      tooltip: "Gain above 60 dB may cause instability or oscillation"
    },
    {
      key: "f3db_kHz",
      label: "\u22123 dB Bandwidth",
      symbol: "f\u208B\u2083dB",
      unit: "kHz",
      precision: 2,
      format: "engineering"
    },
    {
      key: "inputImpedance_kohm",
      label: "Input Impedance",
      symbol: "Zin",
      unit: "k\u03A9",
      precision: 0,
      format: "engineering",
      tooltip: "Non-inverting \u2248 \u221E (shown as 1e9 k\u03A9); Inverting = Rin; Differential = 2\xD7Rin"
    },
    {
      key: "maxOutputVpp",
      label: "Max Output Swing (typ)",
      symbol: "Vout_max",
      unit: "Vpp",
      precision: 2,
      tooltip: "Typical maximum output swing \u2248 80% of total supply voltage"
    }
  ],
  calculate: calculateOpampGain,
  formula: {
    primary: "A_v^{non-inv} = 1 + \\frac{R_f}{R_{in}}, \\quad A_v^{inv} = -\\frac{R_f}{R_{in}}, \\quad f_{-3dB} = \\frac{GBW}{|A_v|}",
    variables: [
      { symbol: "Av", description: "Voltage gain", unit: "V/V" },
      { symbol: "Rf", description: "Feedback resistor (R1)", unit: "k\u03A9" },
      { symbol: "Rin", description: "Input resistor (R2)", unit: "k\u03A9" },
      { symbol: "GBW", description: "Gain-bandwidth product", unit: "Hz" },
      { symbol: "f\u208B\u2083dB", description: "\u22123 dB bandwidth", unit: "Hz" },
      { symbol: "Zin", description: "Input impedance", unit: "\u03A9" }
    ],
    derivation: [
      "Non-inverting: Av = 1 + Rf/Rin (in-phase output)",
      "Inverting: Av = -Rf/Rin (180\xB0 phase shift)",
      "Differential: Av = Rf/Rin (assumes all four resistors matched)",
      "Bandwidth limited by GBW product: f\u208B\u2083dB = GBW / |Av|",
      "Input impedance: non-inv \u2248 \u221E, inv = Rin, diff = 2\xD7Rin"
    ],
    reference: "Horowitz & Hill, The Art of Electronics, 3rd ed."
  },
  visualization: { type: "none" },
  relatedCalculators: ["filter-designer", "rc-time-constant", "ohms-law", "series-parallel-resistor"],
  verificationData: [
    {
      inputs: { configuration: 1, r1: 10, r2: 1, gbwProduct: 1, supplyVoltage: 15 },
      expectedOutputs: { gain: 11, gainDb: 20.83, f3db_kHz: 90.91 },
      tolerance: 0.01,
      source: "Non-inv: Av=1+10/1=11; 20\xD7log10(11)\u224820.83 dB; f\u208B\u2083dB=1000 kHz/11\u224890.91 kHz"
    }
  ]
};

// src/lib/calculators/protocol/uart-baud-rate.ts
function calculateUartBaudRate(inputs) {
  const { baudRate, dataBits, stopBits, parity, clockFreq } = inputs;
  if (baudRate <= 0) {
    return { values: {}, errors: ["Baud rate must be greater than 0"] };
  }
  if (clockFreq <= 0) {
    return { values: {}, errors: ["Clock frequency must be greater than 0"] };
  }
  if (dataBits < 5 || dataBits > 9) {
    return { values: {}, errors: ["Data bits must be between 5 and 9"] };
  }
  const frameBits = 1 + dataBits + parity + stopBits;
  const bitPeriod_us = 1e6 / baudRate;
  const framePeriod_us = bitPeriod_us * frameBits;
  const framesPerSecond = 1e6 / framePeriod_us;
  const throughputKbps = framesPerSecond * dataBits / 1e3;
  const brrDivisor = clockFreq * 1e6 / (16 * baudRate);
  const brrRounded = Math.round(brrDivisor);
  const actualBaudRate = clockFreq * 1e6 / (16 * brrRounded);
  const baudRateError_pct = Math.abs(actualBaudRate - baudRate) / baudRate * 100;
  const warnings = [];
  if (baudRateError_pct > 2) {
    warnings.push("Baud rate error exceeds 2% \u2014 may cause framing errors");
  }
  return {
    values: {
      frameBits: Math.round(frameBits),
      bitPeriod_us: Math.round(bitPeriod_us * 1e3) / 1e3,
      framePeriod_us: Math.round(framePeriod_us * 1e3) / 1e3,
      framesPerSecond: Math.round(framesPerSecond * 10) / 10,
      throughputKbps: Math.round(throughputKbps * 1e3) / 1e3,
      brrDivisor: Math.round(brrDivisor * 10) / 10,
      actualBaudRate: Math.round(actualBaudRate * 10) / 10,
      baudRateError_pct: Math.round(baudRateError_pct * 1e3) / 1e3
    },
    warnings: warnings.length > 0 ? warnings : void 0,
    intermediateValues: {
      brrRounded
    }
  };
}
var uartBaudRate = {
  slug: "uart-baud-rate",
  title: "UART Baud Rate & Frame Timing Calculator",
  shortTitle: "UART Baud Rate",
  category: "protocol",
  description: "Calculate UART frame timing, throughput, and USART BRR register divisor from baud rate, data format, and MCU clock frequency. Identify baud rate error for reliable serial communication.",
  keywords: [
    "uart baud rate calculator",
    "uart frame timing",
    "usart brr register",
    "baud rate error",
    "serial communication calculator",
    "uart bit period",
    "uart throughput"
  ],
  inputs: [
    {
      key: "baudRate",
      label: "Baud Rate",
      symbol: "B",
      unit: "bps",
      defaultValue: 115200,
      min: 300,
      max: 4e6,
      step: 1,
      tooltip: "Serial baud rate in bits per second",
      presets: [
        { label: "9600", values: { baudRate: 9600 } },
        { label: "57600", values: { baudRate: 57600 } },
        { label: "115200", values: { baudRate: 115200 } },
        { label: "230400", values: { baudRate: 230400 } },
        { label: "1000000", values: { baudRate: 1e6 } }
      ]
    },
    {
      key: "dataBits",
      label: "Data Bits",
      symbol: "D",
      unit: "bits",
      defaultValue: 8,
      min: 5,
      max: 9,
      step: 1,
      tooltip: "Number of data bits per frame (typically 8)",
      presets: [
        { label: "7 data bits", values: { dataBits: 7 } },
        { label: "8 data bits (standard)", values: { dataBits: 8 } },
        { label: "9 data bits", values: { dataBits: 9 } }
      ]
    },
    {
      key: "stopBits",
      label: "Stop Bits",
      symbol: "S",
      unit: "bits",
      defaultValue: 1,
      min: 1,
      max: 2,
      step: 1,
      tooltip: "1 stop bit is standard; 2 may be used for slow receivers"
    },
    {
      key: "parity",
      label: "Parity Bits",
      symbol: "P",
      unit: "bits",
      defaultValue: 0,
      min: 0,
      max: 2,
      step: 1,
      tooltip: "0 = None, 1 = Even or Odd parity (1 bit), 2 = Mark/Space (rare)",
      presets: [
        { label: "None (0 bits)", values: { parity: 0 } },
        { label: "Even/Odd (1 bit)", values: { parity: 1 } }
      ]
    },
    {
      key: "clockFreq",
      label: "MCU Clock Frequency",
      symbol: "f_{clk}",
      unit: "MHz",
      defaultValue: 16,
      min: 1,
      max: 1e3,
      step: 0.1,
      tooltip: "MCU peripheral (APB) clock frequency used for BRR divisor calculation",
      presets: [
        { label: "8 MHz", values: { clockFreq: 8 } },
        { label: "16 MHz", values: { clockFreq: 16 } },
        { label: "48 MHz", values: { clockFreq: 48 } },
        { label: "72 MHz", values: { clockFreq: 72 } },
        { label: "180 MHz", values: { clockFreq: 180 } }
      ]
    }
  ],
  outputs: [
    {
      key: "frameBits",
      label: "Bits per Frame",
      symbol: "N_{frame}",
      unit: "bits",
      precision: 0,
      tooltip: "1 start + data bits + parity + stop bits"
    },
    {
      key: "bitPeriod_us",
      label: "Bit Period",
      symbol: "T_{bit}",
      unit: "\xB5s",
      precision: 3
    },
    {
      key: "framePeriod_us",
      label: "Frame Period",
      symbol: "T_{frame}",
      unit: "\xB5s",
      precision: 3
    },
    {
      key: "framesPerSecond",
      label: "Frames per Second",
      symbol: "fps",
      unit: "fps",
      precision: 1
    },
    {
      key: "throughputKbps",
      label: "Data Throughput",
      symbol: "Tp",
      unit: "kbps",
      precision: 3,
      tooltip: "Effective data rate (data bits only, not overhead)"
    },
    {
      key: "brrDivisor",
      label: "BRR Divisor",
      symbol: "BRR",
      unit: "",
      precision: 1,
      tooltip: "USART BRR register value (16\xD7 oversampling); round to nearest integer"
    },
    {
      key: "actualBaudRate",
      label: "Actual Baud Rate",
      symbol: "B_{actual}",
      unit: "bps",
      precision: 1,
      tooltip: "Baud rate achieved with the rounded integer BRR divisor"
    },
    {
      key: "baudRateError_pct",
      label: "Baud Rate Error",
      symbol: "\u03B5_B",
      unit: "%",
      precision: 3,
      tooltip: "Deviation of actual from target baud rate; keep below 2% for reliable operation",
      thresholds: {
        good: { max: 0.5 },
        warning: { max: 2 },
        danger: { max: 2 }
      }
    }
  ],
  calculate: calculateUartBaudRate,
  formula: {
    primary: "BRR = \\frac{f_{clk}}{16 \\times B}, \\quad T_{bit} = \\frac{1}{B}, \\quad N_{frame} = 1 + D + P + S",
    variables: [
      { symbol: "B", description: "Target baud rate", unit: "bps" },
      { symbol: "f_{clk}", description: "MCU peripheral clock frequency", unit: "Hz" },
      { symbol: "BRR", description: "Baud rate register divisor (integer)", unit: "" },
      { symbol: "T_{bit}", description: "Duration of one bit", unit: "s" },
      { symbol: "N_{frame}", description: "Total bits per UART frame", unit: "bits" },
      { symbol: "D", description: "Data bits", unit: "bits" },
      { symbol: "P", description: "Parity bits (0 or 1)", unit: "bits" },
      { symbol: "S", description: "Stop bits (1 or 2)", unit: "bits" }
    ],
    derivation: [
      "N_frame = 1 (start) + D + P + S",
      "T_bit = 1 / B [seconds]",
      "T_frame = T_bit \xD7 N_frame",
      "BRR = f_clk / (16 \xD7 B)",
      "B_actual = f_clk / (16 \xD7 round(BRR))",
      "\u03B5_B = |B_actual \u2212 B| / B \xD7 100 %"
    ],
    reference: "STM32 Reference Manual RM0008 \xA727.3.4; ST AN2908"
  },
  visualization: { type: "none" },
  relatedCalculators: ["i2c-pullup", "rc-time-constant"],
  verificationData: [
    {
      inputs: { baudRate: 115200, dataBits: 8, stopBits: 1, parity: 0, clockFreq: 16 },
      expectedOutputs: { frameBits: 10, bitPeriod_us: 8.681 },
      tolerance: 0.01,
      source: "N_frame = 1+8+0+1 = 10; T_bit = 1e6/115200 = 8.6806 \xB5s"
    }
  ]
};

// src/lib/calculators/protocol/i2c-pullup.ts
function calculateI2cPullup(inputs) {
  const { vdd, speedMode, busCap, numDevices } = inputs;
  if (vdd <= 0) {
    return { values: {}, errors: ["Supply voltage must be greater than 0"] };
  }
  if (busCap <= 0) {
    return { values: {}, errors: ["Bus capacitance must be greater than 0"] };
  }
  let riseTimeTarget_ns;
  let iol;
  if (speedMode === 0) {
    riseTimeTarget_ns = 1e3;
    iol = 3e-3;
  } else if (speedMode === 1) {
    riseTimeTarget_ns = 300;
    iol = 3e-3;
  } else {
    riseTimeTarget_ns = 120;
    iol = 0.02;
  }
  const vol_max = 0.4;
  const R_max = riseTimeTarget_ns * 1e-9 / (0.8473 * busCap * 1e-12);
  const R_min = (vdd - vol_max) / iol;
  if (R_min >= R_max) {
    return {
      values: {},
      errors: [
        `R_min (${Math.round(R_min)} \u03A9) \u2265 R_max (${Math.round(R_max)} \u03A9) \u2014 reduce bus capacitance or switch voltage, or choose a slower speed mode`
      ]
    };
  }
  const R_recommended = Math.sqrt(R_min * R_max);
  const current_ma = vdd / R_recommended * 1e3;
  const powerPerLine_mw = vdd * current_ma;
  void numDevices;
  const warnings = [];
  if (R_recommended < 680) {
    warnings.push("Recommended pull-up is below 680 \u03A9 \u2014 high static current; verify I\xB2C sink capability");
  } else if (R_recommended > 1e4) {
    warnings.push("Recommended pull-up exceeds 10 k\u03A9 \u2014 marginal rise time; reduce bus capacitance");
  }
  return {
    values: {
      R_max_ohm: Math.round(R_max),
      R_min_ohm: Math.round(R_min),
      R_recommended_ohm: Math.round(R_recommended),
      current_ma: Math.round(current_ma * 100) / 100,
      powerPerLine_mw: Math.round(powerPerLine_mw * 10) / 10,
      riseTimeTarget_ns: Math.round(riseTimeTarget_ns)
    },
    warnings: warnings.length > 0 ? warnings : void 0,
    intermediateValues: {
      iol_ma: iol * 1e3
    }
  };
}
var i2cPullup = {
  slug: "i2c-pullup",
  title: "I2C Pull-Up Resistor Calculator",
  shortTitle: "I2C Pull-Up",
  category: "protocol",
  description: "Calculate I2C pull-up resistor values for Standard (100 kHz), Fast (400 kHz), and Fast-Plus (1 MHz) modes. Derives minimum, maximum, and recommended resistance from supply voltage and bus capacitance per NXP UM10204.",
  keywords: [
    "i2c pull up resistor calculator",
    "i2c pullup resistor",
    "i2c bus capacitance",
    "i2c rise time",
    "scl sda pull up",
    "nxp um10204",
    "i2c fast mode",
    "i2c fast-plus"
  ],
  inputs: [
    {
      key: "vdd",
      label: "Supply Voltage",
      symbol: "V_{DD}",
      unit: "V",
      defaultValue: 3.3,
      min: 1.8,
      max: 5.5,
      step: 0.1,
      tooltip: "I2C bus supply voltage (pull-up rail)",
      presets: [
        { label: "1.8 V", values: { vdd: 1.8 } },
        { label: "3.3 V", values: { vdd: 3.3 } },
        { label: "5 V", values: { vdd: 5 } }
      ]
    },
    {
      key: "speedMode",
      label: "Speed Mode",
      symbol: "mode",
      unit: "",
      defaultValue: 1,
      min: 0,
      max: 2,
      step: 1,
      tooltip: "0 = Standard 100 kHz, 1 = Fast 400 kHz, 2 = Fast-Plus 1 MHz",
      presets: [
        { label: "Standard (100 kHz)", values: { speedMode: 0 } },
        { label: "Fast (400 kHz)", values: { speedMode: 1 } },
        { label: "Fast-Plus (1 MHz)", values: { speedMode: 2 } }
      ]
    },
    {
      key: "busCap",
      label: "Bus Capacitance",
      symbol: "C_{bus}",
      unit: "pF",
      defaultValue: 100,
      min: 10,
      max: 400,
      step: 5,
      tooltip: "Total bus capacitance including PCB traces and device pins"
    },
    {
      key: "numDevices",
      label: "Number of Devices",
      symbol: "N",
      unit: "",
      defaultValue: 2,
      min: 1,
      max: 16,
      step: 1,
      tooltip: "Number of I2C devices on the bus (informational; affects stray capacitance estimate)"
    }
  ],
  outputs: [
    {
      key: "R_max_ohm",
      label: "R_pull Maximum",
      symbol: "R_{max}",
      unit: "\u03A9",
      precision: 0,
      tooltip: "Maximum pull-up for required rise time (t_r / (0.8473 \xD7 C_bus))"
    },
    {
      key: "R_min_ohm",
      label: "R_pull Minimum",
      symbol: "R_{min}",
      unit: "\u03A9",
      precision: 0,
      tooltip: "Minimum pull-up from sink current limit ((V_DD \u2212 V_OL) / I_OL)"
    },
    {
      key: "R_recommended_ohm",
      label: "Recommended R_pull",
      symbol: "R_{rec}",
      unit: "\u03A9",
      precision: 0,
      tooltip: "Geometric mean of R_min and R_max; choose nearest standard E24/E96 value",
      thresholds: {
        good: { min: 1e3, max: 4700 },
        warning: { min: 680, max: 1e4 },
        danger: { max: 680 }
      }
    },
    {
      key: "current_ma",
      label: "Bus Current (per line)",
      symbol: "I_{bus}",
      unit: "mA",
      precision: 2,
      tooltip: "Static current drawn per line when the bus is at V_DD"
    },
    {
      key: "powerPerLine_mw",
      label: "Power per Line (low)",
      symbol: "P_{line}",
      unit: "mW",
      precision: 1,
      tooltip: "Approximate power dissipated in pull-up when line is held low"
    },
    {
      key: "riseTimeTarget_ns",
      label: "Rise Time Target",
      symbol: "t_r",
      unit: "ns",
      precision: 0,
      tooltip: "Maximum permitted rise time for the selected speed mode (NXP UM10204)"
    }
  ],
  calculate: calculateI2cPullup,
  formula: {
    primary: "R_{max} = \\frac{t_r}{0.8473 \\cdot C_{bus}}, \\quad R_{min} = \\frac{V_{DD} - V_{OL}}{I_{OL}}, \\quad R_{rec} = \\sqrt{R_{min} \\cdot R_{max}}",
    variables: [
      { symbol: "R_{max}", description: "Maximum pull-up resistance (rise time limit)", unit: "\u03A9" },
      { symbol: "R_{min}", description: "Minimum pull-up resistance (sink current limit)", unit: "\u03A9" },
      { symbol: "R_{rec}", description: "Recommended pull-up (geometric mean)", unit: "\u03A9" },
      { symbol: "t_r", description: "Maximum rise time for speed mode", unit: "ns" },
      { symbol: "C_{bus}", description: "Total bus capacitance", unit: "pF" },
      { symbol: "V_{DD}", description: "Supply voltage", unit: "V" },
      { symbol: "V_{OL}", description: "Maximum output-low voltage (0.4 V)", unit: "V" },
      { symbol: "I_{OL}", description: "Sink current (3 mA std/fast; 20 mA fast-plus)", unit: "A" }
    ],
    derivation: [
      "t_rise \u2248 0.8473 \xD7 R_pull \xD7 C_bus  (NXP approximation)",
      "R_max = t_r / (0.8473 \xD7 C_bus)",
      "R_min = (V_DD \u2212 V_OL) / I_OL",
      "R_rec = sqrt(R_min \xD7 R_max)  [geometric mean]"
    ],
    reference: "NXP I2C-bus specification and user manual, Rev. 7.0 (UM10204), \xA77.1"
  },
  visualization: { type: "none" },
  relatedCalculators: ["uart-baud-rate", "rc-time-constant", "ohms-law"],
  exportComponents: (_inputs, outputs) => {
    const r = outputs?.R_recommended_ohm ?? 0;
    const fmtR = (ohm) => ohm >= 1e3 ? `${+(ohm / 1e3).toPrecision(3)} k\u03A9` : `${ohm} \u03A9`;
    return [
      { qty: 1, description: "R (SDA pull-up)", value: fmtR(r), package: "0402", componentType: "R", placement: "series" },
      { qty: 1, description: "R (SCL pull-up)", value: fmtR(r), package: "0402", componentType: "R", placement: "series" }
    ];
  },
  verificationData: [
    {
      inputs: { vdd: 3.3, speedMode: 1, busCap: 100, numDevices: 2 },
      expectedOutputs: { R_max_ohm: 3540 },
      tolerance: 0.05,
      source: "R_max = 300e-9 / (0.8473 \xD7 100e-12) = 300/84.73 \xD7 1000 \u2248 3542 \u03A9 (NXP UM10204)"
    }
  ]
};

// src/lib/calculators/protocol/clock-jitter.ts
function calculateClockJitter(inputs) {
  const { refJitter_ps, pllJitter_ps, bufferJitter_ps, bufferStages, traceDelay_ps, setupTime_ps, holdTime_ps, clockFreqMHz } = inputs;
  if (clockFreqMHz <= 0) return { values: {}, errors: ["Clock frequency must be > 0"] };
  const periodPs = 1e6 / clockFreqMHz;
  const bufferTotalJitter_ps = bufferJitter_ps * Math.sqrt(bufferStages);
  const totalJitter_ps = Math.sqrt(
    refJitter_ps ** 2 + pllJitter_ps ** 2 + bufferTotalJitter_ps ** 2
  ) + traceDelay_ps;
  const availableBudget_ps = periodPs - setupTime_ps - holdTime_ps;
  const setupMargin_ps = availableBudget_ps - totalJitter_ps;
  const budgetUsed_pct = totalJitter_ps / availableBudget_ps * 100;
  const warnings = [];
  if (setupMargin_ps < 0) {
    warnings.push(`Timing violation: setup margin is ${setupMargin_ps.toFixed(0)} ps \u2014 reduce jitter or lower clock frequency`);
  } else if (budgetUsed_pct > 80) {
    warnings.push(`Jitter uses ${budgetUsed_pct.toFixed(0)}% of timing budget \u2014 consider tighter jitter sources`);
  }
  return {
    values: {
      totalJitter_ps,
      setupMargin_ps,
      availableBudget_ps,
      budgetUsed_pct,
      periodPs,
      bufferTotalJitter_ps
    },
    warnings: warnings.length ? warnings : void 0
  };
}
var clockJitter = {
  slug: "clock-jitter",
  title: "Clock Tree Jitter Budget Calculator",
  shortTitle: "Clock Jitter",
  category: "protocol",
  description: "Calculate clock tree timing budget for FPGA and SoC designs. Enter reference oscillator jitter, PLL noise floor, buffer stages, and target clock frequency to compute setup margin.",
  keywords: ["clock jitter", "timing budget", "setup time", "hold time", "PLL jitter", "clock tree", "FPGA timing", "phase noise"],
  inputs: [
    { key: "clockFreqMHz", label: "Clock Frequency", unit: "MHz", defaultValue: 200, min: 1e-3, max: 1e4, tooltip: "Target clock frequency at the destination register" },
    { key: "setupTime_ps", label: "Register Setup Time", unit: "ps", defaultValue: 80, min: 0, max: 5e3, tooltip: "From device datasheet \u2014 minimum setup time before clock edge" },
    { key: "holdTime_ps", label: "Register Hold Time", unit: "ps", defaultValue: 40, min: 0, max: 5e3, tooltip: "From device datasheet \u2014 minimum hold time after clock edge" },
    { key: "refJitter_ps", label: "Reference Oscillator Jitter", unit: "ps", defaultValue: 50, min: 0, max: 1e4, tooltip: "RMS jitter of TCXO or VCTCXO \u2014 from oscillator datasheet" },
    { key: "pllJitter_ps", label: "PLL Added Jitter", unit: "ps", defaultValue: 100, min: 0, max: 1e4, tooltip: "RMS jitter added by PLL \u2014 from PLL datasheet or simulation" },
    { key: "bufferJitter_ps", label: "Clock Buffer Jitter", unit: "ps", defaultValue: 25, min: 0, max: 1e3, tooltip: "Additive jitter per clock buffer stage (e.g. CDCLVP1204: 20 ps)" },
    { key: "bufferStages", label: "Buffer Stages", unit: "", defaultValue: 2, min: 0, max: 10, step: 1, tooltip: "Number of clock buffer/fanout stages between PLL and destination" },
    { key: "traceDelay_ps", label: "PCB Trace Skew", unit: "ps", defaultValue: 20, min: 0, max: 1e3, tooltip: "Clock tree routing skew \u2014 150 ps/inch on FR4 at 6 mil trace" }
  ],
  outputs: [
    {
      key: "setupMargin_ps",
      label: "Setup Margin",
      unit: "ps",
      precision: 1,
      primary: true,
      thresholds: { good: { min: 100 }, warning: { min: 0, max: 100 }, danger: { min: 0 } }
    },
    { key: "totalJitter_ps", label: "Total Jitter", unit: "ps", precision: 1 },
    {
      key: "budgetUsed_pct",
      label: "Budget Used",
      unit: "%",
      precision: 1,
      thresholds: { good: { max: 60 }, warning: { min: 60, max: 80 }, danger: { min: 80 } }
    },
    { key: "availableBudget_ps", label: "Available Budget", unit: "ps", precision: 1 },
    { key: "periodPs", label: "Clock Period", unit: "ps", precision: 1 },
    { key: "bufferTotalJitter_ps", label: "Buffer Total Jitter", unit: "ps", precision: 1 }
  ],
  calculate: calculateClockJitter,
  formula: {
    primary: "J_total = \u221A(J_ref\xB2 + J_pll\xB2 + N\xB7J_buf\xB2) + t_skew",
    latex: "J_{total} = \\sqrt{J_{ref}^2 + J_{pll}^2 + N \\cdot J_{buf}^2} + t_{skew}",
    variables: [
      { symbol: "J_ref", description: "Reference oscillator jitter (RMS)", unit: "ps" },
      { symbol: "J_pll", description: "PLL additive jitter (RMS)", unit: "ps" },
      { symbol: "J_buf", description: "Per-stage buffer jitter", unit: "ps" },
      { symbol: "N", description: "Number of buffer stages", unit: "" },
      { symbol: "t_skew", description: "PCB trace skew (deterministic)", unit: "ps" }
    ]
  },
  relatedCalculators: ["phase-noise-to-jitter", "uart-baud-rate", "spi-timing"]
};

// src/lib/calculators/thermal/heatsink-calculator.ts
function calculateHeatsink(inputs) {
  const { powerDissipation, maxJunctionTemp, ambientTemp, thetaJC, thetaCS } = inputs;
  if (powerDissipation <= 0) {
    return { values: {}, errors: ["Power dissipation must be greater than 0"] };
  }
  const warnings = [];
  const thetaJA_total = (maxJunctionTemp - ambientTemp) / powerDissipation;
  const thetaSA_required = thetaJA_total - thetaJC - thetaCS;
  const junctionTemp = ambientTemp + powerDissipation * (thetaJC + thetaCS + Math.max(0, thetaSA_required));
  const tempRise = junctionTemp - ambientTemp;
  if (thetaSA_required < 0) {
    warnings.push("No standard heatsink required (natural convection sufficient)");
  } else if (thetaSA_required < 1) {
    warnings.push("Very low \u03B8_SA \u2014 consider forced air cooling");
  }
  return {
    values: {
      thetaSA_required,
      junctionTemp,
      thetaJA_total,
      tempRise
    },
    warnings
  };
}
var heatsinkCalculator = {
  slug: "heatsink-calculator",
  title: "Heatsink Calculator",
  shortTitle: "Heatsink",
  category: "thermal",
  description: "Calculate required heatsink thermal resistance and junction temperature for power devices",
  keywords: ["heatsink", "thermal resistance", "junction temperature", "\u03B8JA", "\u03B8JC", "\u03B8CS", "thermal management", "power dissipation"],
  inputs: [
    {
      key: "powerDissipation",
      label: "Power Dissipation",
      symbol: "P_D",
      unit: "W",
      defaultValue: 5,
      min: 0,
      step: 0.1
    },
    {
      key: "maxJunctionTemp",
      label: "Max Junction Temperature",
      symbol: "T_Jmax",
      unit: "\xB0C",
      defaultValue: 125,
      min: 25,
      max: 200
    },
    {
      key: "ambientTemp",
      label: "Ambient Temperature",
      symbol: "T_A",
      unit: "\xB0C",
      defaultValue: 25,
      min: -40,
      max: 85
    },
    {
      key: "thetaJC",
      label: "Junction-to-Case Resistance",
      symbol: "\u03B8_JC",
      unit: "\xB0C/W",
      defaultValue: 2,
      min: 0.1,
      tooltip: "Junction-to-case thermal resistance from datasheet"
    },
    {
      key: "thetaCS",
      label: "Case-to-Heatsink Resistance",
      symbol: "\u03B8_CS",
      unit: "\xB0C/W",
      defaultValue: 0.5,
      min: 0,
      tooltip: "Case-to-heatsink thermal resistance (thermal pad/grease)"
    }
  ],
  outputs: [
    {
      key: "thetaSA_required",
      label: "Required \u03B8_SA",
      symbol: "\u03B8_SA",
      unit: "\xB0C/W",
      precision: 2,
      tooltip: "Required heatsink-to-ambient thermal resistance \u2014 lower is better",
      thresholds: {
        good: { min: 2 },
        warning: { min: 0, max: 5 },
        danger: { min: 0 }
      }
    },
    {
      key: "junctionTemp",
      label: "Junction Temperature",
      symbol: "T_J",
      unit: "\xB0C",
      precision: 1,
      thresholds: {
        good: { max: 100 },
        warning: { max: 125 },
        danger: { max: 125 }
      }
    },
    {
      key: "thetaJA_total",
      label: "Total \u03B8_JA",
      symbol: "\u03B8_JA",
      unit: "\xB0C/W",
      precision: 2
    },
    {
      key: "tempRise",
      label: "Temperature Rise",
      symbol: "\u0394T",
      unit: "\xB0C",
      precision: 1
    }
  ],
  calculate: calculateHeatsink,
  formula: {
    primary: "\u03B8_SA = (T_Jmax - T_A) / P_D - \u03B8_JC - \u03B8_CS",
    variables: [
      { symbol: "\u03B8_SA", description: "Heatsink-to-ambient thermal resistance", unit: "\xB0C/W" },
      { symbol: "T_Jmax", description: "Maximum junction temperature", unit: "\xB0C" },
      { symbol: "T_A", description: "Ambient temperature", unit: "\xB0C" },
      { symbol: "P_D", description: "Power dissipation", unit: "W" },
      { symbol: "\u03B8_JC", description: "Junction-to-case thermal resistance", unit: "\xB0C/W" },
      { symbol: "\u03B8_CS", description: "Case-to-heatsink thermal resistance", unit: "\xB0C/W" }
    ],
    reference: "JEDEC JESD51 thermal measurement standard"
  },
  visualization: { type: "none" },
  relatedCalculators: ["ldo-thermal", "pcb-trace-temp", "buck-converter"]
};

// src/lib/calculators/thermal/pcb-trace-temp.ts
function calculatePcbTraceTemp(inputs) {
  const { current, traceWidth, copperWeight, ambientTemp, traceLength } = inputs;
  if (current <= 0) {
    return { values: {}, errors: ["Current must be greater than 0"] };
  }
  if (traceWidth <= 0) {
    return { values: {}, errors: ["Trace width must be greater than 0"] };
  }
  const thickness = copperWeight * 0.035;
  const crossSection = traceWidth * thickness;
  const resistance_per_mm = 0.01724 / crossSection;
  const traceResistance2 = resistance_per_mm * traceLength * 1e3;
  const powerDissipated = current * current * (traceResistance2 / 1e3) * 1e3;
  const crossSection_mils2 = crossSection * 1550;
  const tempRise = Math.pow(current / (0.048 * Math.pow(crossSection_mils2, 0.725)), 1 / 0.44);
  const maxTemp = ambientTemp + tempRise;
  const currentCapacity = 0.048 * Math.pow(crossSection_mils2, 0.725) * Math.pow(10, 0.44);
  return {
    values: {
      tempRise,
      maxTemp,
      traceResistance: traceResistance2,
      powerDissipated,
      currentCapacity
    }
  };
}
var pcbTraceTemp = {
  slug: "pcb-trace-temp",
  title: "PCB Trace Temperature Rise",
  shortTitle: "Trace Temp",
  category: "thermal",
  description: "Calculate PCB copper trace temperature rise under load current using IPC-2152",
  keywords: ["PCB trace temperature", "IPC-2152", "trace heating", "copper trace", "current capacity", "thermal"],
  inputs: [
    {
      key: "current",
      label: "Current",
      symbol: "I",
      unit: "A",
      defaultValue: 3,
      min: 0,
      step: 0.1
    },
    {
      key: "traceWidth",
      label: "Trace Width",
      symbol: "W",
      unit: "mm",
      defaultValue: 2,
      min: 0.1,
      step: 0.1
    },
    {
      key: "copperWeight",
      label: "Copper Weight",
      symbol: "Cu",
      unit: "oz",
      defaultValue: 1,
      min: 0.5,
      step: 0.5,
      presets: [
        { label: "\xBD oz", values: { copperWeight: 0.5 } },
        { label: "1 oz", values: { copperWeight: 1 } },
        { label: "2 oz", values: { copperWeight: 2 } }
      ]
    },
    {
      key: "ambientTemp",
      label: "Ambient Temperature",
      symbol: "T_A",
      unit: "\xB0C",
      defaultValue: 25
    },
    {
      key: "traceLength",
      label: "Trace Length",
      symbol: "L",
      unit: "mm",
      defaultValue: 100,
      min: 1
    }
  ],
  outputs: [
    {
      key: "tempRise",
      label: "Temperature Rise",
      symbol: "\u0394T",
      unit: "\xB0C",
      precision: 1,
      thresholds: {
        good: { max: 10 },
        warning: { max: 30 },
        danger: { max: 30 }
      }
    },
    {
      key: "maxTemp",
      label: "Maximum Trace Temperature",
      symbol: "T_max",
      unit: "\xB0C",
      precision: 1,
      thresholds: {
        good: { max: 55 },
        warning: { max: 85 },
        danger: { max: 85 }
      }
    },
    {
      key: "traceResistance",
      label: "Trace Resistance",
      symbol: "R",
      unit: "m\u03A9",
      precision: 2
    },
    {
      key: "powerDissipated",
      label: "Power Dissipated",
      symbol: "P",
      unit: "mW",
      precision: 1
    },
    {
      key: "currentCapacity",
      label: "Current Capacity (\u0394T=10\xB0C)",
      symbol: "I_max",
      unit: "A",
      precision: 2
    }
  ],
  calculate: calculatePcbTraceTemp,
  formula: {
    primary: "\u0394T = (I / (k \xD7 W^b))^(1/c) \u2014 IPC-2152",
    variables: [
      { symbol: "\u0394T", description: "Temperature rise above ambient", unit: "\xB0C" },
      { symbol: "I", description: "Trace current", unit: "A" },
      { symbol: "k", description: "IPC-2221 constant (external: 0.048)", unit: "" },
      { symbol: "b", description: "IPC-2221 exponent (0.44)", unit: "" },
      { symbol: "c", description: "IPC-2221 cross-section exponent (0.725)", unit: "" }
    ],
    reference: "IPC-2152 Table 5-1 (external layers)"
  },
  visualization: { type: "none" },
  relatedCalculators: ["heatsink-calculator", "trace-width-current", "trace-resistance"]
};

// src/lib/calculators/motor/dc-motor-speed.ts
function calculateDcMotorSpeed(inputs) {
  const { voltage, resistance, backEmfConst, torqueConst, loadTorque, efficiency } = inputs;
  const noLoadSpeed = voltage / backEmfConst;
  const current = loadTorque / torqueConst;
  const backEmf = voltage - current * resistance;
  const loadSpeed = backEmf / backEmfConst;
  if (loadSpeed < 0) {
    return {
      values: {},
      errors: ["Load torque exceeds motor capability \u2014 motor stalled"]
    };
  }
  const torque = torqueConst * current;
  const mechanicalPower = torque * loadSpeed * Math.PI / 30;
  const outputPower = mechanicalPower * (efficiency / 100);
  const inputPower = voltage * current;
  const efficiencyPct = inputPower > 0 ? outputPower / inputPower * 100 : 0;
  return {
    values: {
      noLoadSpeed,
      loadSpeed,
      current,
      outputPower,
      inputPower,
      torque,
      efficiencyPct
    }
  };
}
var dcMotorSpeed = {
  slug: "dc-motor-speed",
  title: "DC Motor Speed Calculator",
  shortTitle: "DC Motor",
  category: "motor",
  description: "Calculate DC motor speed, torque, power, and efficiency from electrical parameters",
  keywords: ["DC motor", "motor speed", "RPM", "motor torque", "back EMF", "motor efficiency", "BLDC"],
  inputs: [
    {
      key: "voltage",
      label: "Supply Voltage",
      symbol: "V",
      unit: "V",
      defaultValue: 12,
      min: 0
    },
    {
      key: "resistance",
      label: "Armature Resistance",
      symbol: "R_a",
      unit: "\u03A9",
      defaultValue: 0.5,
      min: 0.01,
      tooltip: "Armature resistance"
    },
    {
      key: "backEmfConst",
      label: "Back-EMF Constant",
      symbol: "K_e",
      unit: "V/RPM",
      defaultValue: 0.01,
      min: 1e-4,
      step: 1e-3,
      tooltip: "Back-EMF constant"
    },
    {
      key: "torqueConst",
      label: "Torque Constant",
      symbol: "K_t",
      unit: "N\xB7m/A",
      defaultValue: 0.1,
      min: 1e-3,
      step: 1e-3,
      tooltip: "Torque constant"
    },
    {
      key: "loadTorque",
      label: "Load Torque",
      symbol: "T_L",
      unit: "N\xB7m",
      defaultValue: 0.1,
      min: 0,
      step: 0.01
    },
    {
      key: "efficiency",
      label: "Mechanical Efficiency",
      symbol: "\u03B7",
      unit: "%",
      defaultValue: 85,
      min: 10,
      max: 100
    }
  ],
  outputs: [
    {
      key: "noLoadSpeed",
      label: "No-Load Speed",
      symbol: "\u03C9\u2080",
      unit: "RPM",
      precision: 0
    },
    {
      key: "loadSpeed",
      label: "Speed Under Load",
      symbol: "\u03C9_L",
      unit: "RPM",
      precision: 0,
      thresholds: {
        good: { min: 0 }
      }
    },
    {
      key: "current",
      label: "Armature Current",
      symbol: "I_a",
      unit: "A",
      precision: 3
    },
    {
      key: "outputPower",
      label: "Output Power",
      symbol: "P_out",
      unit: "W",
      precision: 2
    },
    {
      key: "inputPower",
      label: "Input Power",
      symbol: "P_in",
      unit: "W",
      precision: 2
    },
    {
      key: "torque",
      label: "Torque",
      symbol: "T",
      unit: "N\xB7m",
      precision: 3
    },
    {
      key: "efficiencyPct",
      label: "Overall Efficiency",
      symbol: "\u03B7",
      unit: "%",
      precision: 1,
      thresholds: { good: { min: 70 }, warning: { min: 40 } }
    }
  ],
  calculate: calculateDcMotorSpeed,
  formula: {
    primary: "\u03C9 = (V - I_a \xD7 R_a) / K_e, T = K_t \xD7 I_a",
    variables: [
      { symbol: "\u03C9", description: "Motor speed", unit: "RPM" },
      { symbol: "V", description: "Supply voltage", unit: "V" },
      { symbol: "I_a", description: "Armature current", unit: "A" },
      { symbol: "R_a", description: "Armature resistance", unit: "\u03A9" },
      { symbol: "K_e", description: "Back-EMF constant", unit: "V/RPM" },
      { symbol: "K_t", description: "Torque constant", unit: "N\xB7m/A" }
    ],
    reference: "Chapman, Electric Machinery Fundamentals"
  },
  visualization: { type: "none" },
  relatedCalculators: ["stepper-motor", "power-factor", "buck-converter"]
};

// src/lib/calculators/motor/stepper-motor.ts
function calculateStepperMotor(inputs) {
  const { stepsPerRev, microstepping, targetRPM, leadScrewPitch } = inputs;
  const effectiveSteps = stepsPerRev * microstepping;
  const stepFrequency = targetRPM * effectiveSteps / 60;
  const linearSpeed = targetRPM * leadScrewPitch / 60;
  const stepAngle = 360 / effectiveSteps;
  return {
    values: {
      stepFrequency,
      effectiveSteps,
      linearSpeed,
      stepAngle
    }
  };
}
var stepperMotor = {
  slug: "stepper-motor",
  title: "Stepper Motor Calculator",
  shortTitle: "Stepper Motor",
  category: "motor",
  description: "Calculate stepper motor speed, step frequency, and travel per revolution",
  keywords: ["stepper motor", "steps per revolution", "step frequency", "motor speed", "microstepping", "CNC", "3D printer"],
  inputs: [
    {
      key: "stepsPerRev",
      label: "Steps per Revolution",
      symbol: "steps/rev",
      unit: "steps",
      defaultValue: 200,
      min: 4
    },
    {
      key: "microstepping",
      label: "Microstepping Divisor",
      symbol: "divisor",
      unit: "",
      defaultValue: 16,
      min: 1,
      presets: [
        { label: "Full step", values: { microstepping: 1 } },
        { label: "1/2", values: { microstepping: 2 } },
        { label: "1/8", values: { microstepping: 8 } },
        { label: "1/16", values: { microstepping: 16 } },
        { label: "1/32", values: { microstepping: 32 } }
      ]
    },
    {
      key: "targetRPM",
      label: "Target Speed",
      symbol: "RPM",
      unit: "RPM",
      defaultValue: 60,
      min: 0.1
    },
    {
      key: "leadScrewPitch",
      label: "Lead Screw Pitch",
      symbol: "pitch",
      unit: "mm/rev",
      defaultValue: 2,
      min: 0,
      tooltip: "Lead screw pitch \u2014 set to 0 for rotation only"
    }
  ],
  outputs: [
    {
      key: "stepFrequency",
      label: "Step Frequency",
      symbol: "f_step",
      unit: "Hz",
      precision: 1
    },
    {
      key: "effectiveSteps",
      label: "Effective Steps/Rev",
      symbol: "steps/rev",
      unit: "steps",
      precision: 0
    },
    {
      key: "linearSpeed",
      label: "Linear Speed",
      symbol: "v",
      unit: "mm/s",
      precision: 2
    },
    {
      key: "stepAngle",
      label: "Step Angle",
      symbol: "\u03B8_step",
      unit: "\xB0",
      precision: 4
    }
  ],
  calculate: calculateStepperMotor,
  formula: {
    primary: "f_step = (RPM \xD7 steps/rev \xD7 microstepping) / 60",
    variables: [
      { symbol: "f_step", description: "Step pulse frequency", unit: "Hz" },
      { symbol: "RPM", description: "Target motor speed", unit: "RPM" },
      { symbol: "steps/rev", description: "Full steps per revolution", unit: "steps" },
      { symbol: "microstepping", description: "Microstepping divisor", unit: "" }
    ],
    reference: "Microchip AN2164 \u2014 Stepper Motor Control"
  },
  visualization: { type: "none" },
  relatedCalculators: ["dc-motor-speed", "uart-baud-rate"]
};

// src/lib/calculators/emc/shielding-effectiveness.ts
function calculateShieldingEffectiveness(inputs) {
  const { frequency, thickness, conductivity, permeability } = inputs;
  const warnings = [];
  const f_Hz = frequency * 1e6;
  const mu0 = 4 * Math.PI * 1e-7;
  const mu = permeability * mu0;
  const sigma = conductivity * 1e6;
  const skinDepth_m = Math.sqrt(2 / (2 * Math.PI * f_Hz * mu * sigma));
  const skinDepth2 = skinDepth_m * 1e6;
  const t_m = thickness * 1e-3;
  const absorptionLoss = 8.686 * (t_m / skinDepth_m);
  const reflectionRaw = 20 * Math.log10(Math.sqrt(sigma / (2 * Math.PI * f_Hz * permeability * mu0)) / 2);
  const reflectionLoss = reflectionRaw < 0 ? 0 : reflectionRaw;
  const totalSE = absorptionLoss + reflectionLoss;
  const thicknessVsSkin = t_m / skinDepth_m;
  if (thickness < skinDepth2 * 1e-3) {
    warnings.push("Enclosure thinner than skin depth \u2014 poor HF shielding");
  }
  return {
    values: {
      absorptionLoss,
      reflectionLoss,
      totalSE,
      skinDepth: skinDepth2,
      thicknessVsSkin
    },
    warnings
  };
}
var shieldingEffectiveness = {
  slug: "shielding-effectiveness",
  title: "Shielding Effectiveness Calculator",
  shortTitle: "RF Shielding",
  category: "emc",
  description: "Calculate electromagnetic shielding effectiveness of conductive enclosures",
  keywords: ["shielding effectiveness", "EMC", "EMI shielding", "RF enclosure", "skin depth", "absorption loss", "reflection loss"],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 1e3,
      min: 1e-3
    },
    {
      key: "thickness",
      label: "Shield Thickness",
      symbol: "t",
      unit: "mm",
      defaultValue: 1,
      min: 1e-3,
      step: 0.1
    },
    {
      key: "conductivity",
      label: "Conductivity",
      symbol: "\u03C3",
      unit: "MS/m",
      defaultValue: 59.6,
      min: 1e-3,
      presets: [
        { label: "Copper", values: { conductivity: 59.6, permeability: 1 } },
        { label: "Aluminum", values: { conductivity: 35, permeability: 1 } },
        { label: "Steel", values: { conductivity: 10, permeability: 1e3 } },
        { label: "Mu-metal", values: { conductivity: 1.6, permeability: 2e4 } }
      ]
    },
    {
      key: "permeability",
      label: "Relative Permeability",
      symbol: "\u03BC_r",
      unit: "",
      defaultValue: 1,
      min: 1
    }
  ],
  outputs: [
    {
      key: "absorptionLoss",
      label: "Absorption Loss",
      symbol: "A",
      unit: "dB",
      precision: 1,
      thresholds: {
        good: { min: 20 },
        warning: { min: 6 },
        danger: { min: 6 }
      }
    },
    {
      key: "reflectionLoss",
      label: "Reflection Loss",
      symbol: "R",
      unit: "dB",
      precision: 1
    },
    {
      key: "totalSE",
      label: "Total Shielding Effectiveness",
      symbol: "SE_total",
      unit: "dB",
      precision: 1,
      thresholds: {
        good: { min: 40 },
        warning: { min: 20 },
        danger: { min: 20 }
      }
    },
    {
      key: "skinDepth",
      label: "Skin Depth",
      symbol: "\u03B4",
      unit: "\u03BCm",
      precision: 2
    },
    {
      key: "thicknessVsSkin",
      label: "Thickness / Skin Depth Ratio",
      symbol: "t/\u03B4",
      unit: "",
      precision: 2
    }
  ],
  calculate: calculateShieldingEffectiveness,
  formula: {
    primary: "SE = A + R = 8.686\xD7(t/\u03B4) + 20\xD7log\u2081\u2080(|1+\u03B7\u2080/\u03B7_s|/2)",
    variables: [
      { symbol: "SE", description: "Total shielding effectiveness", unit: "dB" },
      { symbol: "A", description: "Absorption loss", unit: "dB" },
      { symbol: "R", description: "Reflection loss", unit: "dB" },
      { symbol: "\u03B4", description: "Skin depth", unit: "m" },
      { symbol: "t", description: "Shield thickness", unit: "m" },
      { symbol: "\u03C3", description: "Conductivity", unit: "S/m" },
      { symbol: "\u03BC_r", description: "Relative permeability", unit: "" }
    ],
    reference: "MIL-STD-285, Schulz et al."
  },
  visualization: { type: "none" },
  relatedCalculators: ["skin-depth", "vswr-return-loss", "db-converter"]
};

// src/lib/calculators/general/wire-gauge.ts
function calculateWireGauge(inputs) {
  const { awg, current, length, resistivity } = inputs;
  const diameter = 0.127 * Math.pow(92, (36 - awg) / 39);
  const crossSection = Math.PI * Math.pow(diameter / 2, 2);
  const resistance = resistivity * length / crossSection;
  const voltageDrop = current * resistance;
  const currentCapacity = 2.5 * crossSection;
  return {
    values: {
      diameter,
      crossSection,
      resistance,
      voltageDrop,
      currentCapacity
    }
  };
}
var wireGauge = {
  slug: "wire-gauge",
  title: "Wire Gauge Calculator (AWG)",
  shortTitle: "Wire Gauge",
  category: "general",
  description: "Convert between AWG and mm\xB2, calculate wire current capacity, resistance, and voltage drop",
  keywords: ["AWG", "wire gauge", "wire current capacity", "wire resistance", "American Wire Gauge", "mm2 to AWG", "cable sizing"],
  inputs: [
    {
      key: "awg",
      label: "Wire Gauge",
      symbol: "AWG",
      unit: "AWG",
      defaultValue: 22,
      min: 0,
      max: 40,
      step: 1,
      presets: [
        { label: "28 AWG", values: { awg: 28 } },
        { label: "24 AWG", values: { awg: 24 } },
        { label: "22 AWG", values: { awg: 22 } },
        { label: "18 AWG", values: { awg: 18 } },
        { label: "14 AWG", values: { awg: 14 } },
        { label: "12 AWG", values: { awg: 12 } }
      ]
    },
    {
      key: "current",
      label: "Current",
      symbol: "I",
      unit: "A",
      defaultValue: 1,
      min: 0
    },
    {
      key: "length",
      label: "Wire Length",
      symbol: "L",
      unit: "m",
      defaultValue: 1,
      min: 0
    },
    {
      key: "resistivity",
      label: "Resistivity",
      symbol: "\u03C1",
      unit: "\u03A9\xB7mm\xB2/m",
      defaultValue: 0.01724,
      tooltip: "Copper = 0.01724, Aluminum = 0.0282"
    }
  ],
  outputs: [
    {
      key: "diameter",
      label: "Wire Diameter",
      symbol: "d",
      unit: "mm",
      precision: 3
    },
    {
      key: "crossSection",
      label: "Cross-Section Area",
      symbol: "A",
      unit: "mm\xB2",
      precision: 4
    },
    {
      key: "resistance",
      label: "Wire Resistance",
      symbol: "R",
      unit: "\u03A9",
      precision: 4
    },
    {
      key: "voltageDrop",
      label: "Voltage Drop",
      symbol: "V_drop",
      unit: "V",
      precision: 4
    },
    {
      key: "currentCapacity",
      label: "Current Capacity",
      symbol: "I_max",
      unit: "A",
      precision: 1
    }
  ],
  calculate: calculateWireGauge,
  formula: {
    primary: "d = 0.127 \xD7 92^((36-AWG)/39) mm, A = \u03C0(d/2)\xB2",
    variables: [
      { symbol: "d", description: "Wire diameter", unit: "mm" },
      { symbol: "AWG", description: "American Wire Gauge number", unit: "" },
      { symbol: "A", description: "Cross-sectional area", unit: "mm\xB2" },
      { symbol: "\u03C1", description: "Resistivity", unit: "\u03A9\xB7mm\xB2/m" },
      { symbol: "L", description: "Wire length", unit: "m" }
    ],
    reference: "ASTM B258 - Standard Specification for Standard Nominal Diameters"
  },
  visualization: { type: "none" },
  relatedCalculators: ["ohms-law", "pcb-trace-temp", "trace-resistance"]
};

// src/lib/calculators/general/capacitor-energy.ts
function calculateCapacitorEnergy(inputs) {
  const { capacitance, voltage, chargeTime } = inputs;
  const C_F = capacitance * 1e-6;
  const energy = 0.5 * C_F * voltage * voltage * 1e3;
  const charge = C_F * voltage * 1e3;
  const avgChargeCurrent = charge / (chargeTime * 1e-3);
  const chargePower = energy / chargeTime * 1e3;
  return {
    values: {
      energy,
      charge,
      avgChargeCurrent,
      chargePower
    }
  };
}
var capacitorEnergy = {
  slug: "capacitor-energy",
  title: "Capacitor Energy & Charge Calculator",
  shortTitle: "Capacitor Energy",
  category: "general",
  description: "Calculate energy stored, charge, and current in capacitors for power supply design",
  keywords: ["capacitor energy", "capacitor charge", "E = 1/2 CV^2", "capacitor calculator", "capacitor current", "energy storage"],
  inputs: [
    {
      key: "capacitance",
      label: "Capacitance",
      symbol: "C",
      unit: "\u03BCF",
      defaultValue: 100,
      min: 1e-3
    },
    {
      key: "voltage",
      label: "Voltage",
      symbol: "V",
      unit: "V",
      defaultValue: 12,
      min: 0
    },
    {
      key: "chargeTime",
      label: "Charge Time",
      symbol: "t",
      unit: "ms",
      defaultValue: 10,
      min: 1e-3
    }
  ],
  outputs: [
    {
      key: "energy",
      label: "Stored Energy",
      symbol: "E",
      unit: "mJ",
      precision: 3
    },
    {
      key: "charge",
      label: "Stored Charge",
      symbol: "Q",
      unit: "mC",
      precision: 3
    },
    {
      key: "avgChargeCurrent",
      label: "Average Charge Current",
      symbol: "I_avg",
      unit: "mA",
      precision: 2
    },
    {
      key: "chargePower",
      label: "Charge Power",
      symbol: "P",
      unit: "mW",
      precision: 2
    }
  ],
  calculate: calculateCapacitorEnergy,
  formula: {
    primary: "E = \xBDCV\xB2, Q = CV, I_avg = Q/t",
    variables: [
      { symbol: "E", description: "Stored energy", unit: "J" },
      { symbol: "C", description: "Capacitance", unit: "F" },
      { symbol: "V", description: "Voltage across capacitor", unit: "V" },
      { symbol: "Q", description: "Stored charge", unit: "C" },
      { symbol: "I_avg", description: "Average charge current", unit: "A" },
      { symbol: "t", description: "Charge time", unit: "s" }
    ],
    reference: "Horowitz & Hill, The Art of Electronics"
  },
  visualization: { type: "none" },
  relatedCalculators: ["rc-time-constant", "lc-resonance", "power-factor"]
};

// src/lib/calculators/power/power-factor.ts
function calculatePowerFactor(inputs) {
  const { apparentPower, powerFactor: powerFactor2, voltage, frequency, targetPF } = inputs;
  const warnings = [];
  const realPower = apparentPower * powerFactor2;
  const phi = Math.acos(powerFactor2);
  const reactivePower = apparentPower * Math.sin(phi);
  const phi_target = Math.acos(targetPF);
  const Q_target = realPower * Math.tan(phi_target);
  const Q_correction = reactivePower - Q_target;
  const correctionCapacitor = Q_correction / (2 * Math.PI * frequency * voltage * voltage) * 1e6;
  const pfAngle = phi * 180 / Math.PI;
  if (correctionCapacitor < 0) {
    warnings.push("Power factor already meets target");
  }
  return {
    values: {
      realPower,
      reactivePower,
      pfAngle,
      correctionCapacitor
    },
    warnings
  };
}
var powerFactor = {
  slug: "power-factor",
  title: "Power Factor Calculator",
  shortTitle: "Power Factor",
  category: "power",
  description: "Calculate power factor, reactive power, and correction capacitor for AC circuits",
  keywords: ["power factor", "reactive power", "apparent power", "VAR", "power factor correction", "capacitor bank", "AC power"],
  inputs: [
    {
      key: "apparentPower",
      label: "Apparent Power",
      symbol: "S",
      unit: "VA",
      defaultValue: 1e3,
      min: 0
    },
    {
      key: "powerFactor",
      label: "Power Factor",
      symbol: "PF",
      unit: "",
      defaultValue: 0.8,
      min: 0.01,
      max: 1,
      step: 0.01
    },
    {
      key: "voltage",
      label: "Supply Voltage",
      symbol: "V",
      unit: "V",
      defaultValue: 230,
      min: 1
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "Hz",
      defaultValue: 50,
      min: 1,
      presets: [
        { label: "50 Hz", values: { frequency: 50 } },
        { label: "60 Hz", values: { frequency: 60 } }
      ]
    },
    {
      key: "targetPF",
      label: "Target Power Factor",
      symbol: "PF_target",
      unit: "",
      defaultValue: 0.95,
      min: 0.5,
      max: 1,
      step: 0.01,
      tooltip: "Target power factor after correction"
    }
  ],
  outputs: [
    {
      key: "realPower",
      label: "Real Power",
      symbol: "P",
      unit: "W",
      precision: 1
    },
    {
      key: "reactivePower",
      label: "Reactive Power",
      symbol: "Q",
      unit: "VAR",
      precision: 1
    },
    {
      key: "pfAngle",
      label: "Phase Angle",
      symbol: "\u03C6",
      unit: "\xB0",
      precision: 2
    },
    {
      key: "correctionCapacitor",
      label: "Correction Capacitor",
      symbol: "C",
      unit: "\u03BCF",
      precision: 1
    }
  ],
  calculate: calculatePowerFactor,
  formula: {
    primary: "P = S \xD7 PF, Q = S \xD7 sin(\u03C6), C = (Q\u2081 - Q\u2082) / (2\u03C0f \xD7 V\xB2)",
    variables: [
      { symbol: "P", description: "Real (active) power", unit: "W" },
      { symbol: "S", description: "Apparent power", unit: "VA" },
      { symbol: "PF", description: "Power factor", unit: "" },
      { symbol: "Q", description: "Reactive power", unit: "VAR" },
      { symbol: "\u03C6", description: "Phase angle between voltage and current", unit: "\xB0" },
      { symbol: "C", description: "Correction capacitor", unit: "F" },
      { symbol: "f", description: "Supply frequency", unit: "Hz" },
      { symbol: "V", description: "Supply voltage", unit: "V" }
    ],
    reference: "IEC 60038 standard voltages"
  },
  visualization: { type: "none" },
  relatedCalculators: ["capacitor-energy", "ldo-thermal", "buck-converter"]
};

// src/lib/calculators/rf/q-factor.ts
function calculateQFactor(inputs) {
  const { componentType, value, esr, frequency } = inputs;
  const f_Hz = frequency * 1e6;
  const omega = 2 * Math.PI * f_Hz;
  let reactance;
  if (componentType === 0) {
    const L = value * 1e-6;
    reactance = omega * L;
  } else {
    const C = value * 1e-9;
    reactance = 1 / (omega * C);
  }
  const qFactor2 = reactance / esr;
  const bandwidth = frequency * 1e3 / qFactor2;
  const halfPowerFreqLow = frequency - bandwidth / 2e3;
  const halfPowerFreqHigh = frequency + bandwidth / 2e3;
  return {
    values: {
      qFactor: qFactor2,
      reactance,
      bandwidth,
      halfPowerFreqLow,
      halfPowerFreqHigh
    }
  };
}
var qFactor = {
  slug: "q-factor",
  title: "Q Factor Calculator for Inductors & Capacitors",
  shortTitle: "Q Factor",
  category: "rf",
  description: "Calculate quality factor (Q) for inductors and capacitors, resonant circuit bandwidth, and equivalent series resistance",
  keywords: [
    "Q factor",
    "quality factor",
    "inductor Q",
    "capacitor Q",
    "ESR",
    "bandwidth",
    "resonant circuit",
    "tank circuit"
  ],
  inputs: [
    {
      key: "componentType",
      label: "Component Type",
      symbol: "type",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 1,
      presets: [
        { label: "Inductor", values: { componentType: 0 } },
        { label: "Capacitor", values: { componentType: 1 } }
      ]
    },
    {
      key: "value",
      label: "Inductance / Capacitance",
      symbol: "L/C",
      unit: "\u03BCH / nF",
      defaultValue: 10,
      min: 1e-3
    },
    {
      key: "esr",
      label: "Equivalent Series Resistance",
      symbol: "ESR",
      unit: "\u03A9",
      defaultValue: 0.5,
      min: 1e-3,
      tooltip: "Equivalent Series Resistance from datasheet"
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 10,
      min: 1e-3
    }
  ],
  outputs: [
    {
      key: "qFactor",
      label: "Q Factor",
      symbol: "Q",
      unit: "",
      precision: 2,
      thresholds: {
        good: { min: 50 },
        warning: { min: 10 },
        danger: { min: 10 }
      }
    },
    {
      key: "reactance",
      label: "Reactance",
      symbol: "X",
      unit: "\u03A9",
      precision: 3
    },
    {
      key: "bandwidth",
      label: "Bandwidth",
      symbol: "BW",
      unit: "kHz",
      precision: 2
    },
    {
      key: "halfPowerFreqLow",
      label: "Lower Half-Power Frequency",
      symbol: "f\u2081",
      unit: "MHz",
      precision: 4
    },
    {
      key: "halfPowerFreqHigh",
      label: "Upper Half-Power Frequency",
      symbol: "f\u2082",
      unit: "MHz",
      precision: 4
    }
  ],
  calculate: calculateQFactor,
  formula: {
    primary: "Q = X/ESR = \u03C9L/R (inductor) or 1/(\u03C9CR) (capacitor)",
    variables: [
      { symbol: "Q", description: "Quality factor", unit: "" },
      { symbol: "X", description: "Reactance", unit: "\u03A9" },
      { symbol: "ESR", description: "Equivalent Series Resistance", unit: "\u03A9" },
      { symbol: "\u03C9", description: "Angular frequency (2\u03C0f)", unit: "rad/s" },
      { symbol: "BW", description: "Bandwidth", unit: "Hz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["lc-resonance", "vswr-return-loss", "filter-designer"]
};

// src/lib/calculators/rf/waveguide-cutoff.ts
function calculateWaveguideCutoff(inputs) {
  const { width, height, frequency, modeM, modeN } = inputs;
  if (modeM === 0 && modeN === 0) {
    return {
      values: {},
      errors: ["TEM00 mode invalid for rectangular waveguide"]
    };
  }
  const c = 3e8;
  const a = width * 1e-3;
  const b = height * 1e-3;
  const cutoffFreq_Hz = c / 2 * Math.sqrt(Math.pow(modeM / a, 2) + Math.pow(modeN / b, 2));
  const cutoffFreq = cutoffFreq_Hz / 1e9;
  const f_Hz = frequency * 1e9;
  const warnings = [];
  let guideWavelength = 0;
  let phaseVelocity = 0;
  let groupVelocity = 0;
  let betaPropagates = 0;
  if (f_Hz <= cutoffFreq_Hz) {
    warnings.push("Below cutoff \u2014 wave is evanescent, no propagation");
    betaPropagates = 0;
  } else {
    betaPropagates = 1;
    const ratio = cutoffFreq_Hz / f_Hz;
    guideWavelength = c / (f_Hz * Math.sqrt(1 - ratio * ratio)) * 1e3;
    phaseVelocity = 1 / Math.sqrt(1 - ratio * ratio);
    groupVelocity = Math.sqrt(1 - ratio * ratio);
  }
  return {
    values: {
      cutoffFreq,
      guideWavelength,
      phaseVelocity,
      groupVelocity,
      betaPropagates
    },
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
var waveguideCutoff = {
  slug: "waveguide-cutoff",
  title: "Rectangular Waveguide Cutoff Frequency Calculator",
  shortTitle: "Waveguide",
  category: "rf",
  description: "Calculate cutoff frequencies for rectangular waveguide TE and TM modes, guide wavelength, and phase velocity",
  keywords: [
    "waveguide",
    "cutoff frequency",
    "TE10 mode",
    "rectangular waveguide",
    "guide wavelength",
    "phase velocity",
    "microwave"
  ],
  inputs: [
    {
      key: "width",
      label: "Waveguide Width",
      symbol: "a",
      unit: "mm",
      defaultValue: 22.86,
      min: 0.1,
      presets: [
        { label: "WR-90 (X-band)", values: { width: 22.86, height: 10.16 } },
        { label: "WR-62 (Ku-band)", values: { width: 15.8, height: 7.9 } },
        { label: "WR-42 (K-band)", values: { width: 10.668, height: 4.318 } },
        { label: "WR-28 (Ka-band)", values: { width: 7.112, height: 3.556 } }
      ]
    },
    {
      key: "height",
      label: "Waveguide Height",
      symbol: "b",
      unit: "mm",
      defaultValue: 10.16,
      min: 0.1
    },
    {
      key: "frequency",
      label: "Operating Frequency",
      symbol: "f",
      unit: "GHz",
      defaultValue: 10,
      min: 0.1
    },
    {
      key: "modeM",
      label: "Mode Index m",
      symbol: "m",
      unit: "",
      defaultValue: 1,
      min: 0,
      max: 5,
      step: 1
    },
    {
      key: "modeN",
      label: "Mode Index n",
      symbol: "n",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 5,
      step: 1
    }
  ],
  outputs: [
    {
      key: "cutoffFreq",
      label: "Cutoff Frequency",
      symbol: "f_c",
      unit: "GHz",
      precision: 3
    },
    {
      key: "guideWavelength",
      label: "Guide Wavelength",
      symbol: "\u03BB_g",
      unit: "mm",
      precision: 3
    },
    {
      key: "phaseVelocity",
      label: "Phase Velocity",
      symbol: "v_p",
      unit: "\xD7c",
      precision: 4
    },
    {
      key: "groupVelocity",
      label: "Group Velocity",
      symbol: "v_g",
      unit: "\xD7c",
      precision: 4
    },
    {
      key: "betaPropagates",
      label: "Propagating",
      symbol: "prop",
      unit: "(1=yes)",
      precision: 0
    }
  ],
  calculate: calculateWaveguideCutoff,
  formula: {
    primary: "f_c(m,n) = (c/2)\xD7\u221A((m/a)\xB2+(n/b)\xB2)",
    variables: [
      { symbol: "f_c", description: "Cutoff frequency", unit: "Hz" },
      { symbol: "c", description: "Speed of light", unit: "m/s" },
      { symbol: "a", description: "Waveguide width", unit: "m" },
      { symbol: "b", description: "Waveguide height", unit: "m" },
      { symbol: "m,n", description: "Mode indices", unit: "" }
    ],
    reference: "Pozar, Microwave Engineering 4th Ed., Chapter 3"
  },
  visualization: { type: "none" },
  relatedCalculators: ["microstrip-impedance", "coax-impedance", "wavelength-frequency"]
};

// src/lib/calculators/general/zener-diode.ts
function calculateZenerDiode(inputs) {
  const { inputVoltage, zenerVoltage, loadCurrent, zenerCurrentMin, zenerPowerMax } = inputs;
  const errors = [];
  const warnings = [];
  if (inputVoltage <= zenerVoltage) {
    errors.push("V_in must be greater than V_Z");
    return { values: {}, errors };
  }
  const totalCurrent = loadCurrent + zenerCurrentMin;
  const seriesResistor = (inputVoltage - zenerVoltage) / (totalCurrent / 1e3);
  const zenerCurrent = zenerCurrentMin;
  const zenerPower = zenerVoltage * zenerCurrent;
  const e24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
  const multipliers = [1, 10, 100, 1e3, 1e4];
  let bestValue = e24[0] * multipliers[0];
  let bestDiff = Math.abs(seriesResistor - bestValue);
  for (const mult of multipliers) {
    for (const base of e24) {
      const candidate = base * mult;
      const diff = Math.abs(seriesResistor - candidate);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestValue = candidate;
      }
    }
  }
  const e24Resistor = bestValue;
  if (zenerPower > zenerPowerMax) {
    warnings.push("Exceeds zener power rating \u2014 use higher wattage zener");
  }
  return {
    values: {
      seriesResistor,
      zenerCurrent,
      zenerPower,
      totalCurrent,
      e24Resistor
    },
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
var zenerDiode = {
  slug: "zener-diode",
  title: "Zener Diode Voltage Regulator Calculator",
  shortTitle: "Zener Diode",
  category: "general",
  description: "Calculate series resistor, power dissipation, and load current for zener diode voltage regulators",
  keywords: [
    "zener diode",
    "voltage regulator",
    "zener voltage",
    "series resistor",
    "voltage stabilizer",
    "5.1V zener",
    "shunt regulator"
  ],
  inputs: [
    {
      key: "inputVoltage",
      label: "Input Voltage",
      symbol: "V_in",
      unit: "V",
      defaultValue: 12,
      min: 0
    },
    {
      key: "zenerVoltage",
      label: "Zener Voltage",
      symbol: "V_Z",
      unit: "V",
      defaultValue: 5.1,
      min: 0.1,
      presets: [
        { label: "3.3V", values: { zenerVoltage: 3.3 } },
        { label: "5.1V", values: { zenerVoltage: 5.1 } },
        { label: "5.6V", values: { zenerVoltage: 5.6 } },
        { label: "9.1V", values: { zenerVoltage: 9.1 } },
        { label: "12V", values: { zenerVoltage: 12 } }
      ]
    },
    {
      key: "loadCurrent",
      label: "Load Current",
      symbol: "I_L",
      unit: "mA",
      defaultValue: 20,
      min: 0
    },
    {
      key: "zenerCurrentMin",
      label: "Minimum Zener Current",
      symbol: "I_Zmin",
      unit: "mA",
      defaultValue: 5,
      min: 0.1,
      tooltip: "Minimum zener current for regulation (from datasheet)"
    },
    {
      key: "zenerPowerMax",
      label: "Max Zener Power Rating",
      symbol: "P_Zmax",
      unit: "mW",
      defaultValue: 500,
      min: 10,
      tooltip: "Maximum zener power rating"
    }
  ],
  outputs: [
    {
      key: "seriesResistor",
      label: "Series Resistor",
      symbol: "R_S",
      unit: "\u03A9",
      precision: 1
    },
    {
      key: "zenerCurrent",
      label: "Zener Current",
      symbol: "I_Z",
      unit: "mA",
      precision: 2
    },
    {
      key: "zenerPower",
      label: "Zener Power Dissipation",
      symbol: "P_Z",
      unit: "mW",
      precision: 1
    },
    {
      key: "totalCurrent",
      label: "Total Current",
      symbol: "I_total",
      unit: "mA",
      precision: 2
    },
    {
      key: "e24Resistor",
      label: "Nearest E24 Resistor",
      symbol: "E24",
      unit: "\u03A9",
      precision: 0
    }
  ],
  calculate: calculateZenerDiode,
  formula: {
    primary: "R_S = (V_in - V_Z) / (I_L + I_Zmin), P_Z = V_Z \xD7 I_Z",
    variables: [
      { symbol: "R_S", description: "Series resistor", unit: "\u03A9" },
      { symbol: "V_in", description: "Input voltage", unit: "V" },
      { symbol: "V_Z", description: "Zener voltage", unit: "V" },
      { symbol: "I_L", description: "Load current", unit: "A" },
      { symbol: "I_Zmin", description: "Minimum zener current", unit: "A" },
      { symbol: "P_Z", description: "Zener power dissipation", unit: "W" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["voltage-divider", "led-resistor", "ldo-thermal"]
};

// src/lib/calculators/general/inductor-energy.ts
function calculateInductorEnergy(inputs) {
  const { inductance, current, resistance, targetCurrent } = inputs;
  if (targetCurrent >= 100) {
    return { values: {}, errors: ["Target current must be less than 100%"] };
  }
  if (resistance <= 0) {
    return { values: {}, errors: ["Series resistance must be positive"] };
  }
  const L_H = inductance * 1e-6;
  const energy = 0.5 * L_H * current * current * 1e6;
  const timeConst = L_H / resistance * 1e6;
  const riseTime = -timeConst * Math.log(1 - targetCurrent / 100);
  const peakVoltage = current * resistance;
  const saturationCheck = inductance * current;
  return {
    values: {
      energy,
      timeConst,
      riseTime,
      peakVoltage,
      saturationCheck
    }
  };
}
var inductorEnergy = {
  slug: "inductor-energy",
  title: "Inductor Energy & Time Constant Calculator",
  shortTitle: "Inductor Energy",
  category: "general",
  description: "Calculate energy stored in an inductor, L/R time constant, and current rise time",
  keywords: [
    "inductor energy",
    "L/R time constant",
    "E = 1/2 LI^2",
    "inductor current",
    "inductor calculator",
    "energy storage",
    "flyback"
  ],
  inputs: [
    {
      key: "inductance",
      label: "Inductance",
      symbol: "L",
      unit: "\u03BCH",
      defaultValue: 100,
      min: 1e-3
    },
    {
      key: "current",
      label: "Current",
      symbol: "I",
      unit: "A",
      defaultValue: 1,
      min: 0
    },
    {
      key: "resistance",
      label: "Series Resistance",
      symbol: "R",
      unit: "\u03A9",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Series resistance (winding + external)"
    },
    {
      key: "targetCurrent",
      label: "Target Current",
      symbol: "I_target",
      unit: "%",
      defaultValue: 63.2,
      min: 1,
      max: 99,
      tooltip: "Target current as % of final value"
    }
  ],
  outputs: [
    {
      key: "energy",
      label: "Stored Energy",
      symbol: "E",
      unit: "\u03BCJ",
      precision: 3
    },
    {
      key: "timeConst",
      label: "Time Constant",
      symbol: "\u03C4",
      unit: "\u03BCs",
      precision: 3
    },
    {
      key: "riseTime",
      label: "Rise Time to Target",
      symbol: "t_rise",
      unit: "\u03BCs",
      precision: 3
    },
    {
      key: "peakVoltage",
      label: "Initial Back-EMF",
      symbol: "V_L",
      unit: "V",
      precision: 2
    },
    {
      key: "saturationCheck",
      label: "Saturation Check (I \xD7 L)",
      symbol: "I\xD7L",
      unit: "\u03BCH\xB7A",
      precision: 2
    }
  ],
  calculate: calculateInductorEnergy,
  formula: {
    primary: "E = \xBDLI\xB2, \u03C4 = L/R, i(t) = I_final \xD7 (1 - e^(-t/\u03C4))",
    variables: [
      { symbol: "E", description: "Stored energy", unit: "J" },
      { symbol: "L", description: "Inductance", unit: "H" },
      { symbol: "I", description: "Current", unit: "A" },
      { symbol: "\u03C4", description: "Time constant L/R", unit: "s" },
      { symbol: "R", description: "Series resistance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["lc-resonance", "rc-time-constant", "buck-converter"]
};

// src/lib/calculators/power/boost-converter.ts
function calculateBoostConverter(inputs) {
  const { inputVoltage, outputVoltage, outputCurrent, switchFreq, ripplePct, efficiency } = inputs;
  const errors = [];
  const warnings = [];
  const eta = efficiency / 100;
  const dutyCycle_raw = 1 - inputVoltage / (outputVoltage * eta);
  if (dutyCycle_raw <= 0) {
    errors.push("Output voltage must be greater than input voltage");
    return { values: {}, errors };
  }
  if (dutyCycle_raw >= 0.95) {
    warnings.push("Duty cycle >95% \u2014 not practical, consider different topology");
  }
  const dutyCycle = dutyCycle_raw * 100;
  const inputCurrent = outputCurrent * outputVoltage / (inputVoltage * eta);
  const inductorCurrent = inputCurrent;
  const deltaIL = inductorCurrent * (ripplePct / 100);
  const inductorValue = inputVoltage * dutyCycle_raw / (deltaIL * switchFreq * 1e3) * 1e6;
  const outputCapacitor = outputCurrent * dutyCycle_raw / (0.05 * outputVoltage * switchFreq * 1e3) * 1e6;
  const peakCurrent = inductorCurrent + deltaIL / 2;
  return {
    values: {
      dutyCycle,
      inductorCurrent,
      inductorValue,
      outputCapacitor,
      peakCurrent
    },
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
var boostConverter = {
  slug: "boost-converter",
  title: "Boost Converter Design Calculator",
  shortTitle: "Boost Converter",
  category: "power",
  description: "Calculate duty cycle, inductor value, and output capacitor for boost (step-up) DC-DC converter design",
  keywords: [
    "boost converter",
    "step-up converter",
    "duty cycle",
    "inductor selection",
    "output capacitor",
    "SMPS",
    "DC-DC"
  ],
  inputs: [
    {
      key: "inputVoltage",
      label: "Input Voltage",
      symbol: "V_in",
      unit: "V",
      defaultValue: 5,
      min: 0.5
    },
    {
      key: "outputVoltage",
      label: "Output Voltage",
      symbol: "V_out",
      unit: "V",
      defaultValue: 12,
      min: 1
    },
    {
      key: "outputCurrent",
      label: "Output Current",
      symbol: "I_out",
      unit: "A",
      defaultValue: 0.5,
      min: 0.01,
      step: 0.1
    },
    {
      key: "switchFreq",
      label: "Switching Frequency",
      symbol: "f_sw",
      unit: "kHz",
      defaultValue: 100,
      min: 1
    },
    {
      key: "ripplePct",
      label: "Inductor Current Ripple",
      symbol: "\u0394I_L",
      unit: "%",
      defaultValue: 30,
      min: 5,
      max: 80,
      tooltip: "Inductor current ripple as % of average inductor current"
    },
    {
      key: "efficiency",
      label: "Estimated Efficiency",
      symbol: "\u03B7",
      unit: "%",
      defaultValue: 88,
      min: 50,
      max: 99
    }
  ],
  outputs: [
    {
      key: "dutyCycle",
      label: "Duty Cycle",
      symbol: "D",
      unit: "%",
      precision: 2,
      thresholds: {
        good: { min: 10, max: 90 },
        danger: { max: 95 }
      }
    },
    {
      key: "inductorCurrent",
      label: "Average Inductor Current",
      symbol: "I_L",
      unit: "A",
      precision: 3
    },
    {
      key: "inductorValue",
      label: "Inductor Value",
      symbol: "L",
      unit: "\u03BCH",
      precision: 2
    },
    {
      key: "outputCapacitor",
      label: "Output Capacitor",
      symbol: "C_out",
      unit: "\u03BCF",
      precision: 1
    },
    {
      key: "peakCurrent",
      label: "Peak Inductor Current",
      symbol: "I_peak",
      unit: "A",
      precision: 3
    }
  ],
  calculate: calculateBoostConverter,
  formula: {
    primary: "D = 1 - V_in/(V_out\xD7\u03B7), L = V_in\xD7D/(\u0394I_L\xD7f_sw)",
    variables: [
      { symbol: "D", description: "Duty cycle", unit: "" },
      { symbol: "V_in", description: "Input voltage", unit: "V" },
      { symbol: "V_out", description: "Output voltage", unit: "V" },
      { symbol: "\u03B7", description: "Efficiency", unit: "" },
      { symbol: "f_sw", description: "Switching frequency", unit: "Hz" },
      { symbol: "\u0394I_L", description: "Inductor current ripple", unit: "A" }
    ],
    reference: 'Erickson & Maksimovic, "Fundamentals of Power Electronics" 3rd ed.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["buck-converter", "ldo-thermal", "voltage-divider"]
};

// src/lib/calculators/power/three-phase-power.ts
function calculateThreePhasePower(inputs) {
  const { connectionType, lineVoltage, current, powerFactor: powerFactor2 } = inputs;
  const phaseVoltage = connectionType === 0 ? lineVoltage / Math.sqrt(3) : lineVoltage;
  const apparentPower = Math.sqrt(3) * lineVoltage * current / 1e3;
  const realPower = apparentPower * powerFactor2;
  const pfAngle = Math.acos(powerFactor2) * (180 / Math.PI);
  const reactivePower = apparentPower * Math.sin(pfAngle * Math.PI / 180);
  return {
    values: {
      phaseVoltage,
      realPower,
      reactivePower,
      apparentPower,
      pfAngle
    }
  };
}
var threePhasePower = {
  slug: "three-phase-power",
  title: "Three-Phase Power Calculator",
  shortTitle: "3-Phase Power",
  category: "power",
  description: "Calculate three-phase real power, reactive power, apparent power, current, and power factor from line or phase values",
  keywords: [
    "three phase power",
    "3 phase",
    "line voltage",
    "phase voltage",
    "kVA",
    "kW",
    "kVAR",
    "motor power",
    "industrial power"
  ],
  inputs: [
    {
      key: "connectionType",
      label: "Connection Type",
      symbol: "type",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 1,
      presets: [
        { label: "Wye (Star)", values: { connectionType: 0 } },
        { label: "Delta", values: { connectionType: 1 } }
      ]
    },
    {
      key: "lineVoltage",
      label: "Line Voltage",
      symbol: "V_L",
      unit: "V",
      defaultValue: 400,
      min: 1
    },
    {
      key: "current",
      label: "Line Current",
      symbol: "I",
      unit: "A",
      defaultValue: 10,
      min: 0
    },
    {
      key: "powerFactor",
      label: "Power Factor",
      symbol: "PF",
      unit: "",
      defaultValue: 0.85,
      min: 0.01,
      max: 1,
      step: 0.01
    }
  ],
  outputs: [
    {
      key: "phaseVoltage",
      label: "Phase Voltage",
      symbol: "V_ph",
      unit: "V",
      precision: 2
    },
    {
      key: "realPower",
      label: "Real Power",
      symbol: "P",
      unit: "kW",
      precision: 3
    },
    {
      key: "reactivePower",
      label: "Reactive Power",
      symbol: "Q",
      unit: "kVAR",
      precision: 3
    },
    {
      key: "apparentPower",
      label: "Apparent Power",
      symbol: "S",
      unit: "kVA",
      precision: 3
    },
    {
      key: "pfAngle",
      label: "Power Factor Angle",
      symbol: "\u03C6",
      unit: "\xB0",
      precision: 2
    }
  ],
  calculate: calculateThreePhasePower,
  formula: {
    primary: "P = \u221A3 \xD7 V_L \xD7 I \xD7 PF, S = \u221A3 \xD7 V_L \xD7 I",
    variables: [
      { symbol: "P", description: "Real power", unit: "W" },
      { symbol: "S", description: "Apparent power", unit: "VA" },
      { symbol: "Q", description: "Reactive power", unit: "VAR" },
      { symbol: "V_L", description: "Line voltage", unit: "V" },
      { symbol: "I", description: "Line current", unit: "A" },
      { symbol: "PF", description: "Power factor", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["power-factor", "voltage-divider", "dc-motor-speed"]
};

// src/lib/calculators/antenna/antenna-beamwidth.ts
function calculateAntennaBeamwidth(inputs) {
  const { gain, frequency, apertureDiameter, apertureEfficiency } = inputs;
  const lambda = 3e8 / (frequency * 1e9);
  const G_linear = Math.pow(10, gain / 10);
  const beamwidthHPBW = 70 * lambda / apertureDiameter;
  const beamwidthNulls = 140 * lambda / apertureDiameter;
  const effectiveArea = G_linear * lambda * lambda / (4 * Math.PI);
  const gainFromAperture = 10 * Math.log10(
    apertureEfficiency / 100 * Math.pow(Math.PI * apertureDiameter / lambda, 2)
  );
  const wavelength = lambda * 1e3;
  return {
    values: {
      beamwidthHPBW,
      beamwidthNulls,
      effectiveArea,
      wavelength,
      gainFromAperture
    }
  };
}
var antennaBeamwidth = {
  slug: "antenna-beamwidth",
  title: "Antenna Beamwidth & Gain Calculator",
  shortTitle: "Beamwidth",
  category: "antenna",
  description: "Calculate antenna 3dB beamwidth from gain, aperture efficiency, and frequency for aperture antennas",
  keywords: [
    "antenna beamwidth",
    "3dB beamwidth",
    "antenna gain",
    "aperture antenna",
    "half-power beamwidth",
    "HPBW",
    "directivity"
  ],
  inputs: [
    {
      key: "gain",
      label: "Antenna Gain",
      symbol: "G",
      unit: "dBi",
      defaultValue: 20,
      min: 0
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "GHz",
      defaultValue: 10,
      min: 0.1
    },
    {
      key: "apertureDiameter",
      label: "Aperture Diameter",
      symbol: "D",
      unit: "m",
      defaultValue: 0.3,
      min: 1e-3,
      step: 0.01,
      tooltip: "Physical aperture diameter (for dish/horn antennas)"
    },
    {
      key: "apertureEfficiency",
      label: "Aperture Efficiency",
      symbol: "\u03B7_a",
      unit: "%",
      defaultValue: 55,
      min: 10,
      max: 100,
      tooltip: "Typical: 55-65% for parabolic dish"
    }
  ],
  outputs: [
    {
      key: "beamwidthHPBW",
      label: "3 dB Beamwidth",
      symbol: "\u03B8_3dB",
      unit: "\xB0",
      precision: 2
    },
    {
      key: "beamwidthNulls",
      label: "First Null Beamwidth",
      symbol: "\u03B8_null",
      unit: "\xB0",
      precision: 2
    },
    {
      key: "effectiveArea",
      label: "Effective Aperture Area",
      symbol: "A_eff",
      unit: "m\xB2",
      precision: 4
    },
    {
      key: "wavelength",
      label: "Wavelength",
      symbol: "\u03BB",
      unit: "mm",
      precision: 2
    },
    {
      key: "gainFromAperture",
      label: "Gain from Aperture",
      symbol: "G_aperture",
      unit: "dBi",
      precision: 2
    }
  ],
  calculate: calculateAntennaBeamwidth,
  formula: {
    primary: "\u03B8_3dB \u2248 70\u03BB/D (degrees), G = \u03B7_a \xD7 (\u03C0D/\u03BB)\xB2",
    variables: [
      { symbol: "\u03B8_3dB", description: "3 dB half-power beamwidth", unit: "\xB0" },
      { symbol: "\u03BB", description: "Wavelength", unit: "m" },
      { symbol: "D", description: "Aperture diameter", unit: "m" },
      { symbol: "\u03B7_a", description: "Aperture efficiency", unit: "" },
      { symbol: "G", description: "Gain", unit: "dBi" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["eirp-calculator", "dipole-antenna", "patch-antenna"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" }
  ]
};

// src/lib/calculators/signal/snr-calculator.ts
function calculateSNR(inputs) {
  const { bandwidth, noiseFigure, signalPower, temperature } = inputs;
  const k = 138e-25;
  const bw_Hz = bandwidth * 1e6;
  const thermalNoise = 10 * Math.log10(k * temperature * bw_Hz) + 30;
  const noiseFloor = thermalNoise + noiseFigure;
  const snr = signalPower - noiseFloor;
  const sensitivity = noiseFloor + 10;
  const dynamicRange = Math.abs(signalPower - noiseFloor);
  const warnings = [];
  if (snr < 3) {
    warnings.push("SNR below 3 dB \u2014 signal barely above noise, demodulation unreliable");
  }
  return {
    values: {
      noiseFloor,
      snr,
      sensitivity,
      dynamicRange,
      thermalNoise
    },
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
var snrCalculator = {
  slug: "snr-calculator",
  title: "Signal-to-Noise Ratio (SNR) Calculator",
  shortTitle: "SNR",
  category: "signal",
  description: "Calculate SNR, noise floor, sensitivity, and dynamic range for RF receivers and signal chains",
  keywords: [
    "SNR",
    "signal to noise ratio",
    "noise floor",
    "receiver sensitivity",
    "dynamic range",
    "noise figure",
    "kTB"
  ],
  inputs: [
    {
      key: "bandwidth",
      label: "Bandwidth",
      symbol: "BW",
      unit: "MHz",
      defaultValue: 1,
      min: 1e-3
    },
    {
      key: "noiseFigure",
      label: "Noise Figure",
      symbol: "NF",
      unit: "dB",
      defaultValue: 6,
      min: 0
    },
    {
      key: "signalPower",
      label: "Signal Power",
      symbol: "P_signal",
      unit: "dBm",
      defaultValue: -60,
      min: -160,
      max: 30
    },
    {
      key: "temperature",
      label: "Temperature",
      symbol: "T",
      unit: "K",
      defaultValue: 290,
      min: 1
    }
  ],
  outputs: [
    {
      key: "snr",
      label: "Signal-to-Noise Ratio",
      symbol: "SNR",
      unit: "dB",
      precision: 2,
      thresholds: {
        good: { min: 20 },
        warning: { min: 10 },
        danger: { min: 10 }
      }
    },
    {
      key: "noiseFloor",
      label: "Noise Floor",
      symbol: "N_floor",
      unit: "dBm",
      precision: 2
    },
    {
      key: "sensitivity",
      label: "Receiver Sensitivity",
      symbol: "sens",
      unit: "dBm",
      precision: 2
    },
    {
      key: "dynamicRange",
      label: "Dynamic Range",
      symbol: "DR",
      unit: "dB",
      precision: 1
    },
    {
      key: "thermalNoise",
      label: "Thermal Noise (kTB)",
      symbol: "kTB",
      unit: "dBm",
      precision: 2
    }
  ],
  calculate: calculateSNR,
  formula: {
    primary: "N_floor = kTB + NF, SNR = P_signal - N_floor",
    variables: [
      { symbol: "k", description: "Boltzmann constant", unit: "J/K" },
      { symbol: "T", description: "Temperature", unit: "K" },
      { symbol: "B", description: "Bandwidth", unit: "Hz" },
      { symbol: "NF", description: "Noise figure", unit: "dB" },
      { symbol: "SNR", description: "Signal-to-noise ratio", unit: "dB" }
    ],
    reference: "Friis, 'Noise Figures of Radio Receivers', Proc. IRE, 1944"
  },
  visualization: { type: "none" },
  relatedCalculators: ["noise-figure-cascade", "rf-link-budget", "filter-designer"]
};

// src/lib/calculators/pcb/controlled-impedance.ts
function calculateControlledImpedance(inputs) {
  const {
    traceType,
    traceWidth,
    substrateHeight,
    dielectricConst,
    copperThickness,
    coverHeight
  } = inputs;
  const warnings = [];
  const t_mm = copperThickness / 1e3;
  function computeZ0(W) {
    if (traceType === 0) {
      const u = W / substrateHeight;
      const f = 6 + (2 * Math.PI - 6) * Math.exp(-Math.pow(30.666 / u, 0.7528));
      const er = (dielectricConst + 1) / 2 + (dielectricConst - 1) / 2 * Math.pow(1 + 12 / u, -0.5);
      const z2 = 60 / Math.sqrt(er) * Math.log(f / u + Math.sqrt(1 + 4 / (u * u)));
      return { Z0: z2, erEff: er };
    } else if (traceType === 1) {
      const er = dielectricConst * (1 - Math.exp(-1.55 * coverHeight / substrateHeight));
      const arg = 5.98 * substrateHeight / (0.8 * W + t_mm);
      if (arg <= 1) return { Z0: 0, erEff: er };
      const Z0_air = 60 * Math.log(arg);
      return { Z0: Z0_air / Math.sqrt(er), erEff: er };
    } else {
      const b = 2 * substrateHeight;
      const arg = 4 * b / (0.67 * Math.PI * (0.8 * W + t_mm));
      if (arg <= 1) return { Z0: 0, erEff: dielectricConst };
      const z2 = 60 / Math.sqrt(dielectricConst) * Math.log(arg);
      return { Z0: z2, erEff: dielectricConst };
    }
  }
  const { Z0: impedance, erEff: effectiveDielectric } = computeZ0(traceWidth);
  const propagationDelay = Math.sqrt(effectiveDielectric) / 0.3;
  let lo = 0.01, hi = 20;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const { Z0: z_mid } = computeZ0(mid);
    if (z_mid > 50) lo = mid;
    else hi = mid;
  }
  const traceWidthFor50 = (lo + hi) / 2;
  if (Math.abs(impedance - 50) > 15) {
    warnings.push("Large deviation from 50\u03A9 \u2014 adjust trace width");
  }
  return {
    values: {
      impedance,
      effectiveDielectric,
      propagationDelay,
      traceWidthFor50
    },
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
var controlledImpedance = {
  slug: "controlled-impedance",
  title: "PCB Controlled Impedance Calculator",
  shortTitle: "Controlled Z",
  category: "pcb",
  description: "Calculate characteristic impedance for surface microstrip, embedded microstrip, and stripline PCB traces",
  keywords: [
    "controlled impedance",
    "microstrip impedance",
    "stripline impedance",
    "PCB impedance",
    "signal integrity",
    "50 ohm trace"
  ],
  inputs: [
    {
      key: "traceType",
      label: "Trace Type",
      symbol: "type",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 2,
      step: 1,
      presets: [
        { label: "Surface Microstrip", values: { traceType: 0 } },
        { label: "Embedded Microstrip", values: { traceType: 1 } },
        { label: "Stripline", values: { traceType: 2 } }
      ]
    },
    {
      key: "traceWidth",
      label: "Trace Width",
      symbol: "W",
      unit: "mm",
      defaultValue: 1.8,
      min: 0.05,
      step: 0.05
    },
    {
      key: "substrateHeight",
      label: "Substrate Height",
      symbol: "h",
      unit: "mm",
      defaultValue: 0.2,
      min: 0.01,
      step: 0.01
    },
    {
      key: "dielectricConst",
      label: "Dielectric Constant",
      symbol: "\u03B5r",
      unit: "",
      defaultValue: 4.4,
      min: 1,
      presets: [
        { label: "FR4 (4.4)", values: { dielectricConst: 4.4 } },
        { label: "Rogers RO4003 (3.55)", values: { dielectricConst: 3.55 } },
        { label: "Rogers RO4350 (3.66)", values: { dielectricConst: 3.66 } },
        { label: "PTFE (2.1)", values: { dielectricConst: 2.1 } }
      ]
    },
    {
      key: "copperThickness",
      label: "Copper Thickness",
      symbol: "t",
      unit: "\u03BCm",
      defaultValue: 35,
      min: 5
    },
    {
      key: "coverHeight",
      label: "Cover Layer Height",
      symbol: "h2",
      unit: "mm",
      defaultValue: 0.1,
      min: 0.01,
      tooltip: "Cover layer height (for embedded microstrip only)"
    }
  ],
  outputs: [
    {
      key: "impedance",
      label: "Characteristic Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      precision: 2,
      thresholds: {
        good: { min: 45, max: 55 },
        warning: { min: 40, max: 60 },
        danger: { max: 40 }
      }
    },
    {
      key: "effectiveDielectric",
      label: "Effective Dielectric Constant",
      symbol: "\u03B5r_eff",
      unit: "",
      precision: 3
    },
    {
      key: "propagationDelay",
      label: "Propagation Delay",
      symbol: "t_pd",
      unit: "ps/mm",
      precision: 2
    },
    {
      key: "traceWidthFor50",
      label: "Trace Width for 50\u03A9",
      symbol: "W_50\u03A9",
      unit: "mm",
      precision: 3
    }
  ],
  calculate: calculateControlledImpedance,
  formula: {
    primary: "Surface: Z\u2080 = (87/\u221A(\u03B5r+1.41)) \xD7 ln(5.98h/(0.8W+t))",
    variables: [
      { symbol: "Z\u2080", description: "Characteristic impedance", unit: "\u03A9" },
      { symbol: "\u03B5r", description: "Dielectric constant", unit: "" },
      { symbol: "W", description: "Trace width", unit: "m" },
      { symbol: "h", description: "Substrate height", unit: "m" },
      { symbol: "t", description: "Copper thickness", unit: "m" }
    ],
    reference: "IPC-2141 Controlled Impedance Circuit Boards"
  },
  visualization: { type: "none" },
  relatedCalculators: ["microstrip-impedance", "differential-pair", "trace-resistance"]
};

// src/lib/calculators/emc/ferrite-bead.ts
function calculateFerriteBead(inputs) {
  const { impedance100MHz, dcResistance, loadImpedance, frequency } = inputs;
  const beadImpedance = impedance100MHz * Math.pow(frequency / 100, 0.5);
  const insertionLoss = 20 * Math.log10(1 + beadImpedance / loadImpedance);
  const voltageDivider2 = loadImpedance / (loadImpedance + beadImpedance) * 100;
  const dcVoltageDrop = dcResistance * 1e3;
  const warnings = [];
  if (dcVoltageDrop > 100) {
    warnings.push("High DC resistance \u2014 check voltage budget for load");
  }
  return {
    values: {
      beadImpedance,
      insertionLoss,
      voltageDivider: voltageDivider2,
      dcVoltageDrop
    },
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
var ferriteBead = {
  slug: "ferrite-bead",
  title: "Ferrite Bead Filter Calculator",
  shortTitle: "Ferrite Bead",
  category: "emc",
  description: "Calculate ferrite bead filter effectiveness, impedance at frequency, and insertion loss for EMI suppression",
  keywords: [
    "ferrite bead",
    "EMI filter",
    "ferrite impedance",
    "common mode choke",
    "EMC",
    "power line filter",
    "Murata BLM"
  ],
  inputs: [
    {
      key: "impedance100MHz",
      label: "Impedance at 100 MHz",
      symbol: "Z_100",
      unit: "\u03A9",
      defaultValue: 600,
      min: 1,
      tooltip: "Ferrite bead impedance at 100 MHz from datasheet (e.g. 600\u03A9 for Murata BLM18PG601SN1)",
      presets: [
        { label: "100\u03A9 (BLM03)", values: { impedance100MHz: 100 } },
        { label: "300\u03A9 (BLM18)", values: { impedance100MHz: 300 } },
        { label: "600\u03A9 (BLM18PG601)", values: { impedance100MHz: 600 } },
        { label: "1k\u03A9 (BLM31)", values: { impedance100MHz: 1e3 } }
      ]
    },
    {
      key: "dcResistance",
      label: "DC Resistance",
      symbol: "R_DC",
      unit: "\u03A9",
      defaultValue: 0.3,
      min: 1e-3,
      tooltip: "DC resistance from datasheet"
    },
    {
      key: "loadImpedance",
      label: "Load Impedance",
      symbol: "R_L",
      unit: "\u03A9",
      defaultValue: 50,
      min: 1
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 100,
      min: 0.1
    }
  ],
  outputs: [
    {
      key: "beadImpedance",
      label: "Bead Impedance at f",
      symbol: "Z_bead",
      unit: "\u03A9",
      precision: 1
    },
    {
      key: "insertionLoss",
      label: "Insertion Loss",
      symbol: "IL",
      unit: "dB",
      precision: 2
    },
    {
      key: "voltageDivider",
      label: "Voltage Ratio",
      symbol: "V_ratio",
      unit: "%",
      precision: 1
    },
    {
      key: "dcVoltageDrop",
      label: "DC Voltage Drop",
      symbol: "V_DC",
      unit: "mV/A",
      precision: 1
    }
  ],
  calculate: calculateFerriteBead,
  formula: {
    primary: "IL = 20\xD7log\u2081\u2080(1 + Z_bead/R_L), Z_bead \u2248 Z_100MHz \xD7 (f/100MHz)^0.5",
    variables: [
      { symbol: "IL", description: "Insertion loss", unit: "dB" },
      { symbol: "Z_bead", description: "Bead impedance at frequency", unit: "\u03A9" },
      { symbol: "R_L", description: "Load impedance", unit: "\u03A9" },
      { symbol: "Z_100", description: "Bead impedance at 100 MHz", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["shielding-effectiveness", "filter-designer", "microstrip-impedance"]
};

// src/lib/calculators/rf/free-space-path-loss.ts
function calculateFreeSpacePathLoss(inputs) {
  const { frequency, distance } = inputs;
  const f_Hz = frequency * 1e6;
  const d_m = distance * 1e3;
  const c = 3e8;
  const fspl_linear = Math.pow(4 * Math.PI * d_m * f_Hz / c, 2);
  const fspl_dB = 20 * Math.log10(4 * Math.PI * Math.max(d_m, 1e-3) * Math.max(f_Hz, 1) / c);
  return {
    values: {
      fspl_dB,
      fspl_linear
    }
  };
}
var freeSpacePathLoss = {
  slug: "free-space-path-loss",
  title: "Free-Space Path Loss Calculator",
  shortTitle: "Free-Space Path Loss",
  category: "rf",
  description: "Calculate free-space path loss (FSPL) using the Friis transmission equation for wireless link budget analysis",
  keywords: [
    "free space path loss",
    "Friis",
    "FSPL",
    "RF propagation",
    "wireless link",
    "path loss",
    "link budget",
    "propagation loss"
  ],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 2400,
      min: 0.1,
      tooltip: "Signal frequency in MHz",
      presets: [
        { label: "433 MHz", values: { frequency: 433 } },
        { label: "915 MHz", values: { frequency: 915 } },
        { label: "2.4 GHz", values: { frequency: 2400 } },
        { label: "5.8 GHz", values: { frequency: 5800 } }
      ]
    },
    {
      key: "distance",
      label: "Distance",
      symbol: "d",
      unit: "km",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Distance between transmitter and receiver in km"
    }
  ],
  outputs: [
    {
      key: "fspl_dB",
      label: "Free-Space Path Loss",
      symbol: "FSPL",
      unit: "dB",
      precision: 2,
      thresholds: {
        good: { max: 80 },
        warning: { min: 80, max: 120 },
        danger: { max: 120 }
      }
    },
    {
      key: "fspl_linear",
      label: "FSPL (linear ratio)",
      symbol: "FSPL",
      unit: "",
      precision: 3,
      format: "scientific"
    }
  ],
  calculate: calculateFreeSpacePathLoss,
  formula: {
    primary: "FSPL(dB) = 20\xB7log\u2081\u2080(4\u03C0df/c)",
    variables: [
      { symbol: "FSPL", description: "Free-space path loss", unit: "dB" },
      { symbol: "d", description: "Distance between antennas", unit: "m" },
      { symbol: "f", description: "Signal frequency", unit: "Hz" },
      { symbol: "c", description: "Speed of light (3\xD710\u2078)", unit: "m/s" },
      { symbol: "\u03BB", description: "Wavelength (c/f)", unit: "m" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["rf-link-budget", "eirp-calculator", "wavelength-frequency"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ]
};

// src/lib/calculators/rf/radar-range-equation.ts
function calculateRadarRangeEquation(inputs) {
  const { peakPower, gain, frequency, rcs, noiseFigure, bandwidth } = inputs;
  const Pt = peakPower * 1e3;
  const G_linear = Math.pow(10, gain / 10);
  const f_Hz = frequency * 1e9;
  const c = 3e8;
  const lambda = c / f_Hz;
  const sigma = rcs;
  const F_linear = Math.pow(10, noiseFigure / 10);
  const B_Hz = bandwidth * 1e6;
  const k = 138e-25;
  const T = 290;
  const Pmin = k * T * B_Hz * F_linear;
  const numerator = Pt * G_linear * G_linear * lambda * lambda * sigma;
  const denominator = Math.pow(4 * Math.PI, 3) * Pmin;
  const R_m = Math.pow(Math.max(numerator / denominator, 0), 0.25);
  const maxRange = R_m / 1e3;
  const R_ref = 1e3;
  const Pr_W = Pt * G_linear * G_linear * lambda * lambda * sigma / (Math.pow(4 * Math.PI, 3) * Math.pow(R_ref, 4));
  const receivedPower = 10 * Math.log10(Pr_W * 1e3);
  const snrAtMaxRange = 0;
  return {
    values: {
      maxRange,
      snrAtMaxRange,
      receivedPower
    }
  };
}
var radarRangeEquation = {
  slug: "radar-range-equation",
  title: "Radar Range Equation Calculator",
  shortTitle: "Radar Range",
  category: "rf",
  description: "Calculate maximum radar detection range using the radar range equation, including RCS, antenna gain, noise figure, and bandwidth parameters",
  keywords: [
    "radar range equation",
    "radar cross section",
    "RCS",
    "radar SNR",
    "maximum range",
    "radar sensitivity",
    "target detection"
  ],
  inputs: [
    {
      key: "peakPower",
      label: "Peak Transmit Power",
      symbol: "Pt",
      unit: "kW",
      defaultValue: 100,
      min: 1e-3,
      tooltip: "Peak transmitter output power in kilowatts"
    },
    {
      key: "gain",
      label: "Antenna Gain",
      symbol: "G",
      unit: "dBi",
      defaultValue: 30,
      min: 0,
      tooltip: "Transmit/receive antenna gain (same antenna assumed)"
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "GHz",
      defaultValue: 3,
      min: 0.1,
      presets: [
        { label: "L-band (1.3 GHz)", values: { frequency: 1.3 } },
        { label: "S-band (3 GHz)", values: { frequency: 3 } },
        { label: "X-band (10 GHz)", values: { frequency: 10 } }
      ]
    },
    {
      key: "rcs",
      label: "Radar Cross Section (RCS)",
      symbol: "\u03C3",
      unit: "m\xB2",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Target radar cross section in square meters"
    },
    {
      key: "noiseFigure",
      label: "Receiver Noise Figure",
      symbol: "NF",
      unit: "dB",
      defaultValue: 6,
      min: 0,
      tooltip: "Receiver noise figure in dB"
    },
    {
      key: "bandwidth",
      label: "Receiver Bandwidth",
      symbol: "B",
      unit: "MHz",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Receiver noise bandwidth in MHz"
    }
  ],
  outputs: [
    {
      key: "maxRange",
      label: "Maximum Detection Range",
      symbol: "R_max",
      unit: "km",
      precision: 2
    },
    {
      key: "snrAtMaxRange",
      label: "SNR at Max Range",
      symbol: "SNR",
      unit: "dB",
      precision: 1,
      tooltip: "SNR equals 0 dB (unity) at maximum detection range by definition"
    },
    {
      key: "receivedPower",
      label: "Received Power at 1 km",
      symbol: "Pr",
      unit: "dBm",
      precision: 1
    }
  ],
  calculate: calculateRadarRangeEquation,
  formula: {
    primary: "R_max = (Pt\xB7G\xB2\xB7\u03BB\xB2\xB7\u03C3 / ((4\u03C0)\xB3\xB7Pmin))^(1/4)",
    variables: [
      { symbol: "R_max", description: "Maximum detection range", unit: "m" },
      { symbol: "Pt", description: "Peak transmit power", unit: "W" },
      { symbol: "G", description: "Antenna gain (linear)", unit: "" },
      { symbol: "\u03BB", description: "Wavelength", unit: "m" },
      { symbol: "\u03C3", description: "Radar cross section", unit: "m\xB2" },
      { symbol: "Pmin", description: "Minimum detectable signal (kTBF)", unit: "W" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["rf-link-budget", "noise-figure-cascade", "eirp-calculator"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" }
  ]
};

// src/lib/calculators/rf/power-amplifier-efficiency.ts
function calculatePowerAmplifierEfficiency(inputs) {
  const { outputPower, inputPower, dcVoltage, dcCurrent } = inputs;
  const Pout_mW = Math.pow(10, outputPower / 10);
  const Pin_mW = Math.pow(10, inputPower / 10);
  const dcPower = dcVoltage * dcCurrent;
  const gain = outputPower - inputPower;
  const pae = (Pout_mW - Pin_mW) / Math.max(dcPower, 1e-3) * 100;
  const drainEfficiency = Pout_mW / Math.max(dcPower, 1e-3) * 100;
  const dissipatedPower = Math.max(dcPower - Pout_mW, 0);
  return {
    values: {
      gain,
      dcPower,
      pae,
      drainEfficiency,
      dissipatedPower
    }
  };
}
var powerAmplifierEfficiency = {
  slug: "power-amplifier-efficiency",
  title: "Power Amplifier Efficiency Calculator (PAE & Drain Efficiency)",
  shortTitle: "PA Efficiency",
  category: "rf",
  description: "Calculate RF power amplifier efficiency including power-added efficiency (PAE), drain efficiency, DC power consumption, and heat dissipation",
  keywords: [
    "power amplifier efficiency",
    "PAE",
    "drain efficiency",
    "RF amplifier",
    "power added efficiency",
    "amplifier gain",
    "DC power"
  ],
  inputs: [
    {
      key: "outputPower",
      label: "Output Power",
      symbol: "Pout",
      unit: "dBm",
      defaultValue: 30,
      tooltip: "RF output power in dBm (30 dBm = 1 W)",
      presets: [
        { label: "10 mW (10 dBm)", values: { outputPower: 10 } },
        { label: "100 mW (20 dBm)", values: { outputPower: 20 } },
        { label: "1 W (30 dBm)", values: { outputPower: 30 } },
        { label: "10 W (40 dBm)", values: { outputPower: 40 } }
      ]
    },
    {
      key: "inputPower",
      label: "Input Power",
      symbol: "Pin",
      unit: "dBm",
      defaultValue: 0,
      tooltip: "RF input drive power in dBm"
    },
    {
      key: "dcVoltage",
      label: "DC Supply Voltage",
      symbol: "Vdc",
      unit: "V",
      defaultValue: 5,
      min: 0.1,
      tooltip: "DC bias supply voltage"
    },
    {
      key: "dcCurrent",
      label: "DC Supply Current",
      symbol: "Idc",
      unit: "mA",
      defaultValue: 500,
      min: 0.1,
      tooltip: "DC current draw from supply in mA"
    }
  ],
  outputs: [
    {
      key: "gain",
      label: "Gain",
      symbol: "G",
      unit: "dB",
      precision: 2
    },
    {
      key: "dcPower",
      label: "DC Power Consumed",
      symbol: "Pdc",
      unit: "mW",
      precision: 1
    },
    {
      key: "pae",
      label: "Power-Added Efficiency",
      symbol: "PAE",
      unit: "%",
      precision: 2,
      thresholds: {
        good: { min: 40 },
        warning: { min: 20, max: 40 },
        danger: { min: 20 }
      }
    },
    {
      key: "drainEfficiency",
      label: "Drain Efficiency",
      symbol: "\u03B7_D",
      unit: "%",
      precision: 2,
      thresholds: {
        good: { min: 50 },
        warning: { min: 25, max: 50 },
        danger: { min: 25 }
      }
    },
    {
      key: "dissipatedPower",
      label: "Dissipated Power (Heat)",
      symbol: "Pdiss",
      unit: "mW",
      precision: 1
    }
  ],
  calculate: calculatePowerAmplifierEfficiency,
  formula: {
    primary: "PAE = (Pout \u2212 Pin) / Pdc \xD7 100%",
    variables: [
      { symbol: "PAE", description: "Power-added efficiency", unit: "%" },
      { symbol: "Pout", description: "RF output power", unit: "mW" },
      { symbol: "Pin", description: "RF input power", unit: "mW" },
      { symbol: "Pdc", description: "DC supply power (Vdc \xD7 Idc)", unit: "mW" },
      { symbol: "\u03B7_D", description: "Drain efficiency (Pout/Pdc)", unit: "%" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["rf-link-budget", "db-converter", "noise-figure-cascade"]
};

// src/lib/calculators/rf/intermodulation-distortion.ts
function calculateIntermodulationDistortion(inputs) {
  const { outputPower, inputPower, oip3, oip2, freq1, freq2 } = inputs;
  const gain = outputPower - inputPower;
  const iip3 = oip3 - gain;
  const im3Power = 3 * outputPower - 2 * oip3;
  const im3Ratio = im3Power - outputPower;
  const noiseFloor = -164;
  const dynamicRange = 2 / 3 * (iip3 - noiseFloor);
  const iip2 = oip2 - gain;
  const im2Power = 2 * outputPower - oip2;
  const im2Ratio = im2Power - outputPower;
  const im3Low = Math.abs(2 * freq1 - freq2);
  const im3High = 2 * freq2 - freq1;
  const im2Sum = freq1 + freq2;
  const im2Diff = Math.abs(freq1 - freq2);
  const toneSpacing = Math.abs(freq2 - freq1);
  return {
    values: {
      iip3,
      im3Power,
      im3Ratio,
      dynamicRange,
      iip2,
      im2Power,
      im2Ratio,
      im3Low,
      im3High,
      im2Sum,
      im2Diff,
      toneSpacing
    }
  };
}
var intermodulationDistortion = {
  slug: "intermodulation-distortion",
  title: "Intermodulation Distortion & IP3 Calculator",
  shortTitle: "IMD / IP3",
  category: "rf",
  description: "Calculate third-order intercept point (IP3), intermodulation distortion products, and spurious-free dynamic range for RF amplifiers and mixers",
  keywords: [
    "intermodulation distortion",
    "IP3",
    "IIP3",
    "OIP3",
    "third order intercept",
    "IMD",
    "IM3",
    "dynamic range"
  ],
  inputs: [
    {
      key: "outputPower",
      label: "Output Power",
      symbol: "Pout",
      unit: "dBm",
      defaultValue: 10,
      tooltip: "Fundamental output power per tone in dBm"
    },
    {
      key: "inputPower",
      label: "Input Power",
      symbol: "Pin",
      unit: "dBm",
      defaultValue: 0,
      tooltip: "Input drive power per tone in dBm"
    },
    {
      key: "oip3",
      label: "Output IP3 (OIP3)",
      symbol: "OIP3",
      unit: "dBm",
      defaultValue: 30,
      tooltip: "Output third-order intercept point from datasheet",
      presets: [
        { label: "Low (20 dBm)", values: { oip3: 20 } },
        { label: "Typical (30 dBm)", values: { oip3: 30 } },
        { label: "High (40 dBm)", values: { oip3: 40 } }
      ]
    },
    {
      key: "oip2",
      label: "Output IP2 (OIP2)",
      symbol: "OIP2",
      unit: "dBm",
      defaultValue: 50,
      tooltip: "Output second-order intercept point. Higher = less IM2 distortion.",
      presets: [
        { label: "Low (30 dBm)", values: { oip2: 30 } },
        { label: "Typical (50 dBm)", values: { oip2: 50 } },
        { label: "High (70 dBm)", values: { oip2: 70 } }
      ]
    },
    {
      key: "freq1",
      label: "Tone 1 Frequency",
      symbol: "f\u2081",
      unit: "MHz",
      defaultValue: 100,
      min: 0.1,
      tooltip: "First test tone frequency for two-tone analysis"
    },
    {
      key: "freq2",
      label: "Tone 2 Frequency",
      symbol: "f\u2082",
      unit: "MHz",
      defaultValue: 101,
      min: 0.1,
      tooltip: "Second test tone frequency"
    }
  ],
  outputs: [
    {
      key: "iip3",
      label: "Input IP3 (IIP3)",
      symbol: "IIP3",
      unit: "dBm",
      precision: 2
    },
    {
      key: "im3Power",
      label: "IM3 Product Power",
      symbol: "PIM3",
      unit: "dBm",
      precision: 2
    },
    {
      key: "im3Ratio",
      label: "IM3 to Carrier Ratio",
      symbol: "IM3",
      unit: "dBc",
      precision: 2,
      thresholds: {
        good: { max: -40 },
        warning: { min: -40, max: -20 },
        danger: { max: -20 }
      }
    },
    {
      key: "dynamicRange",
      label: "Spurious-Free Dynamic Range",
      symbol: "SFDR",
      unit: "dB",
      precision: 2
    },
    {
      key: "iip2",
      label: "Input IP2 (IIP2)",
      symbol: "IIP2",
      unit: "dBm",
      precision: 2
    },
    {
      key: "im2Power",
      label: "IM2 Product Power",
      symbol: "PIM2",
      unit: "dBm",
      precision: 2
    },
    {
      key: "im2Ratio",
      label: "IM2 to Carrier Ratio",
      symbol: "IM2",
      unit: "dBc",
      precision: 2,
      thresholds: {
        good: { max: -60 },
        warning: { min: -60, max: -30 },
        danger: { max: -30 }
      }
    },
    {
      key: "im3Low",
      label: "IM3 Low (2f\u2081\u2212f\u2082)",
      symbol: "f_IM3L",
      unit: "MHz",
      precision: 3
    },
    {
      key: "im3High",
      label: "IM3 High (2f\u2082\u2212f\u2081)",
      symbol: "f_IM3H",
      unit: "MHz",
      precision: 3
    },
    {
      key: "im2Sum",
      label: "IM2 Sum (f\u2081+f\u2082)",
      symbol: "f_IM2+",
      unit: "MHz",
      precision: 3
    },
    {
      key: "im2Diff",
      label: "IM2 Diff (|f\u2081\u2212f\u2082|)",
      symbol: "f_IM2-",
      unit: "MHz",
      precision: 3
    },
    {
      key: "toneSpacing",
      label: "Tone Spacing",
      symbol: "\u0394f",
      unit: "MHz",
      precision: 3
    }
  ],
  calculate: calculateIntermodulationDistortion,
  formula: {
    primary: "IIP3 = OIP3 \u2212 G;  P_IM3 = 3\xB7Pout \u2212 2\xB7OIP3;  P_IM2 = 2\xB7Pout \u2212 OIP2",
    variables: [
      { symbol: "IIP3", description: "Input third-order intercept point", unit: "dBm" },
      { symbol: "OIP3", description: "Output third-order intercept point", unit: "dBm" },
      { symbol: "G", description: "Gain (Pout \u2212 Pin)", unit: "dB" },
      { symbol: "PIM3", description: "IM3 product output power", unit: "dBm" },
      { symbol: "SFDR", description: "Spurious-free dynamic range", unit: "dB" },
      { symbol: "IIP2", description: "Input second-order intercept point", unit: "dBm" },
      { symbol: "OIP2", description: "Output second-order intercept point", unit: "dBm" },
      { symbol: "PIM2", description: "IM2 product output power", unit: "dBm" }
    ],
    derivation: [
      "IM3 products (2f1-f2, 2f2-f1) are close to the fundamental tones and hard to filter.",
      "IM2 products (f1+f2, |f1-f2|) are far from fundamentals but problematic in wideband receivers.",
      "Balanced mixers suppress even-order (IM2) products. Single-ended designs do not."
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["mixer-spur-calculator", "noise-figure-cascade", "db-converter", "rf-link-budget"]
};

// src/lib/calculators/rf/phase-noise-to-jitter.ts
function calculatePhaseNoiseToJitter(inputs) {
  const {
    carrierFreq,
    phaseNoise,
    offsetFreqLow,
    offsetFreqHigh,
    profileMode = 0,
    offset2 = 10,
    pn2 = -140,
    offset3 = 100,
    pn3 = -155,
    offset4 = 1e3,
    pn4 = -165
  } = inputs;
  const f_carrier_Hz = carrierFreq * 1e6;
  let phaseNoisePower_linear;
  let phaseNoisePower;
  if (profileMode >= 1) {
    const points = [
      [offsetFreqLow * 1e3, phaseNoise],
      [offset2 * 1e3, pn2],
      [offset3 * 1e3, pn3],
      [offset4 * 1e3, pn4],
      [offsetFreqHigh * 1e3, pn4]
      // extend last known L(f) to upper limit
    ];
    points.sort((a, b) => a[0] - b[0]);
    const f_low = offsetFreqLow * 1e3;
    const f_high = offsetFreqHigh * 1e3;
    const filtered = points.filter(([f]) => f >= f_low && f <= f_high);
    let totalPower = 0;
    for (let i = 0; i < filtered.length - 1; i++) {
      const [f1, l1_dBc] = filtered[i];
      const [f2, l2_dBc] = filtered[i + 1];
      if (f2 <= f1) continue;
      const L1 = Math.pow(10, l1_dBc / 10);
      const L2 = Math.pow(10, l2_dBc / 10);
      totalPower += (L1 + L2) / 2 * (f2 - f1);
    }
    phaseNoisePower_linear = Math.max(totalPower, 1e-30);
    phaseNoisePower = 10 * Math.log10(phaseNoisePower_linear);
  } else {
    const bw_Hz = (offsetFreqHigh - offsetFreqLow) * 1e3;
    phaseNoisePower = phaseNoise + 10 * Math.log10(Math.max(bw_Hz, 1));
    phaseNoisePower_linear = Math.pow(10, phaseNoisePower / 10);
  }
  const rmsJitter_s = Math.sqrt(2 * phaseNoisePower_linear) / (2 * Math.PI * Math.max(f_carrier_Hz, 1));
  const rmsJitter = rmsJitter_s * 1e12;
  const cycleToCycleJitter = rmsJitter * Math.sqrt(2);
  const rmsPhaseError = Math.sqrt(2 * phaseNoisePower_linear) * (180 / Math.PI);
  const jitterProduct = 2 * Math.PI * Math.max(f_carrier_Hz, 1) * Math.max(rmsJitter_s, 1e-30);
  const adcSnrLimit = -20 * Math.log10(jitterProduct);
  return {
    values: {
      rmsJitter,
      cycleToCycleJitter,
      phaseNoisePower,
      rmsPhaseError,
      adcSnrLimit
    }
  };
}
var phaseNoiseToJitter = {
  slug: "phase-noise-to-jitter",
  title: "Phase Noise to Jitter Converter",
  shortTitle: "Phase Noise to Jitter",
  category: "rf",
  description: "Convert oscillator phase noise (dBc/Hz) to RMS jitter and cycle-to-cycle jitter by integrating over a specified offset frequency range",
  keywords: [
    "phase noise",
    "jitter",
    "oscillator noise",
    "clock jitter",
    "phase noise to jitter",
    "RMS jitter",
    "dBc/Hz",
    "integrated phase noise"
  ],
  inputs: [
    {
      key: "carrierFreq",
      label: "Carrier Frequency",
      symbol: "f\u2080",
      unit: "MHz",
      defaultValue: 100,
      min: 1e-3,
      tooltip: "Oscillator carrier frequency in MHz",
      presets: [
        { label: "10 MHz", values: { carrierFreq: 10 } },
        { label: "100 MHz", values: { carrierFreq: 100 } },
        { label: "1 GHz", values: { carrierFreq: 1e3 } }
      ]
    },
    {
      key: "phaseNoise",
      label: "Phase Noise",
      symbol: "L(f)",
      unit: "dBc/Hz",
      defaultValue: -120,
      max: 0,
      tooltip: "Single-sideband phase noise spectral density at a representative offset"
    },
    {
      key: "offsetFreqLow",
      label: "Integration Start (Offset Low)",
      symbol: "f_low",
      unit: "kHz",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Lower integration limit for phase noise bandwidth"
    },
    {
      key: "offsetFreqHigh",
      label: "Integration End (Offset High)",
      symbol: "f_high",
      unit: "kHz",
      defaultValue: 1e4,
      min: 1,
      tooltip: "Upper integration limit for phase noise bandwidth"
    },
    {
      key: "profileMode",
      label: "Profile Mode",
      symbol: "mode",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 1,
      tooltip: "0 = Single flat phase noise, 1 = Multi-point profile for accurate integration"
    },
    {
      key: "offset2",
      label: "Offset Point 2",
      symbol: "f\u2082",
      unit: "kHz",
      defaultValue: 10,
      min: 1e-3,
      group: "Phase Noise Profile"
    },
    {
      key: "pn2",
      label: "Phase Noise Point 2",
      symbol: "L\u2082",
      unit: "dBc/Hz",
      defaultValue: -140,
      max: 0,
      group: "Phase Noise Profile"
    },
    {
      key: "offset3",
      label: "Offset Point 3",
      symbol: "f\u2083",
      unit: "kHz",
      defaultValue: 100,
      min: 1e-3,
      group: "Phase Noise Profile"
    },
    {
      key: "pn3",
      label: "Phase Noise Point 3",
      symbol: "L\u2083",
      unit: "dBc/Hz",
      defaultValue: -155,
      max: 0,
      group: "Phase Noise Profile"
    },
    {
      key: "offset4",
      label: "Offset Point 4",
      symbol: "f\u2084",
      unit: "kHz",
      defaultValue: 1e3,
      min: 1e-3,
      group: "Phase Noise Profile"
    },
    {
      key: "pn4",
      label: "Phase Noise Point 4",
      symbol: "L\u2084",
      unit: "dBc/Hz",
      defaultValue: -165,
      max: 0,
      group: "Phase Noise Profile"
    }
  ],
  outputs: [
    {
      key: "rmsJitter",
      label: "RMS Jitter",
      symbol: "J_rms",
      unit: "ps",
      precision: 3,
      thresholds: {
        good: { max: 1 },
        warning: { min: 1, max: 10 },
        danger: { min: 10 }
      }
    },
    {
      key: "cycleToCycleJitter",
      label: "Cycle-to-Cycle Jitter",
      symbol: "J_c2c",
      unit: "ps",
      precision: 3
    },
    {
      key: "phaseNoisePower",
      label: "Integrated Phase Noise Power",
      symbol: "L_int",
      unit: "dBc",
      precision: 2
    },
    {
      key: "rmsPhaseError",
      label: "RMS Phase Error",
      symbol: "\u03C6_rms",
      unit: "deg",
      precision: 3
    },
    {
      key: "adcSnrLimit",
      label: "ADC SNR Limit (Jitter)",
      symbol: "SNR_j",
      unit: "dB",
      precision: 1,
      thresholds: {
        good: { min: 70 },
        warning: { min: 50, max: 70 },
        danger: { max: 50 }
      },
      tooltip: "Maximum achievable ADC SNR limited by clock jitter at this carrier frequency"
    }
  ],
  calculate: calculatePhaseNoiseToJitter,
  formula: {
    primary: "J_rms = \u221A(2\xB710^(L_int/10)) / (2\u03C0\xB7f\u2080)",
    derivation: [
      "Single-point: L_int = L(f) + 10\xB7log\u2081\u2080(BW)",
      "Multi-point: L_int = \u03A3 (L_i + L_{i+1})/2 \xB7 (f_{i+1} - f_i) via trapezoidal integration",
      "ADC SNR limit from jitter: SNR_j = -20\xB7log\u2081\u2080(2\u03C0\xB7f\u2080\xB7J_rms)"
    ],
    variables: [
      { symbol: "J_rms", description: "RMS jitter", unit: "s" },
      { symbol: "L_int", description: "Integrated phase noise power", unit: "dBc" },
      { symbol: "L(f)", description: "Phase noise spectral density", unit: "dBc/Hz" },
      { symbol: "f\u2080", description: "Carrier frequency", unit: "Hz" },
      { symbol: "BW", description: "Integration bandwidth", unit: "Hz" },
      { symbol: "SNR_j", description: "ADC SNR limit from clock jitter", unit: "dB" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["adc-snr", "q-factor", "snr-calculator", "rf-link-budget"]
};

// src/lib/calculators/rf/vibration-phase-noise.ts
function calculateVibrationPhaseNoise(inputs) {
  const { carrierFreq, vibSensitivity, vibAccel, vibFreq } = inputs;
  const f0 = carrierFreq * 1e9;
  const gamma = vibSensitivity * 1e-9;
  const numerator = gamma * vibAccel * f0;
  const lvib = 20 * Math.log10(Math.max(numerator / vibFreq, 1e-30)) - 3;
  const bw = Math.max(vibFreq - 10, 1);
  const psd = vibAccel * vibAccel / bw;
  const lRandom = 20 * Math.log10(Math.max(gamma * Math.sqrt(psd) * f0, 1e-30));
  const freqDev = gamma * vibAccel * f0;
  const typicalQuiescent = -120 + 20 * Math.log10(Math.max(100 / vibFreq, 1e-30));
  const degradation = lvib - typicalQuiescent;
  return {
    values: {
      lvib,
      lRandom,
      freqDev,
      degradation
    }
  };
}
var vibrationPhaseNoise = {
  slug: "vibration-phase-noise",
  title: "Phase Noise Under Vibrations Calculator",
  shortTitle: "Vibration Phase Noise",
  category: "rf",
  description: "Calculate vibration-induced phase noise degradation for oscillators on defense, aerospace, and mobile platforms using acceleration sensitivity (Gamma) and vibration profiles",
  keywords: [
    "vibration phase noise",
    "acceleration sensitivity",
    "gamma",
    "OCXO vibration",
    "MIL-STD-810",
    "oscillator vibration",
    "microphonics",
    "phase noise degradation",
    "defense oscillator",
    "aerospace phase noise"
  ],
  inputs: [
    {
      key: "carrierFreq",
      label: "Carrier Frequency",
      symbol: "f\u2080",
      unit: "GHz",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Oscillator carrier frequency in GHz",
      presets: [
        { label: "100 MHz", values: { carrierFreq: 0.1 } },
        { label: "1 GHz", values: { carrierFreq: 1 } },
        { label: "10 GHz X-band", values: { carrierFreq: 10 } },
        { label: "35 GHz Ka-band", values: { carrierFreq: 35 } }
      ]
    },
    {
      key: "vibSensitivity",
      label: "Acceleration Sensitivity",
      symbol: "\u0393",
      unit: "ppb/g",
      defaultValue: 1,
      min: 1e-3,
      max: 100,
      tooltip: "Oscillator acceleration sensitivity (Gamma) in parts per billion per g",
      presets: [
        { label: "Premium OCXO (0.1)", values: { vibSensitivity: 0.1 } },
        { label: "Good OCXO (1)", values: { vibSensitivity: 1 } },
        { label: "TCXO (5)", values: { vibSensitivity: 5 } },
        { label: "Standard XO (20)", values: { vibSensitivity: 20 } }
      ]
    },
    {
      key: "vibAccel",
      label: "Vibration Acceleration",
      symbol: "a",
      unit: "g rms",
      defaultValue: 1,
      min: 1e-3,
      max: 50,
      tooltip: "RMS vibration acceleration level in g",
      presets: [
        { label: "Ground vehicle (0.5g)", values: { vibAccel: 0.5 } },
        { label: "MIL-STD-810 (1g)", values: { vibAccel: 1 } },
        { label: "Aircraft (2g)", values: { vibAccel: 2 } },
        { label: "Missile (10g)", values: { vibAccel: 10 } }
      ]
    },
    {
      key: "vibFreq",
      label: "Vibration Frequency",
      symbol: "f_vib",
      unit: "Hz",
      defaultValue: 100,
      min: 1,
      max: 1e4,
      tooltip: "Vibration frequency or offset frequency at which to evaluate phase noise"
    }
  ],
  outputs: [
    {
      key: "lvib",
      label: "Sinusoidal Vibration Phase Noise",
      symbol: "L_vib",
      unit: "dBc/Hz",
      precision: 1,
      thresholds: {
        good: { max: -100 },
        warning: { min: -100, max: -60 },
        danger: { max: -60 }
      }
    },
    {
      key: "lRandom",
      label: "Random Vibration Phase Noise",
      symbol: "L_rand",
      unit: "dBc/Hz",
      precision: 1
    },
    {
      key: "freqDev",
      label: "Peak Frequency Deviation",
      symbol: "\u0394f",
      unit: "Hz",
      precision: 2
    },
    {
      key: "degradation",
      label: "Degradation vs Quiescent",
      symbol: "\u0394L",
      unit: "dB",
      precision: 1,
      thresholds: {
        good: { max: 0 },
        warning: { min: 0, max: 20 },
        danger: { max: 20 }
      }
    }
  ],
  calculate: calculateVibrationPhaseNoise,
  formula: {
    primary: "L_vib(f) = 20 log10(\u0393 \xB7 a \xB7 f\u2080 / f_vib) - 3 dB",
    latex: "L_{vib}(f) = 20\\log_{10}\\!\\left(\\frac{\\Gamma \\cdot a \\cdot f_0}{f_{vib}}\\right) - 3\\text{ dB}",
    variables: [
      { symbol: "L_vib", description: "Vibration-induced phase noise", unit: "dBc/Hz" },
      { symbol: "\u0393", description: "Acceleration sensitivity (Gamma)", unit: "1/g" },
      { symbol: "a", description: "Vibration acceleration", unit: "g rms" },
      { symbol: "f\u2080", description: "Carrier frequency", unit: "Hz" },
      { symbol: "f_vib", description: "Vibration / offset frequency", unit: "Hz" }
    ],
    derivation: [
      "Mechanical vibration causes micro-deformation of the quartz crystal lattice, shifting its resonant frequency.",
      "The fractional frequency shift is: \u0394f/f\u2080 = \u0393 \xB7 a(t), where \u0393 is the acceleration sensitivity vector and a(t) is the instantaneous acceleration.",
      "For sinusoidal vibration a(t) = a\u2080 sin(2\u03C0 f_vib t), this produces FM sidebands at \xB1f_vib from the carrier.",
      "The peak phase deviation is: \u0394\u03C6_peak = \u0393 \xB7 a\u2080 \xB7 f\u2080 / f_vib.",
      "Converting peak to RMS for a sinusoidal signal: L_vib = 20 log10(\u0394\u03C6_peak) - 3 dB.",
      "For broadband random vibration with PSD W(f) [g\xB2/Hz], L_rand(f) = 20 log10(\u0393 \xB7 \u221AW(f) \xB7 f\u2080)."
    ],
    reference: 'Vig, "Quartz Crystal Resonators and Oscillators"; MIL-PRF-55310; IEEE 1139'
  },
  liveWidgets: [{ type: "space-weather", position: "below-outputs" }],
  visualization: { type: "none" },
  relatedCalculators: ["phase-noise-to-jitter", "q-factor", "rf-link-budget"]
};

// src/lib/calculators/rf/return-loss-error.ts
function calculateReturnLossError(inputs) {
  const { dutReturnLoss, directivity, sourceMatch } = inputs;
  const rho_dut = Math.pow(10, -dutReturnLoss / 20);
  const rho_dir = Math.pow(10, -directivity / 20);
  const rho_src = Math.pow(10, -sourceMatch / 20);
  const rho_max = rho_dut + rho_dir + rho_dut * rho_dut * rho_src;
  const rho_min = Math.max(
    Math.abs(rho_dut - rho_dir - rho_dut * rho_dut * rho_src),
    1e-15
  );
  const rlMax = -20 * Math.log10(rho_min);
  const rlMin = -20 * Math.log10(rho_max);
  const uncertaintyDb = rlMax - rlMin;
  const rho_dir_combined = Math.max(Math.abs(rho_dut + rho_dir), 1e-15);
  const rlDirOnly = -20 * Math.log10(rho_dir_combined);
  const dirError = Math.abs(dutReturnLoss - rlDirOnly);
  return {
    values: {
      rlMax: Math.round(rlMax * 10) / 10,
      rlMin: Math.round(rlMin * 10) / 10,
      uncertaintyDb: Math.round(uncertaintyDb * 10) / 10,
      dirError: Math.round(dirError * 100) / 100
    }
  };
}
var returnLossError = {
  slug: "return-loss-error",
  title: "Return Loss Measurement Error Calculator",
  shortTitle: "RL Meas. Error",
  category: "rf",
  description: "Calculate measurement uncertainty for return loss measurements using directional couplers or bridges. Accounts for coupler directivity and source match errors critical for VNA and test engineering.",
  keywords: [
    "return loss error",
    "measurement uncertainty",
    "directional coupler directivity",
    "vna measurement error",
    "source match error",
    "reflection coefficient uncertainty",
    "rf measurement accuracy"
  ],
  inputs: [
    {
      key: "dutReturnLoss",
      label: "DUT Return Loss",
      symbol: "RL_{DUT}",
      unit: "dB",
      defaultValue: 20,
      min: 0,
      max: 60,
      step: 0.5,
      tooltip: "Return loss of the device under test",
      presets: [
        { label: "Poor (10 dB)", values: { dutReturnLoss: 10 } },
        { label: "Typical (20 dB)", values: { dutReturnLoss: 20 } },
        { label: "Good (30 dB)", values: { dutReturnLoss: 30 } },
        { label: "Excellent (40 dB)", values: { dutReturnLoss: 40 } }
      ]
    },
    {
      key: "directivity",
      label: "Coupler Directivity",
      symbol: "D",
      unit: "dB",
      defaultValue: 35,
      min: 10,
      max: 60,
      step: 0.5,
      tooltip: "Directivity of the directional coupler or bridge used for the measurement",
      presets: [
        { label: "Basic coupler (20 dB)", values: { directivity: 20 } },
        { label: "Good coupler (35 dB)", values: { directivity: 35 } },
        { label: "Premium bridge (45 dB)", values: { directivity: 45 } }
      ]
    },
    {
      key: "sourceMatch",
      label: "Source Match",
      symbol: "M_S",
      unit: "dB",
      defaultValue: 30,
      min: 10,
      max: 60,
      step: 0.5,
      tooltip: "Return loss of the measurement source port (how well the source is matched)"
    }
  ],
  outputs: [
    {
      key: "rlMax",
      label: "Best-Case RL",
      symbol: "RL_{max}",
      unit: "dB",
      precision: 1,
      tooltip: "Highest return loss you might measure (errors cancel)"
    },
    {
      key: "rlMin",
      label: "Worst-Case RL",
      symbol: "RL_{min}",
      unit: "dB",
      precision: 1,
      tooltip: "Lowest return loss you might measure (errors add)"
    },
    {
      key: "uncertaintyDb",
      label: "Measurement Uncertainty",
      symbol: "\\Delta RL",
      unit: "dB",
      precision: 1,
      thresholds: {
        good: { max: 3 },
        warning: { max: 6 }
      }
    },
    {
      key: "dirError",
      label: "Directivity Error",
      symbol: "\\epsilon_D",
      unit: "dB",
      precision: 2,
      tooltip: "Error from coupler directivity only"
    }
  ],
  calculate: calculateReturnLossError,
  formula: {
    primary: "\\rho_{meas} = \\rho_{DUT} \\pm \\rho_{dir} \\pm \\rho_{DUT}^2 \\cdot \\rho_{src}",
    latex: "\\rho_{meas} = \\rho_{DUT} \\pm \\rho_{dir} \\pm \\rho_{DUT}^2 \\cdot \\rho_{src}",
    variables: [
      {
        symbol: "\\rho_{DUT}",
        description: "Linear reflection coefficient of DUT",
        unit: ""
      },
      {
        symbol: "\\rho_{dir}",
        description: "Directivity leakage (internal reflection reaching the coupled port)",
        unit: ""
      },
      {
        symbol: "\\rho_{src}",
        description: "Source match reflection coefficient",
        unit: ""
      },
      {
        symbol: "\\rho_{meas}",
        description: "Measured (apparent) reflection coefficient",
        unit: ""
      }
    ],
    derivation: [
      "A directional coupler separates forward and reflected waves, but finite directivity allows a fraction of the forward wave to leak into the reflected port. This leakage adds vectorially to the true reflected signal.",
      "Additionally, some of the reflected signal re-reflects off the imperfect source match, traverses the DUT twice (hence rho_DUT squared), and adds to the measurement.",
      "Since the phases of these error terms are generally unknown, we compute the worst-case bounds assuming all vectors align (maximum error) or oppose (minimum error)."
    ],
    reference: "Agilent AN 1287-3: Applying Error Correction to VNA Measurements"
  },
  visualization: { type: "none" },
  relatedCalculators: ["vswr-return-loss", "noise-figure-cascade", "rf-link-budget"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" }
  ],
  verificationData: [
    {
      inputs: { dutReturnLoss: 20, directivity: 35, sourceMatch: 30 },
      expectedOutputs: { rlMin: 18.6, rlMax: 21.7, uncertaintyDb: 3.1 },
      tolerance: 0.15,
      source: "Agilent AN 1287-3 worked example"
    },
    {
      inputs: { dutReturnLoss: 10, directivity: 20, sourceMatch: 30 },
      expectedOutputs: { uncertaintyDb: 6.9 },
      tolerance: 0.5,
      source: "Basic coupler measuring poor DUT"
    }
  ]
};

// src/lib/calculators/signal/adc-snr.ts
function calculateAdcSnr(inputs) {
  const { bits, inputFreq, samplingFreq, jitter } = inputs;
  const theoreticalSnr = 6.02 * bits + 1.76;
  const t_jitter_s = jitter * 1e-12;
  const f_in_Hz = inputFreq * 1e6;
  const snrJitter = -20 * Math.log10(2 * Math.PI * f_in_Hz * Math.max(t_jitter_s, 1e-20));
  const combinedSnr = -10 * Math.log10(
    Math.pow(10, -theoreticalSnr / 10) + Math.pow(10, -snrJitter / 10)
  );
  const snrWithJitter = combinedSnr;
  const enob = (combinedSnr - 1.76) / 6.02;
  const sfdr = 3 / 2 * (6.02 * bits + 1.76);
  const noisePower = -combinedSnr;
  const enobClamped = Math.max(0, Math.min(bits, enob));
  return {
    values: {
      theoreticalSnr,
      snrWithJitter,
      enob: enobClamped,
      sfdr,
      noisePower
    }
  };
}
var adcSnr = {
  slug: "adc-snr",
  title: "ADC SNR and ENOB Calculator",
  shortTitle: "ADC SNR & ENOB",
  category: "signal",
  description: "Calculate analog-to-digital converter signal-to-noise ratio, effective number of bits (ENOB), and SFDR including aperture jitter effects",
  keywords: [
    "ADC SNR",
    "ENOB",
    "effective number of bits",
    "ADC noise",
    "quantization noise",
    "aperture jitter",
    "SFDR",
    "ADC dynamic range"
  ],
  inputs: [
    {
      key: "bits",
      label: "ADC Resolution",
      symbol: "N",
      unit: "bits",
      defaultValue: 12,
      min: 1,
      max: 24,
      step: 1,
      presets: [
        { label: "8-bit", values: { bits: 8 } },
        { label: "12-bit", values: { bits: 12 } },
        { label: "16-bit", values: { bits: 16 } },
        { label: "24-bit", values: { bits: 24 } }
      ]
    },
    {
      key: "inputFreq",
      label: "Input Signal Frequency",
      symbol: "f_in",
      unit: "MHz",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Frequency of the input analog signal being sampled"
    },
    {
      key: "samplingFreq",
      label: "Sampling Frequency",
      symbol: "f_s",
      unit: "MHz",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "ADC sample rate (must be > 2\xD7 input frequency)"
    },
    {
      key: "jitter",
      label: "Aperture Jitter",
      symbol: "t_j",
      unit: "ps",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "RMS aperture jitter of the ADC sampling clock in picoseconds"
    }
  ],
  outputs: [
    {
      key: "theoreticalSnr",
      label: "Theoretical SNR (Quantization)",
      symbol: "SNR_ideal",
      unit: "dB",
      precision: 2
    },
    {
      key: "snrWithJitter",
      label: "Effective SNR (with Jitter)",
      symbol: "SNR_eff",
      unit: "dB",
      precision: 2,
      thresholds: {
        good: { min: 60 },
        warning: { min: 40, max: 60 },
        danger: { min: 40 }
      }
    },
    {
      key: "enob",
      label: "Effective Number of Bits",
      symbol: "ENOB",
      unit: "bits",
      precision: 2
    },
    {
      key: "sfdr",
      label: "SFDR (estimate)",
      symbol: "SFDR",
      unit: "dBc",
      precision: 1
    },
    {
      key: "noisePower",
      label: "Noise Floor",
      symbol: "N_floor",
      unit: "dBFS",
      precision: 2
    }
  ],
  calculate: calculateAdcSnr,
  formula: {
    primary: "SNR_ideal = 6.02\xB7N + 1.76 dB;  SNR_jitter = \u221220\xB7log\u2081\u2080(2\u03C0\xB7f_in\xB7t_j)",
    variables: [
      { symbol: "N", description: "ADC resolution in bits", unit: "bits" },
      { symbol: "SNR", description: "Signal-to-noise ratio", unit: "dB" },
      { symbol: "ENOB", description: "Effective number of bits", unit: "bits" },
      { symbol: "t_j", description: "Aperture jitter (RMS)", unit: "s" },
      { symbol: "f_in", description: "Input signal frequency", unit: "Hz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["sampling-nyquist", "snr-calculator", "johnson-noise"]
};

// src/lib/calculators/signal/fft-bin-resolution.ts
function calculateFftBinResolution(inputs) {
  const { sampleRate, fftSize, windowType } = inputs;
  const fs_Hz = sampleRate * 1e3;
  const binResolution = fs_Hz / Math.max(fftSize, 1);
  const frequencyRange = sampleRate / 2;
  const timeRecord = fftSize / fs_Hz * 1e3;
  const scallopingLossMap = { 0: 3.92, 1: 1.42, 2: 1.1 };
  const type = Math.round(windowType);
  const scalloping = scallopingLossMap[type] ?? 1.42;
  const noiseFloor = -10 * Math.log10(Math.max(fftSize / 2, 1));
  return {
    values: {
      binResolution,
      frequencyRange,
      timeRecord,
      noiseFloor,
      scalloping
    }
  };
}
var fftBinResolution = {
  slug: "fft-bin-resolution",
  title: "FFT Bin Resolution & Spectral Analysis Calculator",
  shortTitle: "FFT Resolution",
  category: "signal",
  description: "Calculate FFT frequency bin resolution, Nyquist range, time record length, noise floor processing gain, and window scalloping loss",
  keywords: [
    "FFT resolution",
    "bin width",
    "frequency resolution",
    "spectral analysis",
    "DFT",
    "windowing",
    "scalloping loss",
    "noise floor"
  ],
  inputs: [
    {
      key: "sampleRate",
      label: "Sample Rate",
      symbol: "f_s",
      unit: "kHz",
      defaultValue: 44.1,
      min: 1e-3,
      presets: [
        { label: "8 kHz (telephony)", values: { sampleRate: 8 } },
        { label: "44.1 kHz (audio)", values: { sampleRate: 44.1 } },
        { label: "48 kHz (audio)", values: { sampleRate: 48 } },
        { label: "1000 kHz (1 MHz)", values: { sampleRate: 1e3 } }
      ]
    },
    {
      key: "fftSize",
      label: "FFT Size",
      symbol: "N",
      unit: "points",
      defaultValue: 1024,
      min: 8,
      step: 1,
      tooltip: "Number of FFT points (power of 2 recommended)",
      presets: [
        { label: "256", values: { fftSize: 256 } },
        { label: "512", values: { fftSize: 512 } },
        { label: "1024", values: { fftSize: 1024 } },
        { label: "4096", values: { fftSize: 4096 } }
      ]
    },
    {
      key: "windowType",
      label: "Window Function",
      symbol: "w",
      unit: "",
      defaultValue: 1,
      min: 0,
      max: 2,
      step: 1,
      presets: [
        { label: "Rectangular", values: { windowType: 0 } },
        { label: "Hann", values: { windowType: 1 } },
        { label: "Blackman", values: { windowType: 2 } }
      ]
    }
  ],
  outputs: [
    {
      key: "binResolution",
      label: "Frequency Bin Resolution",
      symbol: "\u0394f",
      unit: "Hz",
      precision: 3
    },
    {
      key: "frequencyRange",
      label: "Frequency Range (Nyquist)",
      symbol: "f_N",
      unit: "kHz",
      precision: 3
    },
    {
      key: "timeRecord",
      label: "Time Record Length",
      symbol: "T",
      unit: "ms",
      precision: 3
    },
    {
      key: "noiseFloor",
      label: "FFT Processing Gain",
      symbol: "G_proc",
      unit: "dB",
      precision: 1,
      tooltip: "Noise floor improvement from coherent FFT integration"
    },
    {
      key: "scalloping",
      label: "Scalloping Loss",
      symbol: "L_scallop",
      unit: "dB",
      precision: 2,
      thresholds: {
        good: { max: 1.5 },
        warning: { min: 1.5, max: 3 },
        danger: { min: 3 }
      }
    }
  ],
  calculate: calculateFftBinResolution,
  formula: {
    primary: "\u0394f = f_s / N",
    variables: [
      { symbol: "\u0394f", description: "Frequency bin resolution", unit: "Hz" },
      { symbol: "f_s", description: "Sample rate", unit: "Hz" },
      { symbol: "N", description: "FFT size (number of points)", unit: "" },
      { symbol: "T", description: "Time record length (N/f_s)", unit: "s" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["sampling-nyquist", "snr-calculator", "adc-snr"]
};

// src/lib/calculators/signal/johnson-noise.ts
function calculateJohnsonNoise(inputs) {
  const { resistance, temperature, bandwidth } = inputs;
  const k = 138064852e-31;
  const T_K = temperature + 273.15;
  const R = resistance;
  const BW = bandwidth * 1e6;
  const noiseVoltage_V = Math.sqrt(4 * k * T_K * R * BW);
  const noiseVoltage = noiseVoltage_V * 1e9;
  const Pn_W = k * T_K * BW;
  const Pn_mW = Pn_W * 1e3;
  const noisePower = 10 * Math.log10(Math.max(Pn_mW, 1e-30));
  const noisePowerDensity = 10 * Math.log10(k * T_K * 1e3);
  const noiseCurrentDensity = Math.sqrt(4 * k * T_K / Math.max(R, 1e-9)) * 1e12;
  return {
    values: {
      noiseVoltage,
      noisePower,
      noisePowerDensity,
      noiseCurrentDensity
    }
  };
}
var johnsonNoise = {
  slug: "johnson-noise",
  title: "Johnson-Nyquist Thermal Noise Calculator",
  shortTitle: "Johnson-Nyquist Noise",
  category: "signal",
  description: "Calculate thermal noise voltage, noise power, and noise spectral density for resistors using the Johnson-Nyquist noise formula",
  keywords: [
    "Johnson noise",
    "thermal noise",
    "Nyquist noise",
    "resistor noise",
    "noise figure",
    "kTB noise",
    "noise floor",
    "noise voltage density"
  ],
  inputs: [
    {
      key: "resistance",
      label: "Resistance",
      symbol: "R",
      unit: "\u03A9",
      defaultValue: 50,
      min: 1e-3,
      presets: [
        { label: "50 \u03A9 (RF)", values: { resistance: 50 } },
        { label: "75 \u03A9 (cable)", values: { resistance: 75 } },
        { label: "1 k\u03A9", values: { resistance: 1e3 } },
        { label: "10 k\u03A9", values: { resistance: 1e4 } }
      ]
    },
    {
      key: "temperature",
      label: "Temperature",
      symbol: "T",
      unit: "\xB0C",
      defaultValue: 25,
      min: -273,
      tooltip: "Physical temperature of the resistor"
    },
    {
      key: "bandwidth",
      label: "Noise Bandwidth",
      symbol: "BW",
      unit: "MHz",
      defaultValue: 1,
      min: 1e-6,
      tooltip: "Measurement or system bandwidth"
    }
  ],
  outputs: [
    {
      key: "noiseVoltage",
      label: "RMS Noise Voltage",
      symbol: "V_n",
      unit: "nV",
      precision: 3
    },
    {
      key: "noisePower",
      label: "Available Noise Power",
      symbol: "P_n",
      unit: "dBm",
      precision: 2
    },
    {
      key: "noisePowerDensity",
      label: "Noise Power Density",
      symbol: "N\u2080",
      unit: "dBm/Hz",
      precision: 2,
      tooltip: "kT in dBm/Hz (\u2212174 dBm/Hz at 290 K)"
    },
    {
      key: "noiseCurrentDensity",
      label: "Noise Current Density",
      symbol: "I_n",
      unit: "pA/\u221AHz",
      precision: 3
    }
  ],
  calculate: calculateJohnsonNoise,
  formula: {
    primary: "V_n = \u221A(4kTRB)",
    variables: [
      { symbol: "V_n", description: "RMS noise voltage", unit: "V" },
      { symbol: "k", description: "Boltzmann constant (1.38\xD710\u207B\xB2\xB3)", unit: "J/K" },
      { symbol: "T", description: "Absolute temperature", unit: "K" },
      { symbol: "R", description: "Resistance", unit: "\u03A9" },
      { symbol: "B", description: "Noise bandwidth", unit: "Hz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["noise-figure-cascade", "snr-calculator", "adc-snr"]
};

// src/lib/calculators/signal/am-modulation-index.ts
function calculateAmModulationIndex(inputs) {
  const { carrierAmplitude, messageAmplitude, carrierFreq, messageFreq } = inputs;
  const Ac = Math.max(carrierAmplitude, 1e-9);
  const Am = messageAmplitude;
  const modulationIndex = Am / Ac * 100;
  const upperSideband = carrierFreq + messageFreq;
  const lowerSideband = carrierFreq - messageFreq;
  const bw = 2 * messageFreq;
  const m = Am / Ac;
  const powerEfficiency = m * m / (2 + m * m) * 100;
  const sidebandsToCarrier = 20 * Math.log10(Math.max(m / 2, 1e-10));
  return {
    values: {
      modulationIndex,
      upperSideband,
      lowerSideband,
      bandwidth: bw,
      powerEfficiency,
      sidebandsToCarrier
    }
  };
}
var amModulationIndex = {
  slug: "am-modulation-index",
  title: "AM Modulation Index Calculator",
  shortTitle: "AM Modulation Index",
  category: "signal",
  description: "Calculate amplitude modulation index, sidebands, bandwidth, and power efficiency for AM radio signals",
  keywords: [
    "AM modulation",
    "amplitude modulation index",
    "AM bandwidth",
    "sidebands",
    "modulation depth",
    "carrier power",
    "DSB",
    "AM radio"
  ],
  inputs: [
    {
      key: "carrierAmplitude",
      label: "Carrier Amplitude",
      symbol: "Ac",
      unit: "V",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Peak amplitude of the carrier signal"
    },
    {
      key: "messageAmplitude",
      label: "Message Amplitude",
      symbol: "Am",
      unit: "V",
      defaultValue: 0.5,
      min: 0,
      tooltip: "Peak amplitude of the modulating signal"
    },
    {
      key: "carrierFreq",
      label: "Carrier Frequency",
      symbol: "f_c",
      unit: "kHz",
      defaultValue: 1e3,
      min: 1e-3,
      tooltip: "Carrier signal frequency (e.g. 1000 kHz = 1 MHz AM band)"
    },
    {
      key: "messageFreq",
      label: "Message Frequency",
      symbol: "f_m",
      unit: "kHz",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Modulating signal (audio) frequency"
    }
  ],
  outputs: [
    {
      key: "modulationIndex",
      label: "Modulation Index",
      symbol: "m",
      unit: "%",
      precision: 2,
      thresholds: {
        good: { max: 100 },
        warning: { min: 100, max: 120 },
        danger: { min: 120 }
      },
      tooltip: "100% = full modulation; >100% causes overmodulation distortion"
    },
    {
      key: "upperSideband",
      label: "Upper Sideband (USB)",
      symbol: "f_USB",
      unit: "kHz",
      precision: 3
    },
    {
      key: "lowerSideband",
      label: "Lower Sideband (LSB)",
      symbol: "f_LSB",
      unit: "kHz",
      precision: 3
    },
    {
      key: "bandwidth",
      label: "Bandwidth",
      symbol: "BW",
      unit: "kHz",
      precision: 3
    },
    {
      key: "powerEfficiency",
      label: "Power Efficiency",
      symbol: "\u03B7",
      unit: "%",
      precision: 2
    },
    {
      key: "sidebandsToCarrier",
      label: "Sideband / Carrier Ratio",
      symbol: "S/C",
      unit: "dB",
      precision: 2
    }
  ],
  calculate: calculateAmModulationIndex,
  formula: {
    primary: "m = Am / Ac;  \u03B7 = m\xB2/(2 + m\xB2)",
    variables: [
      { symbol: "m", description: "Modulation index (0 to 1)", unit: "" },
      { symbol: "Ac", description: "Carrier amplitude", unit: "V" },
      { symbol: "Am", description: "Message signal amplitude", unit: "V" },
      { symbol: "BW", description: "Bandwidth = 2\xB7f_m", unit: "Hz" },
      { symbol: "\u03B7", description: "Power efficiency", unit: "%" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["fm-modulation-index", "snr-calculator", "db-converter"]
};

// src/lib/calculators/signal/fm-modulation-index.ts
function calculateFmModulationIndex(inputs) {
  const { frequencyDeviation, messageFreq, carrierFreq } = inputs;
  const deltaF = Math.max(frequencyDeviation, 1e-9);
  const fm = Math.max(messageFreq, 1e-9);
  const modulationIndex = deltaF / fm;
  const carsonBandwidth = 2 * (deltaF + fm);
  const besselBandwidth = 2 * (modulationIndex + 1) * fm;
  const snrImprovement = 10 * Math.log10(Math.max(3 * modulationIndex * modulationIndex * (modulationIndex + 1), 1e-10));
  return {
    values: {
      modulationIndex,
      carsonBandwidth,
      besselBandwidth,
      snrImprovement
    }
  };
}
var fmModulationIndex = {
  slug: "fm-modulation-index",
  title: "FM Modulation Index & Bandwidth Calculator",
  shortTitle: "FM Modulation Index",
  category: "signal",
  description: "Calculate FM modulation index, bandwidth using Carson's rule, Bessel bandwidth, and SNR improvement over AM",
  keywords: [
    "FM modulation index",
    "frequency deviation",
    "Carson's rule",
    "FM bandwidth",
    "FM SNR",
    "frequency modulation",
    "beta factor",
    "WBFM"
  ],
  inputs: [
    {
      key: "frequencyDeviation",
      label: "Frequency Deviation",
      symbol: "\u0394f",
      unit: "kHz",
      defaultValue: 75,
      min: 1e-3,
      tooltip: "Peak frequency deviation of the FM signal",
      presets: [
        { label: "Narrow FM (\xB15 kHz)", values: { frequencyDeviation: 5 } },
        { label: "Wide FM (\xB175 kHz)", values: { frequencyDeviation: 75 } }
      ]
    },
    {
      key: "messageFreq",
      label: "Message Frequency",
      symbol: "f_m",
      unit: "kHz",
      defaultValue: 15,
      min: 1e-3,
      tooltip: "Highest modulating signal frequency"
    },
    {
      key: "carrierFreq",
      label: "Carrier Frequency",
      symbol: "f_c",
      unit: "MHz",
      defaultValue: 100,
      min: 1e-3,
      tooltip: "Carrier frequency (informational)"
    }
  ],
  outputs: [
    {
      key: "modulationIndex",
      label: "Modulation Index (\u03B2)",
      symbol: "\u03B2",
      unit: "",
      precision: 3
    },
    {
      key: "carsonBandwidth",
      label: "Carson's Rule Bandwidth",
      symbol: "BW_Carson",
      unit: "kHz",
      precision: 2
    },
    {
      key: "besselBandwidth",
      label: "Bessel Bandwidth",
      symbol: "BW_Bessel",
      unit: "kHz",
      precision: 2
    },
    {
      key: "snrImprovement",
      label: "SNR Improvement",
      symbol: "\u0394SNR",
      unit: "dB",
      precision: 2,
      tooltip: "FM SNR improvement over AM: 10\xB7log\u2081\u2080(3\u03B2\xB2(\u03B2+1))"
    }
  ],
  calculate: calculateFmModulationIndex,
  formula: {
    primary: "\u03B2 = \u0394f / f_m;  BW = 2(\u0394f + f_m)",
    variables: [
      { symbol: "\u03B2", description: "FM modulation index", unit: "" },
      { symbol: "\u0394f", description: "Peak frequency deviation", unit: "Hz" },
      { symbol: "f_m", description: "Modulating signal frequency", unit: "Hz" },
      { symbol: "BW", description: "Bandwidth (Carson's rule)", unit: "Hz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["am-modulation-index", "snr-calculator", "sampling-nyquist"]
};

// src/lib/calculators/signal/oversampling-snr.ts
function calculateOversamplingSnr(inputs) {
  const { bits, oversamplingRatio, noiseShapingOrder } = inputs;
  const OSR = Math.max(oversamplingRatio, 1);
  const L = Math.round(noiseShapingOrder);
  const baseSnr = 6.02 * bits + 1.76;
  let oversampledSnr;
  if (L <= 0) {
    oversampledSnr = baseSnr + 10 * Math.log10(OSR);
  } else {
    const shapingGain = -10 * Math.log10(Math.pow(Math.PI, 2 * L) / (2 * L + 1)) + (2 * L + 1) * 10 * Math.log10(OSR);
    oversampledSnr = baseSnr + shapingGain;
  }
  const snrImprovement = oversampledSnr - baseSnr;
  const effectiveBits = (oversampledSnr - 1.76) / 6.02;
  return {
    values: {
      baseSnr,
      oversampledSnr,
      effectiveBits,
      snrImprovement
    }
  };
}
var oversamplingSnr = {
  slug: "oversampling-snr",
  title: "Oversampling & Noise Shaping SNR Calculator",
  shortTitle: "Oversampling & Noise Shaping",
  category: "signal",
  description: "Calculate SNR improvement from oversampling and noise shaping for sigma-delta ADCs, including effective bits gained from higher OSR",
  keywords: [
    "oversampling",
    "noise shaping",
    "sigma-delta",
    "OSR",
    "ADC resolution improvement",
    "delta-sigma",
    "effective bits",
    "quantization noise"
  ],
  inputs: [
    {
      key: "bits",
      label: "Base ADC Resolution",
      symbol: "N",
      unit: "bits",
      defaultValue: 12,
      min: 1,
      max: 24,
      step: 1,
      tooltip: "Underlying quantizer resolution"
    },
    {
      key: "oversamplingRatio",
      label: "Oversampling Ratio",
      symbol: "OSR",
      unit: "",
      defaultValue: 64,
      min: 1,
      step: 1,
      tooltip: "Ratio of sampling rate to Nyquist rate",
      presets: [
        { label: "OSR=4", values: { oversamplingRatio: 4 } },
        { label: "OSR=16", values: { oversamplingRatio: 16 } },
        { label: "OSR=64", values: { oversamplingRatio: 64 } },
        { label: "OSR=256", values: { oversamplingRatio: 256 } }
      ]
    },
    {
      key: "noiseShapingOrder",
      label: "Noise Shaping Order",
      symbol: "L",
      unit: "",
      defaultValue: 1,
      min: 0,
      max: 5,
      step: 1,
      tooltip: "0 = no shaping (simple oversampling), 1 = 1st order, 2 = 2nd order, etc.",
      presets: [
        { label: "None (0)", values: { noiseShapingOrder: 0 } },
        { label: "1st order", values: { noiseShapingOrder: 1 } },
        { label: "2nd order", values: { noiseShapingOrder: 2 } },
        { label: "3rd order", values: { noiseShapingOrder: 3 } }
      ]
    }
  ],
  outputs: [
    {
      key: "baseSnr",
      label: "Base SNR (Nyquist)",
      symbol: "SNR_base",
      unit: "dB",
      precision: 2
    },
    {
      key: "oversampledSnr",
      label: "Oversampled SNR",
      symbol: "SNR_os",
      unit: "dB",
      precision: 2
    },
    {
      key: "effectiveBits",
      label: "Effective Bits",
      symbol: "ENOB",
      unit: "bits",
      precision: 2
    },
    {
      key: "snrImprovement",
      label: "SNR Improvement",
      symbol: "\u0394SNR",
      unit: "dB",
      precision: 2
    }
  ],
  calculate: calculateOversamplingSnr,
  formula: {
    primary: "SNR_os = SNR_base + 10\xB7log\u2081\u2080(\u03C0\xB2\u1D38/(2L+1)) + (2L+1)\xB710\xB7log\u2081\u2080(OSR)",
    variables: [
      { symbol: "N", description: "ADC resolution", unit: "bits" },
      { symbol: "OSR", description: "Oversampling ratio", unit: "" },
      { symbol: "L", description: "Noise shaping order", unit: "" },
      { symbol: "SNR", description: "Signal-to-noise ratio", unit: "dB" },
      { symbol: "ENOB", description: "Effective number of bits", unit: "bits" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["adc-snr", "sampling-nyquist", "snr-calculator"]
};

// src/lib/calculators/signal/digital-filter-order.ts
function calculateDigitalFilterOrder(inputs) {
  const { passbandFreq, stopbandFreq, passbandRipple, stopbandAttenuation } = inputs;
  const Ap = passbandRipple;
  const As = stopbandAttenuation;
  const Omega_p = Math.max(passbandFreq, 1);
  const Omega_s = Math.max(stopbandFreq, 1);
  const transitionRatio = Omega_s / Omega_p;
  const eps2_p = Math.pow(10, Ap / 10) - 1;
  const eps2_s = Math.pow(10, As / 10) - 1;
  const ratio = eps2_s / Math.max(eps2_p, 1e-15);
  const butterworthOrder = Math.ceil(
    Math.log10(Math.max(ratio, 1e-15)) / (2 * Math.log10(Math.max(transitionRatio, 1.0001)))
  );
  const acosh = (x) => Math.log(x + Math.sqrt(x * x - 1));
  const chebyshevOrder = Math.ceil(
    acosh(Math.sqrt(Math.max(ratio, 1))) / acosh(Math.max(transitionRatio, 1.0001))
  );
  const ellipticOrder = Math.max(1, Math.ceil(chebyshevOrder / 1.5));
  return {
    values: {
      butterworthOrder: Math.max(1, butterworthOrder),
      chebyshevOrder: Math.max(1, chebyshevOrder),
      ellipticOrder: Math.max(1, ellipticOrder),
      transitionRatio
    }
  };
}
var digitalFilterOrder = {
  slug: "digital-filter-order",
  title: "Digital Filter Order Calculator",
  shortTitle: "Filter Order Calculator",
  category: "signal",
  description: "Calculate minimum filter order for Butterworth, Chebyshev, and elliptic (Cauer) low-pass filters given passband ripple and stopband attenuation requirements",
  keywords: [
    "filter order",
    "Butterworth filter",
    "Chebyshev filter",
    "elliptic filter",
    "filter design",
    "low pass filter",
    "stopband attenuation",
    "passband ripple"
  ],
  inputs: [
    {
      key: "passbandFreq",
      label: "Passband Edge Frequency",
      symbol: "f_p",
      unit: "Hz",
      defaultValue: 1e3,
      min: 1,
      tooltip: "Frequency where passband ripple specification is met"
    },
    {
      key: "stopbandFreq",
      label: "Stopband Edge Frequency",
      symbol: "f_s",
      unit: "Hz",
      defaultValue: 2e3,
      min: 1,
      tooltip: "Frequency where stopband attenuation must be achieved"
    },
    {
      key: "passbandRipple",
      label: "Passband Ripple",
      symbol: "A_p",
      unit: "dB",
      defaultValue: 3,
      min: 0.01,
      tooltip: "Maximum allowed ripple in the passband (typically 0.1\u20133 dB)"
    },
    {
      key: "stopbandAttenuation",
      label: "Stopband Attenuation",
      symbol: "A_s",
      unit: "dB",
      defaultValue: 40,
      min: 1,
      tooltip: "Minimum attenuation required in the stopband"
    }
  ],
  outputs: [
    {
      key: "butterworthOrder",
      label: "Butterworth Order",
      symbol: "n_BW",
      unit: "",
      precision: 0
    },
    {
      key: "chebyshevOrder",
      label: "Chebyshev Order",
      symbol: "n_CH",
      unit: "",
      precision: 0
    },
    {
      key: "ellipticOrder",
      label: "Elliptic Order (approx)",
      symbol: "n_EL",
      unit: "",
      precision: 0
    },
    {
      key: "transitionRatio",
      label: "Transition Ratio",
      symbol: "\u03A9s/\u03A9p",
      unit: "",
      precision: 3
    }
  ],
  calculate: calculateDigitalFilterOrder,
  formula: {
    primary: "n_BW = log\u2081\u2080(\u03B5_s/\u03B5_p) / (2\xB7log\u2081\u2080(\u03A9s/\u03A9p))",
    variables: [
      { symbol: "n", description: "Filter order", unit: "" },
      { symbol: "A_p", description: "Passband ripple", unit: "dB" },
      { symbol: "A_s", description: "Stopband attenuation", unit: "dB" },
      { symbol: "\u03A9s/\u03A9p", description: "Transition ratio", unit: "" },
      { symbol: "\u03B5", description: "Ripple factor (\u221A(10^(A/10)\u22121))", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["filter-designer", "sampling-nyquist", "fft-bin-resolution"]
};

// src/lib/calculators/antenna/yagi-antenna.ts
function calculateYagiAntenna(inputs) {
  const { frequency, numElements, boomLength } = inputs;
  const f_MHz = Math.max(frequency, 1e-3);
  const N = Math.round(Math.min(Math.max(numElements, 2), 20));
  const lambda_m = 300 / f_MHz;
  const lambda_mm = lambda_m * 1e3;
  const driverLength = 0.47 * lambda_mm;
  const reflectorLength = 0.5 * lambda_mm;
  const directorLength = 0.45 * lambda_mm;
  const spacing = 0.2 * lambda_mm;
  const gain = 10 * Math.log10(0.8 * N) + 2.15;
  const impedance = Math.max(73 * (1 - 0.02 * (N - 1)), 10);
  return {
    values: {
      gain,
      driverLength,
      reflectorLength,
      directorLength,
      spacing,
      impedance
    }
  };
}
var yagiAntenna = {
  slug: "yagi-antenna",
  title: "Yagi-Uda Antenna Design Calculator",
  shortTitle: "Yagi-Uda Antenna",
  category: "antenna",
  description: "Calculate Yagi-Uda antenna element dimensions, gain, and impedance for a given frequency and number of elements",
  keywords: [
    "Yagi antenna",
    "Yagi-Uda",
    "directional antenna",
    "antenna elements",
    "antenna gain",
    "VHF UHF antenna",
    "beam antenna"
  ],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 144,
      min: 1,
      tooltip: "Operating frequency in MHz",
      presets: [
        { label: "144 MHz (2m)", values: { frequency: 144 } },
        { label: "433 MHz (70cm)", values: { frequency: 433 } },
        { label: "1296 MHz (23cm)", values: { frequency: 1296 } }
      ]
    },
    {
      key: "numElements",
      label: "Number of Elements",
      symbol: "N",
      unit: "",
      defaultValue: 5,
      min: 2,
      max: 20,
      step: 1,
      tooltip: "Total number of elements including reflector, driver, and directors"
    },
    {
      key: "boomLength",
      label: "Boom Length",
      symbol: "L_boom",
      unit: "m",
      defaultValue: 1,
      min: 0.01,
      tooltip: "Physical boom length (informational for layout)"
    }
  ],
  outputs: [
    {
      key: "gain",
      label: "Estimated Gain",
      symbol: "G",
      unit: "dBi",
      precision: 2
    },
    {
      key: "driverLength",
      label: "Driver (Dipole) Length",
      symbol: "L_D",
      unit: "mm",
      precision: 1
    },
    {
      key: "reflectorLength",
      label: "Reflector Length",
      symbol: "L_R",
      unit: "mm",
      precision: 1
    },
    {
      key: "directorLength",
      label: "Director Length",
      symbol: "L_d",
      unit: "mm",
      precision: 1
    },
    {
      key: "spacing",
      label: "Element Spacing (0.2\u03BB)",
      symbol: "s",
      unit: "mm",
      precision: 1
    },
    {
      key: "impedance",
      label: "Feed Impedance (approx)",
      symbol: "Z_in",
      unit: "\u03A9",
      precision: 1
    }
  ],
  calculate: calculateYagiAntenna,
  formula: {
    primary: "\u03BB = 300/f;  G \u2248 10\xB7log\u2081\u2080(0.8\xB7N) + 2.15 dBi",
    variables: [
      { symbol: "\u03BB", description: "Wavelength", unit: "m" },
      { symbol: "f", description: "Frequency", unit: "MHz" },
      { symbol: "N", description: "Number of elements", unit: "" },
      { symbol: "G", description: "Gain", unit: "dBi" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["dipole-antenna", "eirp-calculator", "patch-antenna"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ]
};

// src/lib/calculators/antenna/horn-antenna.ts
function calculateHornAntenna(inputs) {
  const { frequency, apertureWidth, apertureHeight } = inputs;
  const f_Hz = frequency * 1e9;
  const c = 3e8;
  const lambda_m = c / f_Hz;
  const lambda_mm = lambda_m * 1e3;
  const W_m = apertureWidth * 1e-3;
  const H_m = apertureHeight * 1e-3;
  const A_m2 = W_m * H_m;
  const efficiency = 0.5;
  const gain = 10 * Math.log10(
    4 * Math.PI * efficiency * A_m2 / Math.max(lambda_m * lambda_m, 1e-30)
  );
  const hpbwE = 51 * lambda_mm / Math.max(apertureHeight, 1e-3);
  const hpbwH = 67 * lambda_mm / Math.max(apertureWidth, 1e-3);
  const effectiveArea = efficiency * A_m2 * 1e4;
  return {
    values: {
      gain,
      hpbwE,
      hpbwH,
      effectiveArea,
      wavelength: lambda_mm
    }
  };
}
var hornAntenna = {
  slug: "horn-antenna",
  title: "Horn Antenna Gain & Beamwidth Calculator",
  shortTitle: "Horn Antenna",
  category: "antenna",
  description: "Calculate pyramidal horn antenna gain, E-plane and H-plane half-power beamwidths, and effective aperture area for microwave applications",
  keywords: [
    "horn antenna",
    "aperture antenna",
    "gain",
    "beamwidth",
    "microwave antenna",
    "pyramidal horn",
    "HPBW",
    "aperture efficiency"
  ],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "GHz",
      defaultValue: 10,
      min: 0.1,
      tooltip: "Operating frequency in GHz",
      presets: [
        { label: "X-band (10 GHz)", values: { frequency: 10 } },
        { label: "Ku-band (15 GHz)", values: { frequency: 15 } },
        { label: "Ka-band (30 GHz)", values: { frequency: 30 } }
      ]
    },
    {
      key: "apertureWidth",
      label: "Aperture Width (H-plane)",
      symbol: "a",
      unit: "mm",
      defaultValue: 50,
      min: 1,
      tooltip: "Aperture dimension in the H-plane (horizontal)"
    },
    {
      key: "apertureHeight",
      label: "Aperture Height (E-plane)",
      symbol: "b",
      unit: "mm",
      defaultValue: 40,
      min: 1,
      tooltip: "Aperture dimension in the E-plane (vertical)"
    }
  ],
  outputs: [
    {
      key: "gain",
      label: "Gain",
      symbol: "G",
      unit: "dBi",
      precision: 2
    },
    {
      key: "hpbwE",
      label: "HPBW (E-plane)",
      symbol: "\u03B8_E",
      unit: "degrees",
      precision: 2
    },
    {
      key: "hpbwH",
      label: "HPBW (H-plane)",
      symbol: "\u03B8_H",
      unit: "degrees",
      precision: 2
    },
    {
      key: "effectiveArea",
      label: "Effective Aperture Area",
      symbol: "A_eff",
      unit: "cm\xB2",
      precision: 3
    },
    {
      key: "wavelength",
      label: "Wavelength",
      symbol: "\u03BB",
      unit: "mm",
      precision: 3
    }
  ],
  calculate: calculateHornAntenna,
  formula: {
    primary: "G = 10\xB7log\u2081\u2080(4\u03C0\xB7\u03B7\xB7A/\u03BB\xB2)",
    variables: [
      { symbol: "G", description: "Gain", unit: "dBi" },
      { symbol: "\u03B7", description: "Aperture efficiency (\u22480.5)", unit: "" },
      { symbol: "A", description: "Aperture area (W\xD7H)", unit: "m\xB2" },
      { symbol: "\u03BB", description: "Wavelength (c/f)", unit: "m" },
      { symbol: "\u03B8_E", description: "E-plane HPBW \u2248 51\u03BB/H", unit: "degrees" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["parabolic-dish-antenna", "eirp-calculator", "antenna-beamwidth"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" }
  ]
};

// src/lib/calculators/antenna/parabolic-dish-antenna.ts
function calculateParabolicDishAntenna(inputs) {
  const { frequency, diameter, efficiency } = inputs;
  const lambda_m = 0.3 / Math.max(frequency, 1e-6);
  const eta = efficiency / 100;
  const radius = diameter / 2;
  const A_physical = Math.PI * radius * radius;
  const effectiveArea = eta * A_physical;
  const gain = 10 * Math.log10(
    4 * Math.PI * effectiveArea / Math.max(lambda_m * lambda_m, 1e-30)
  );
  const hpbw = 70 * lambda_m / Math.max(diameter, 1e-3);
  const noiseTemperature = 290 * (1 - eta);
  return {
    values: {
      gain,
      hpbw,
      effectiveArea,
      noiseTemperature
    }
  };
}
var parabolicDishAntenna = {
  slug: "parabolic-dish-antenna",
  title: "Parabolic Dish Antenna Calculator",
  shortTitle: "Parabolic Dish",
  category: "antenna",
  description: "Calculate parabolic dish antenna gain, half-power beamwidth (HPBW), effective aperture area, and noise temperature for satellite and microwave links",
  keywords: [
    "parabolic dish",
    "satellite antenna",
    "dish gain",
    "aperture efficiency",
    "HPBW",
    "dish antenna",
    "G/T ratio",
    "satellite dish"
  ],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "GHz",
      defaultValue: 12,
      min: 0.1,
      tooltip: "Operating frequency in GHz",
      presets: [
        { label: "C-band (4 GHz)", values: { frequency: 4 } },
        { label: "Ku-band (12 GHz)", values: { frequency: 12 } },
        { label: "Ka-band (20 GHz)", values: { frequency: 20 } }
      ]
    },
    {
      key: "diameter",
      label: "Dish Diameter",
      symbol: "D",
      unit: "m",
      defaultValue: 1.2,
      min: 0.01,
      tooltip: "Reflector diameter in meters"
    },
    {
      key: "efficiency",
      label: "Aperture Efficiency",
      symbol: "\u03B7",
      unit: "%",
      defaultValue: 55,
      min: 1,
      max: 100,
      tooltip: "Typical values: 50\u201365% for commercial dishes"
    }
  ],
  outputs: [
    {
      key: "gain",
      label: "Antenna Gain",
      symbol: "G",
      unit: "dBi",
      precision: 2
    },
    {
      key: "hpbw",
      label: "Half-Power Beamwidth",
      symbol: "HPBW",
      unit: "degrees",
      precision: 3
    },
    {
      key: "effectiveArea",
      label: "Effective Aperture Area",
      symbol: "A_eff",
      unit: "m\xB2",
      precision: 4
    },
    {
      key: "noiseTemperature",
      label: "Antenna Noise Temperature",
      symbol: "T_ant",
      unit: "K",
      precision: 1
    }
  ],
  calculate: calculateParabolicDishAntenna,
  formula: {
    primary: "G = 10\xB7log\u2081\u2080(4\u03C0\xB7\u03B7\xB7A/\u03BB\xB2);  HPBW \u2248 70\u03BB/D",
    variables: [
      { symbol: "G", description: "Antenna gain", unit: "dBi" },
      { symbol: "\u03B7", description: "Aperture efficiency", unit: "" },
      { symbol: "D", description: "Dish diameter", unit: "m" },
      { symbol: "\u03BB", description: "Wavelength (0.3/f_GHz)", unit: "m" },
      { symbol: "HPBW", description: "Half-power beamwidth", unit: "degrees" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["horn-antenna", "eirp-calculator", "rf-link-budget"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" }
  ]
};

// src/lib/calculators/antenna/loop-antenna.ts
function calculateLoopAntenna(inputs) {
  const { frequency, diameter, conductorDiam } = inputs;
  const f_Hz = frequency * 1e6;
  const lambda_m = 300 / Math.max(frequency, 1e-9);
  const c = Math.PI * diameter;
  const A_m2 = Math.PI * Math.pow(diameter / 2, 2);
  const Rrad = 31171 * Math.pow(A_m2 / Math.max(lambda_m * lambda_m, 1e-30), 2);
  const sigma = 58e6;
  const mu0 = 4 * Math.PI * 1e-7;
  const Rs = Math.sqrt(Math.PI * f_Hz * mu0 / sigma);
  const conductorRadius_m = conductorDiam * 1e-3 / 2;
  const lossResistance = c / (2 * Math.PI * conductorRadius_m) * Rs;
  const gain = 1.76;
  const omega = 2 * Math.PI * f_Hz;
  const r_loop = diameter / 2;
  const a_wire = conductorRadius_m;
  const L_H = mu0 * r_loop * (Math.log(8 * r_loop / Math.max(a_wire, 1e-9)) - 2);
  const X_L = omega * L_H;
  const Q = X_L / Math.max(Rrad + lossResistance, 1e-30);
  const bandwidth = frequency * 1e3 / Math.max(Q, 1e-3);
  return {
    values: {
      circumference: c,
      radiation_resistance: Rrad,
      loss_resistance: lossResistance,
      gain,
      bandwidth
    }
  };
}
var loopAntenna = {
  slug: "loop-antenna",
  title: "Loop Antenna Calculator",
  shortTitle: "Loop Antenna",
  category: "antenna",
  description: "Calculate small loop antenna radiation resistance, loss resistance, gain, Q factor, and operating bandwidth for HF and VHF applications",
  keywords: [
    "loop antenna",
    "magnetic loop",
    "small loop antenna",
    "radiation resistance",
    "Q factor",
    "HF antenna",
    "magnetic loop antenna"
  ],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 7,
      min: 0.1,
      tooltip: "Operating frequency in MHz",
      presets: [
        { label: "3.5 MHz (80m)", values: { frequency: 3.5 } },
        { label: "7 MHz (40m)", values: { frequency: 7 } },
        { label: "14 MHz (20m)", values: { frequency: 14 } },
        { label: "28 MHz (10m)", values: { frequency: 28 } }
      ]
    },
    {
      key: "diameter",
      label: "Loop Diameter",
      symbol: "D",
      unit: "m",
      defaultValue: 1,
      min: 0.01,
      tooltip: "Diameter of the loop structure in meters"
    },
    {
      key: "conductorDiam",
      label: "Conductor Diameter",
      symbol: "d",
      unit: "mm",
      defaultValue: 10,
      min: 0.1,
      tooltip: "Diameter of the conductor tube or wire in mm"
    }
  ],
  outputs: [
    {
      key: "circumference",
      label: "Loop Circumference",
      symbol: "C",
      unit: "m",
      precision: 3
    },
    {
      key: "radiation_resistance",
      label: "Radiation Resistance",
      symbol: "R_rad",
      unit: "\u03A9",
      precision: 6,
      format: "engineering"
    },
    {
      key: "loss_resistance",
      label: "Loss Resistance",
      symbol: "R_loss",
      unit: "\u03A9",
      precision: 4
    },
    {
      key: "gain",
      label: "Gain (small loop)",
      symbol: "G",
      unit: "dBi",
      precision: 2
    },
    {
      key: "bandwidth",
      label: "-3 dB Bandwidth",
      symbol: "BW",
      unit: "kHz",
      precision: 3
    }
  ],
  calculate: calculateLoopAntenna,
  formula: {
    primary: "R_rad = 31171\xB7(A/\u03BB\xB2)\xB2",
    variables: [
      { symbol: "R_rad", description: "Radiation resistance", unit: "\u03A9" },
      { symbol: "A", description: "Loop area (\u03C0\xB7(D/2)\xB2)", unit: "m\xB2" },
      { symbol: "\u03BB", description: "Wavelength (300/f)", unit: "m" },
      { symbol: "Q", description: "Quality factor", unit: "" },
      { symbol: "BW", description: "Bandwidth (f/Q)", unit: "Hz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["dipole-antenna", "q-factor", "antenna-beamwidth"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" }
  ]
};

// src/lib/calculators/protocol/spi-timing.ts
function calculateSpiTiming(inputs) {
  const { clockFreq, dataWidth, traceCapacitance, driveStrength } = inputs;
  const f_MHz = Math.max(clockFreq, 1e-3);
  const bitPeriod = 1e3 / f_MHz;
  const framePeriod = dataWidth / f_MHz;
  const R_drive = 3.3 / Math.max(driveStrength * 1e-3, 1e-6);
  const C_load = traceCapacitance * 1e-12;
  const tau_s = R_drive * C_load;
  const tau_ns = tau_s * 1e9;
  const maxFreqCapacitive = 1 / (2 * 2.2 * tau_s) / 1e6;
  const slewRate = 3.3 / (2.2 * Math.max(tau_ns, 1e-12));
  const dataRate = f_MHz;
  return {
    values: {
      bitPeriod,
      framePeriod,
      maxFreqCapacitive,
      slewRate,
      dataRate
    }
  };
}
var spiTiming = {
  slug: "spi-timing",
  title: "SPI Timing & Signal Integrity Calculator",
  shortTitle: "SPI Timing",
  category: "protocol",
  description: "Calculate SPI bus timing parameters including bit period, frame time, maximum clock frequency limited by trace capacitance, and signal slew rate",
  keywords: [
    "SPI timing",
    "SPI clock",
    "serial peripheral interface",
    "SPI frequency",
    "signal integrity",
    "slew rate",
    "RC time constant",
    "digital timing"
  ],
  inputs: [
    {
      key: "clockFreq",
      label: "SPI Clock Frequency",
      symbol: "f_CLK",
      unit: "MHz",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "SPI SCLK frequency in MHz",
      presets: [
        { label: "1 MHz", values: { clockFreq: 1 } },
        { label: "10 MHz", values: { clockFreq: 10 } },
        { label: "40 MHz", values: { clockFreq: 40 } }
      ]
    },
    {
      key: "dataWidth",
      label: "Data Word Width",
      symbol: "N",
      unit: "bits",
      defaultValue: 8,
      min: 1,
      max: 32,
      step: 1,
      tooltip: "Number of data bits per SPI frame",
      presets: [
        { label: "8-bit", values: { dataWidth: 8 } },
        { label: "16-bit", values: { dataWidth: 16 } },
        { label: "32-bit", values: { dataWidth: 32 } }
      ]
    },
    {
      key: "traceCapacitance",
      label: "Trace Capacitance",
      symbol: "C_trace",
      unit: "pF",
      defaultValue: 20,
      min: 0.1,
      tooltip: "Estimated total capacitive load on the signal line (PCB trace + receiver)"
    },
    {
      key: "driveStrength",
      label: "Drive Strength",
      symbol: "I_drive",
      unit: "mA",
      defaultValue: 4,
      min: 0.1,
      tooltip: "GPIO output drive current capability in mA"
    }
  ],
  outputs: [
    {
      key: "bitPeriod",
      label: "Bit Period",
      symbol: "t_bit",
      unit: "ns",
      precision: 3
    },
    {
      key: "framePeriod",
      label: "Frame Period",
      symbol: "t_frame",
      unit: "\u03BCs",
      precision: 4
    },
    {
      key: "maxFreqCapacitive",
      label: "Max Freq (RC-limited)",
      symbol: "f_max",
      unit: "MHz",
      precision: 2,
      thresholds: {
        good: { min: 20 },
        warning: { min: 5, max: 20 },
        danger: { max: 5 }
      }
    },
    {
      key: "slewRate",
      label: "Signal Slew Rate",
      symbol: "SR",
      unit: "V/ns",
      precision: 3
    },
    {
      key: "dataRate",
      label: "Data Rate",
      symbol: "f_data",
      unit: "Mbps",
      precision: 3
    }
  ],
  calculate: calculateSpiTiming,
  formula: {
    primary: "t_bit = 1/f_CLK;  \u03C4 = R_drive\xB7C_trace;  f_max = 1/(4.4\u03C4)",
    variables: [
      { symbol: "t_bit", description: "Bit period", unit: "ns" },
      { symbol: "\u03C4", description: "RC time constant", unit: "ns" },
      { symbol: "R_drive", description: "Drive output impedance (3.3V/I_drive)", unit: "\u03A9" },
      { symbol: "C_trace", description: "Total trace capacitance", unit: "F" },
      { symbol: "f_max", description: "Maximum clock frequency", unit: "Hz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["can-bus-timing", "uart-baud-rate", "i2c-pullup"]
};

// src/lib/calculators/protocol/can-bus-timing.ts
function calculateCanBusTiming(inputs) {
  const { clockFreq, baudRate, samplePoint } = inputs;
  const f_Hz = clockFreq * 1e6;
  const baud_bps = baudRate * 1e3;
  const tq_ns = 1 / f_Hz * 1e9;
  const targetTQ = 16;
  const prescaler = Math.max(1, Math.round(f_Hz / (baud_bps * targetTQ)));
  const actualTQ = Math.round(f_Hz / (baud_bps * Math.max(prescaler, 1)));
  const syncSeg = 1;
  const samplePointTQ = Math.round(actualTQ * samplePoint / 100);
  const phase2 = Math.max(1, actualTQ - samplePointTQ);
  const beforeSample = samplePointTQ - syncSeg;
  const propSeg = Math.max(1, Math.floor(beforeSample / 2));
  const phase1 = Math.max(1, beforeSample - propSeg);
  return {
    values: {
      tq: tq_ns * prescaler,
      // effective TQ length with prescaler
      nominalBitTime: actualTQ,
      syncSeg,
      propSeg,
      phase1,
      phase2,
      prescaler
    }
  };
}
var canBusTiming = {
  slug: "can-bus-timing",
  title: "CAN Bus Bit Timing Calculator",
  shortTitle: "CAN Bus Timing",
  category: "protocol",
  description: "Calculate CAN bus bit timing parameters including prescaler, time quanta, sync segment, propagation segment, and phase buffer segments for a given baud rate and sample point",
  keywords: [
    "CAN bus timing",
    "bit timing",
    "CAN baud rate",
    "prescaler",
    "sample point",
    "CAN FD",
    "time quantum",
    "CAN controller"
  ],
  inputs: [
    {
      key: "clockFreq",
      label: "System Clock Frequency",
      symbol: "f_clk",
      unit: "MHz",
      defaultValue: 48,
      min: 1,
      tooltip: "Microcontroller peripheral clock frequency feeding the CAN controller",
      presets: [
        { label: "8 MHz", values: { clockFreq: 8 } },
        { label: "16 MHz", values: { clockFreq: 16 } },
        { label: "48 MHz", values: { clockFreq: 48 } },
        { label: "80 MHz", values: { clockFreq: 80 } }
      ]
    },
    {
      key: "baudRate",
      label: "CAN Baud Rate",
      symbol: "f_baud",
      unit: "kbps",
      defaultValue: 500,
      min: 1,
      tooltip: "Target CAN bus baud rate",
      presets: [
        { label: "125 kbps", values: { baudRate: 125 } },
        { label: "250 kbps", values: { baudRate: 250 } },
        { label: "500 kbps", values: { baudRate: 500 } },
        { label: "1 Mbps", values: { baudRate: 1e3 } }
      ]
    },
    {
      key: "samplePoint",
      label: "Sample Point",
      symbol: "SP",
      unit: "%",
      defaultValue: 87.5,
      min: 50,
      max: 95,
      tooltip: "Sample point position as percentage of bit time (CiA 601 recommends 75\u201387.5%)"
    }
  ],
  outputs: [
    {
      key: "tq",
      label: "Time Quantum (TQ)",
      symbol: "tq",
      unit: "ns",
      precision: 2
    },
    {
      key: "nominalBitTime",
      label: "Nominal Bit Time",
      symbol: "NBT",
      unit: "tq",
      precision: 0
    },
    {
      key: "syncSeg",
      label: "Sync Segment",
      symbol: "SS",
      unit: "tq",
      precision: 0
    },
    {
      key: "propSeg",
      label: "Propagation Segment",
      symbol: "PROP",
      unit: "tq",
      precision: 0
    },
    {
      key: "phase1",
      label: "Phase Buffer 1 (BS1)",
      symbol: "BS1",
      unit: "tq",
      precision: 0
    },
    {
      key: "phase2",
      label: "Phase Buffer 2 (BS2)",
      symbol: "BS2",
      unit: "tq",
      precision: 0
    },
    {
      key: "prescaler",
      label: "Prescaler",
      symbol: "BRP",
      unit: "",
      precision: 0
    }
  ],
  calculate: calculateCanBusTiming,
  formula: {
    primary: "tq = 1/(f_clk/BRP);  NBT = SS + PROP + BS1 + BS2",
    variables: [
      { symbol: "tq", description: "Time quantum", unit: "ns" },
      { symbol: "BRP", description: "Baud rate prescaler", unit: "" },
      { symbol: "NBT", description: "Nominal bit time in TQ", unit: "tq" },
      { symbol: "SS", description: "Sync segment (1 tq)", unit: "tq" },
      { symbol: "BS1", description: "Phase buffer segment 1", unit: "tq" },
      { symbol: "BS2", description: "Phase buffer segment 2", unit: "tq" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["spi-timing", "uart-baud-rate", "i2c-pullup"]
};

// src/lib/calculators/protocol/usb-termination.ts
function calculateUsbTermination(inputs) {
  const { usbVersion, lineImpedance, cableLength } = inputs;
  const terminationResistor = lineImpedance;
  const differentialImpedance = usbVersion === 0 ? 90 : 90;
  const propagationDelay = cableLength / 2e8 * 1e9;
  const signalRiseTime = usbVersion === 0 ? 500 : 125;
  const bitPeriod_ps = usbVersion === 0 ? 2083 : 400;
  const delay_ps = propagationDelay * 1e3;
  const eyeOpening = Math.max(0, 100 - 2 * delay_ps / bitPeriod_ps * 100);
  return {
    values: {
      terminationResistor,
      differentialImpedance,
      propagationDelay,
      signalRiseTime,
      eyeOpening
    }
  };
}
var usbTermination = {
  slug: "usb-termination",
  title: "USB Termination & Signal Integrity Calculator",
  shortTitle: "USB Termination",
  category: "protocol",
  description: "Calculate USB bus termination resistor values, differential impedance, cable propagation delay, signal rise time, and eye opening for USB 2.0 and USB 3.0",
  keywords: [
    "USB termination",
    "USB impedance",
    "USB signal integrity",
    "USB 2.0",
    "USB 3.0",
    "differential impedance",
    "eye diagram",
    "propagation delay"
  ],
  inputs: [
    {
      key: "usbVersion",
      label: "USB Version",
      symbol: "ver",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 1,
      presets: [
        { label: "USB 2.0 (HS 480 Mbps)", values: { usbVersion: 0 } },
        { label: "USB 3.0 (SS 2.5 Gbps)", values: { usbVersion: 1 } }
      ]
    },
    {
      key: "lineImpedance",
      label: "Line Impedance",
      symbol: "Z\u2080",
      unit: "\u03A9",
      defaultValue: 90,
      min: 50,
      max: 150,
      tooltip: "Single-ended trace/cable impedance (USB spec: 90\u03A9 differential = ~45\u03A9 per line)"
    },
    {
      key: "cableLength",
      label: "Cable Length",
      symbol: "L",
      unit: "m",
      defaultValue: 2,
      min: 0.01,
      tooltip: "USB cable length in meters",
      presets: [
        { label: "0.5 m", values: { cableLength: 0.5 } },
        { label: "2 m", values: { cableLength: 2 } },
        { label: "5 m (USB 2.0 max)", values: { cableLength: 5 } }
      ]
    }
  ],
  outputs: [
    {
      key: "terminationResistor",
      label: "Termination Resistor",
      symbol: "R_term",
      unit: "\u03A9",
      precision: 1
    },
    {
      key: "differentialImpedance",
      label: "Differential Impedance",
      symbol: "Z_diff",
      unit: "\u03A9",
      precision: 1
    },
    {
      key: "propagationDelay",
      label: "Cable Propagation Delay",
      symbol: "t_pd",
      unit: "ns",
      precision: 2
    },
    {
      key: "signalRiseTime",
      label: "Signal Rise Time (spec)",
      symbol: "t_r",
      unit: "ps",
      precision: 0
    },
    {
      key: "eyeOpening",
      label: "Estimated Eye Opening",
      symbol: "EYE",
      unit: "%",
      precision: 1,
      thresholds: {
        good: { min: 50 },
        warning: { min: 20, max: 50 },
        danger: { max: 20 }
      }
    }
  ],
  calculate: calculateUsbTermination,
  formula: {
    primary: "R_term = Z\u2080;  t_pd = L/v_prop",
    variables: [
      { symbol: "R_term", description: "Termination resistor", unit: "\u03A9" },
      { symbol: "Z\u2080", description: "Characteristic impedance", unit: "\u03A9" },
      { symbol: "t_pd", description: "Propagation delay", unit: "ns" },
      { symbol: "v_prop", description: "Signal propagation velocity (~0.2c)", unit: "m/s" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["rs485-termination", "spi-timing", "can-bus-timing"]
};

// src/lib/calculators/protocol/rs485-termination.ts
function calculateRs485Termination(inputs) {
  const { baudRate, cableLength, numNodes, supplyVoltage } = inputs;
  const terminationResistor = 120;
  const biasResistor = Math.round((supplyVoltage - 0.2) / 0.054);
  const maxBaudRate = Math.min(1e4, 1e8 / Math.max(cableLength, 0.1));
  const propagationDelay = cableLength / 2e8 * 1e9;
  const loadCurrent = supplyVoltage / Math.max(biasResistor, 1) * 2 * 1e3;
  return {
    values: {
      terminationResistor,
      biasResistor,
      maxBaudRate,
      propagationDelay,
      loadCurrent
    }
  };
}
var rs485Termination = {
  slug: "rs485-termination",
  title: "RS-485 Termination & Bias Resistor Calculator",
  shortTitle: "RS-485 Termination",
  category: "protocol",
  description: "Calculate RS-485 bus termination resistors, bias resistors, maximum baud rate for cable length, propagation delay, and bias current consumption",
  keywords: [
    "RS-485 termination",
    "RS-485 impedance",
    "RS-485 bias resistors",
    "serial communications",
    "RS-485 cable",
    "Modbus",
    "half duplex",
    "differential bus"
  ],
  inputs: [
    {
      key: "baudRate",
      label: "Baud Rate",
      symbol: "BR",
      unit: "kbps",
      defaultValue: 115.2,
      min: 0.1,
      tooltip: "RS-485 communication baud rate in kbps",
      presets: [
        { label: "9.6 kbps", values: { baudRate: 9.6 } },
        { label: "115.2 kbps", values: { baudRate: 115.2 } },
        { label: "1 Mbps", values: { baudRate: 1e3 } }
      ]
    },
    {
      key: "cableLength",
      label: "Total Cable Length",
      symbol: "L",
      unit: "m",
      defaultValue: 100,
      min: 0.1,
      tooltip: "Total bus cable length in meters",
      presets: [
        { label: "10 m", values: { cableLength: 10 } },
        { label: "100 m", values: { cableLength: 100 } },
        { label: "500 m", values: { cableLength: 500 } },
        { label: "1200 m (RS-485 max)", values: { cableLength: 1200 } }
      ]
    },
    {
      key: "numNodes",
      label: "Number of Nodes",
      symbol: "N",
      unit: "",
      defaultValue: 10,
      min: 2,
      max: 256,
      step: 1,
      tooltip: "Total number of RS-485 devices on the bus (max 32 unit loads per driver)"
    },
    {
      key: "supplyVoltage",
      label: "Supply Voltage",
      symbol: "Vcc",
      unit: "V",
      defaultValue: 5,
      min: 3,
      max: 5.5,
      tooltip: "Logic supply voltage for the RS-485 transceivers"
    }
  ],
  outputs: [
    {
      key: "terminationResistor",
      label: "Termination Resistor",
      symbol: "R_term",
      unit: "\u03A9",
      precision: 0,
      tooltip: "Match to cable characteristic impedance (~120\u03A9 for twisted pair)"
    },
    {
      key: "biasResistor",
      label: "Bias Resistor",
      symbol: "R_bias",
      unit: "\u03A9",
      precision: 0,
      tooltip: "Failsafe bias resistors to maintain idle state differential voltage > 200 mV"
    },
    {
      key: "maxBaudRate",
      label: "Max Baud Rate for Cable Length",
      symbol: "BR_max",
      unit: "kbps",
      precision: 1,
      thresholds: {
        good: { min: 1e3 },
        warning: { min: 100, max: 1e3 },
        danger: { max: 100 }
      }
    },
    {
      key: "propagationDelay",
      label: "Cable Propagation Delay",
      symbol: "t_pd",
      unit: "ns",
      precision: 2
    },
    {
      key: "loadCurrent",
      label: "Bias Load Current",
      symbol: "I_bias",
      unit: "mA",
      precision: 3
    }
  ],
  calculate: calculateRs485Termination,
  formula: {
    primary: "R_term = 120 \u03A9;  R_bias = (Vcc \u2212 0.2) / 0.054",
    variables: [
      { symbol: "R_term", description: "Termination resistor (match to Z\u2080)", unit: "\u03A9" },
      { symbol: "R_bias", description: "Bias/failsafe resistor", unit: "\u03A9" },
      { symbol: "BR_max", description: "Max baud rate \u2248 10\u2078/L kbps", unit: "kbps" },
      { symbol: "t_pd", description: "Cable propagation delay", unit: "ns" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["usb-termination", "can-bus-timing", "uart-baud-rate"],
  exportComponents: (_inputs, outputs) => {
    const fmtR = (ohm) => ohm >= 1e3 ? `${+(ohm / 1e3).toPrecision(3)} k\u03A9` : `${+ohm.toPrecision(3)} \u03A9`;
    return [
      { qty: 1, description: "R (line termination)", value: fmtR(outputs?.terminationResistor ?? 120), package: "0402", componentType: "R", placement: "series" },
      { qty: 1, description: "R (bias)", value: fmtR(outputs?.biasResistor ?? 0), package: "0402", componentType: "R", placement: "shunt" }
    ];
  }
};

// src/lib/calculators/power/pwm-duty-cycle.ts
function calculatePwmDutyCycle(inputs) {
  const { onTime, period, supplyVoltage } = inputs;
  const safePeriod = Math.max(period, 1e-3);
  const safeOnTime = Math.min(onTime, safePeriod);
  const dutyCycle = safeOnTime / safePeriod * 100;
  const frequency = 1 / (safePeriod * 1e-6) / 1e3;
  const avgVoltage = supplyVoltage * dutyCycle / 100;
  const offTime = safePeriod - safeOnTime;
  const rmsVoltage = supplyVoltage * Math.sqrt(dutyCycle / 100);
  return {
    values: {
      dutyCycle,
      frequency,
      avgVoltage,
      offTime,
      rmsVoltage
    }
  };
}
var pwmDutyCycle = {
  slug: "pwm-duty-cycle",
  title: "PWM Duty Cycle Calculator",
  shortTitle: "PWM Duty Cycle",
  category: "power",
  description: "Calculate PWM duty cycle, frequency, average voltage, off-time, and RMS voltage from on-time and period parameters",
  keywords: [
    "PWM duty cycle",
    "pulse width modulation",
    "PWM frequency",
    "average voltage",
    "RMS voltage",
    "PWM signal",
    "digital control"
  ],
  inputs: [
    {
      key: "onTime",
      label: "On Time",
      symbol: "t_on",
      unit: "\u03BCs",
      defaultValue: 5,
      min: 1e-3,
      tooltip: "Duration the signal is high in each period"
    },
    {
      key: "period",
      label: "Period",
      symbol: "T",
      unit: "\u03BCs",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Total period of the PWM signal"
    },
    {
      key: "supplyVoltage",
      label: "Supply Voltage",
      symbol: "V_cc",
      unit: "V",
      defaultValue: 3.3,
      min: 0.1,
      tooltip: "High-level voltage of the PWM signal"
    }
  ],
  outputs: [
    {
      key: "dutyCycle",
      label: "Duty Cycle",
      symbol: "D",
      unit: "%",
      precision: 2,
      thresholds: {
        good: { min: 10, max: 90 },
        warning: { min: 1, max: 99 },
        danger: { max: 1 }
      }
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "kHz",
      precision: 3
    },
    {
      key: "avgVoltage",
      label: "Average Voltage",
      symbol: "V_avg",
      unit: "V",
      precision: 3
    },
    {
      key: "offTime",
      label: "Off Time",
      symbol: "t_off",
      unit: "\u03BCs",
      precision: 3
    },
    {
      key: "rmsVoltage",
      label: "RMS Voltage",
      symbol: "V_rms",
      unit: "V",
      precision: 3
    }
  ],
  calculate: calculatePwmDutyCycle,
  formula: {
    primary: "D = t_on / T \xD7 100%, V_avg = V_cc \xD7 D, V_rms = V_cc \xD7 \u221AD",
    variables: [
      { symbol: "D", description: "Duty cycle", unit: "%" },
      { symbol: "t_on", description: "On time", unit: "\u03BCs" },
      { symbol: "T", description: "Period", unit: "\u03BCs" },
      { symbol: "V_cc", description: "Supply voltage", unit: "V" },
      { symbol: "V_avg", description: "Average voltage", unit: "V" },
      { symbol: "V_rms", description: "RMS voltage", unit: "V" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["555-timer", "switching-regulator-ripple", "buck-converter"]
};

// src/lib/calculators/power/mosfet-power-dissipation.ts
function calculateMosfetPowerDissipation(inputs) {
  const { drainCurrent, rdson, vds, frequency, riseTime, fallTime, rthJA, tAmbient } = inputs;
  const rdson_Ohm = rdson / 1e3;
  const freq_Hz = frequency * 1e3;
  const trise_s = riseTime * 1e-9;
  const tfall_s = fallTime * 1e-9;
  const conductionLoss = drainCurrent * drainCurrent * rdson_Ohm * 1e3;
  const switchingLoss = 0.5 * vds * drainCurrent * (trise_s + tfall_s) * freq_Hz * 1e3;
  const totalLoss = conductionLoss + switchingLoss;
  const junctionTemp = tAmbient + totalLoss / 1e3 * rthJA;
  const inputPower = vds * drainCurrent * 1e3;
  const efficiency = Math.max(0, (inputPower - totalLoss) / Math.max(inputPower, 1e-3) * 100);
  return {
    values: {
      conductionLoss,
      switchingLoss,
      totalLoss,
      junctionTemp,
      efficiency
    }
  };
}
var mosfetPowerDissipation = {
  slug: "mosfet-power-dissipation",
  title: "MOSFET Power Dissipation Calculator",
  shortTitle: "MOSFET Power Loss",
  category: "power",
  description: "Calculate MOSFET conduction loss, switching loss, total power dissipation, junction temperature, and efficiency for power electronics design",
  keywords: [
    "MOSFET power loss",
    "conduction loss",
    "switching loss",
    "MOSFET efficiency",
    "Rdson",
    "MOSFET thermal",
    "power MOSFET",
    "synchronous rectifier"
  ],
  inputs: [
    {
      key: "drainCurrent",
      label: "Drain Current",
      symbol: "I_D",
      unit: "A",
      defaultValue: 5,
      min: 1e-3,
      tooltip: "RMS drain current through the MOSFET"
    },
    {
      key: "rdson",
      label: "On-Resistance",
      symbol: "R_DS(on)",
      unit: "m\u03A9",
      defaultValue: 10,
      min: 0.1,
      tooltip: "Drain-source on-resistance from datasheet"
    },
    {
      key: "vds",
      label: "Drain-Source Voltage",
      symbol: "V_DS",
      unit: "V",
      defaultValue: 12,
      min: 0.1,
      tooltip: "Voltage across MOSFET during off state (bus voltage)"
    },
    {
      key: "frequency",
      label: "Switching Frequency",
      symbol: "f_sw",
      unit: "kHz",
      defaultValue: 100,
      min: 0.1,
      tooltip: "Switching frequency of the converter"
    },
    {
      key: "riseTime",
      label: "Rise Time",
      symbol: "t_r",
      unit: "ns",
      defaultValue: 20,
      min: 0.1,
      tooltip: "Current rise time during turn-on transition"
    },
    {
      key: "fallTime",
      label: "Fall Time",
      symbol: "t_f",
      unit: "ns",
      defaultValue: 20,
      min: 0.1,
      tooltip: "Current fall time during turn-off transition"
    },
    {
      key: "rthJA",
      label: "Thermal Resistance (Rth J-A)",
      symbol: "R_\u03B8JA",
      unit: "\xB0C/W",
      defaultValue: 40,
      min: 1,
      max: 300,
      tooltip: "Junction-to-ambient thermal resistance. TO-220 no heatsink: ~60, with heatsink: ~10-20, SOT-23: ~150",
      presets: [
        { label: "TO-220 + heatsink", values: { rthJA: 15 } },
        { label: "TO-220 no heatsink", values: { rthJA: 60 } },
        { label: "SOIC-8", values: { rthJA: 100 } },
        { label: "SOT-23", values: { rthJA: 150 } }
      ]
    },
    {
      key: "tAmbient",
      label: "Ambient Temperature",
      symbol: "T_A",
      unit: "\xB0C",
      defaultValue: 25,
      min: -40,
      max: 85,
      tooltip: "Operating ambient temperature"
    }
  ],
  outputs: [
    {
      key: "conductionLoss",
      label: "Conduction Loss",
      symbol: "P_cond",
      unit: "mW",
      precision: 2
    },
    {
      key: "switchingLoss",
      label: "Switching Loss",
      symbol: "P_sw",
      unit: "mW",
      precision: 2
    },
    {
      key: "totalLoss",
      label: "Total Power Loss",
      symbol: "P_total",
      unit: "mW",
      precision: 2,
      thresholds: {
        good: { max: 500 },
        warning: { max: 2e3 },
        danger: { max: 2e3 }
      }
    },
    {
      key: "junctionTemp",
      label: "Junction Temperature",
      symbol: "T_j",
      unit: "\xB0C",
      precision: 1,
      thresholds: {
        good: { max: 100 },
        warning: { max: 125 },
        danger: { max: 125 }
      }
    },
    {
      key: "efficiency",
      label: "MOSFET Efficiency (1 \u2212 P_loss/P_in)",
      symbol: "\u03B7",
      unit: "%",
      precision: 2,
      thresholds: {
        good: { min: 95 },
        warning: { min: 85 },
        danger: { min: 85 }
      }
    }
  ],
  calculate: calculateMosfetPowerDissipation,
  formula: {
    primary: "P_cond = I_D\xB2 \xD7 R_DS(on), P_sw = 0.5 \xD7 V_DS \xD7 I_D \xD7 (t_r + t_f) \xD7 f_sw",
    variables: [
      { symbol: "I_D", description: "Drain current", unit: "A" },
      { symbol: "R_DS(on)", description: "On-resistance", unit: "\u03A9" },
      { symbol: "V_DS", description: "Drain-source voltage", unit: "V" },
      { symbol: "f_sw", description: "Switching frequency", unit: "Hz" },
      { symbol: "t_r", description: "Rise time", unit: "s" },
      { symbol: "t_f", description: "Fall time", unit: "s" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["buck-converter", "mosfet-operating-point", "linear-regulator-dropout"]
};

// src/lib/calculators/power/solar-panel-sizing.ts
function calculateSolarPanelSizing(inputs) {
  const { loadPower, peakSunHours, systemVoltage, batteryCapacity, daysAutonomy } = inputs;
  const safeVoltage = Math.max(systemVoltage, 0.1);
  const safeSunHours = Math.max(peakSunHours, 0.1);
  const energyPerDay = loadPower * 24;
  const panelWattage = energyPerDay / safeSunHours * 1.25;
  const panelCurrent = panelWattage / safeVoltage;
  const batteryAh = loadPower * 24 * daysAutonomy / safeVoltage / 0.5;
  const chargeControllerAmps = panelCurrent * 1.25;
  return {
    values: {
      energyPerDay,
      panelWattage,
      panelCurrent,
      batteryAh,
      chargeControllerAmps
    }
  };
}
var solarPanelSizing = {
  slug: "solar-panel-sizing",
  title: "Solar Panel Sizing Calculator",
  shortTitle: "Solar Panel Sizing",
  category: "power",
  description: "Calculate solar panel wattage, battery capacity, and charge controller current for off-grid photovoltaic systems based on load and sun hours",
  keywords: [
    "solar panel sizing",
    "photovoltaic",
    "off-grid solar",
    "battery sizing",
    "charge controller",
    "peak sun hours",
    "PV system design",
    "off-grid power"
  ],
  inputs: [
    {
      key: "loadPower",
      label: "Load Power",
      symbol: "P_load",
      unit: "W",
      defaultValue: 100,
      min: 0.1,
      tooltip: "Continuous power consumption of the load"
    },
    {
      key: "peakSunHours",
      label: "Peak Sun Hours",
      symbol: "PSH",
      unit: "hr",
      defaultValue: 5,
      min: 0.1,
      tooltip: "Average peak sun hours per day for your location",
      presets: [
        { label: "Low (cloudy)", values: { peakSunHours: 2.5 } },
        { label: "Average", values: { peakSunHours: 5 } },
        { label: "High (desert)", values: { peakSunHours: 7 } }
      ]
    },
    {
      key: "systemVoltage",
      label: "System Voltage",
      symbol: "V_sys",
      unit: "V",
      defaultValue: 12,
      min: 1,
      presets: [
        { label: "12V", values: { systemVoltage: 12 } },
        { label: "24V", values: { systemVoltage: 24 } },
        { label: "48V", values: { systemVoltage: 48 } }
      ]
    },
    {
      key: "batteryCapacity",
      label: "Battery Capacity (reference)",
      symbol: "C_batt",
      unit: "Ah",
      defaultValue: 100,
      min: 1,
      tooltip: "Reference battery capacity (used for comparison)"
    },
    {
      key: "daysAutonomy",
      label: "Days of Autonomy",
      symbol: "N_days",
      unit: "",
      defaultValue: 3,
      min: 1,
      max: 30,
      step: 1,
      tooltip: "Number of cloudy days the system must operate without sun"
    }
  ],
  outputs: [
    {
      key: "energyPerDay",
      label: "Energy Per Day",
      symbol: "E_day",
      unit: "Wh",
      precision: 1
    },
    {
      key: "panelWattage",
      label: "Required Panel Wattage",
      symbol: "P_panel",
      unit: "W",
      precision: 1
    },
    {
      key: "panelCurrent",
      label: "Panel Current",
      symbol: "I_panel",
      unit: "A",
      precision: 2
    },
    {
      key: "batteryAh",
      label: "Required Battery Capacity",
      symbol: "C_req",
      unit: "Ah",
      precision: 1
    },
    {
      key: "chargeControllerAmps",
      label: "Charge Controller Current",
      symbol: "I_cc",
      unit: "A",
      precision: 2
    }
  ],
  calculate: calculateSolarPanelSizing,
  formula: {
    primary: "P_panel = (P_load \xD7 24) / PSH \xD7 1.25, C_batt = P_load \xD7 24 \xD7 N_days / V_sys / 0.5",
    variables: [
      { symbol: "P_load", description: "Load power", unit: "W" },
      { symbol: "PSH", description: "Peak sun hours", unit: "hr" },
      { symbol: "V_sys", description: "System voltage", unit: "V" },
      { symbol: "N_days", description: "Days of autonomy", unit: "" },
      { symbol: "DoD", description: "Depth of discharge (50%)", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["battery-charge-time", "pwm-duty-cycle", "linear-regulator-dropout"]
};

// src/lib/calculators/power/battery-charge-time.ts
function calculateBatteryChargeTime(inputs) {
  const { capacity, chargeCurrentC, initialSoc, targetSoc, chargingVoltage, battVoltage } = inputs;
  const safeCapacity = Math.max(capacity, 1);
  const chargeCurrent = safeCapacity * chargeCurrentC;
  const socDelta = Math.max(targetSoc - initialSoc, 0);
  const ccTime = socDelta / 100 * safeCapacity / Math.max(chargeCurrent, 1e-3);
  const cvTime = targetSoc > 80 ? 0.25 * ccTime : 0;
  const chargeTime = ccTime + cvTime;
  const energyIn = chargeCurrent * chargeTime * chargingVoltage;
  const energyOut = safeCapacity * (socDelta / 100) * battVoltage;
  const chargingEfficiency = Math.min(100, energyOut / Math.max(energyIn, 1e-3) * 100);
  return {
    values: {
      chargeCurrent,
      ccTime,
      chargeTime,
      energyIn,
      chargingEfficiency
    }
  };
}
var batteryChargeTime = {
  slug: "battery-charge-time",
  title: "Battery Charge Time Calculator",
  shortTitle: "Battery Charge Time",
  category: "power",
  description: "Calculate Li-ion battery charge time using CC/CV method, including CC phase duration, total charge time, energy input, and charging efficiency",
  keywords: [
    "battery charge time",
    "Li-ion charging",
    "CC CV charging",
    "battery capacity",
    "C-rate charging",
    "lithium battery",
    "charge time calculator"
  ],
  inputs: [
    {
      key: "capacity",
      label: "Battery Capacity",
      symbol: "C",
      unit: "mAh",
      defaultValue: 3e3,
      min: 1,
      tooltip: "Rated battery capacity in mAh"
    },
    {
      key: "chargeCurrentC",
      label: "Charge Rate (C-rate)",
      symbol: "I_c",
      unit: "C",
      defaultValue: 1,
      min: 0.1,
      max: 4,
      step: 0.1,
      tooltip: "Charge current as a multiple of battery capacity (1C = full capacity in 1 hour)",
      presets: [
        { label: "0.5C (slow)", values: { chargeCurrentC: 0.5 } },
        { label: "1C (standard)", values: { chargeCurrentC: 1 } },
        { label: "2C (fast)", values: { chargeCurrentC: 2 } }
      ]
    },
    {
      key: "initialSoc",
      label: "Initial State of Charge",
      symbol: "SoC_i",
      unit: "%",
      defaultValue: 20,
      min: 0,
      max: 99,
      step: 1
    },
    {
      key: "targetSoc",
      label: "Target State of Charge",
      symbol: "SoC_t",
      unit: "%",
      defaultValue: 80,
      min: 1,
      max: 100,
      step: 1
    },
    {
      key: "chargingVoltage",
      label: "Charging Voltage",
      symbol: "V_chg",
      unit: "V",
      defaultValue: 4.2,
      min: 0.1,
      tooltip: "Terminal voltage during charging"
    },
    {
      key: "battVoltage",
      label: "Nominal Battery Voltage",
      symbol: "V_nom",
      unit: "V",
      defaultValue: 3.7,
      min: 0.1,
      tooltip: "Nominal battery voltage for energy calculation"
    }
  ],
  outputs: [
    {
      key: "chargeTime",
      label: "Total Charge Time",
      symbol: "t_total",
      unit: "hr",
      precision: 2
    },
    {
      key: "ccTime",
      label: "CC Phase Time",
      symbol: "t_CC",
      unit: "hr",
      precision: 2
    },
    {
      key: "chargeCurrent",
      label: "Charge Current",
      symbol: "I_chg",
      unit: "mA",
      precision: 1
    },
    {
      key: "energyIn",
      label: "Energy Input",
      symbol: "E_in",
      unit: "mWh",
      precision: 1
    },
    {
      key: "chargingEfficiency",
      label: "Charging Efficiency",
      symbol: "\u03B7_chg",
      unit: "%",
      precision: 1,
      thresholds: {
        good: { min: 90 },
        warning: { min: 80 },
        danger: { min: 80 }
      }
    }
  ],
  calculate: calculateBatteryChargeTime,
  formula: {
    primary: "t_CC = \u0394SoC \xD7 C / I_chg, t_CV \u2248 0.25 \xD7 t_CC (if target > 80%)",
    variables: [
      { symbol: "C", description: "Battery capacity", unit: "mAh" },
      { symbol: "I_c", description: "C-rate multiplier", unit: "" },
      { symbol: "I_chg", description: "Charge current", unit: "mA" },
      { symbol: "\u0394SoC", description: "State of charge change", unit: "%" },
      { symbol: "\u03B7", description: "Charging efficiency", unit: "%" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["solar-panel-sizing", "pwm-duty-cycle", "mosfet-power-dissipation"]
};

// src/lib/calculators/power/inrush-current-limiter.ts
function calculateInrushCurrentLimiter(inputs) {
  const { supplyVoltage, filterCapacitance, targetInrush, ntcResistanceHot } = inputs;
  const safeTargetInrush = Math.max(targetInrush, 1e-3);
  const safeCapacitance = Math.max(filterCapacitance, 1e-3);
  const ntcResistanceCold = supplyVoltage / safeTargetInrush;
  const peakInrush = supplyVoltage / Math.max(ntcResistanceCold + ntcResistanceHot, 1e-3);
  const timeConstant = ntcResistanceCold * safeCapacitance * 1e-6 * 1e3;
  const energyAbsorbed = 0.5 * safeCapacitance * 1e-6 * supplyVoltage * supplyVoltage * 1e3;
  const limitingResistor = ntcResistanceCold;
  return {
    values: {
      ntcResistanceCold,
      peakInrush,
      timeConstant,
      energyAbsorbed,
      limitingResistor
    }
  };
}
var inrushCurrentLimiter = {
  slug: "inrush-current-limiter",
  title: "Inrush Current Limiter (NTC) Calculator",
  shortTitle: "Inrush Current Limiter",
  category: "power",
  description: "Calculate NTC thermistor requirements for inrush current limiting, including cold resistance, peak inrush current, time constant, and energy absorbed",
  keywords: [
    "inrush current",
    "NTC thermistor",
    "soft start",
    "power supply inrush",
    "current limiting",
    "capacitor inrush",
    "power on surge"
  ],
  inputs: [
    {
      key: "supplyVoltage",
      label: "Supply Voltage",
      symbol: "V_s",
      unit: "V",
      defaultValue: 12,
      min: 0.1,
      tooltip: "Supply voltage applied at power-on"
    },
    {
      key: "filterCapacitance",
      label: "Filter Capacitance",
      symbol: "C_f",
      unit: "\u03BCF",
      defaultValue: 1e3,
      min: 0.1,
      tooltip: "Total input filter capacitance that must be charged"
    },
    {
      key: "targetInrush",
      label: "Target Inrush Current",
      symbol: "I_inrush",
      unit: "A",
      defaultValue: 5,
      min: 1e-3,
      tooltip: "Maximum allowable inrush current at power-on"
    },
    {
      key: "ntcResistanceHot",
      label: "NTC Resistance (Hot)",
      symbol: "R_hot",
      unit: "\u03A9",
      defaultValue: 0.5,
      min: 1e-3,
      tooltip: "NTC thermistor resistance when fully heated (steady-state)"
    }
  ],
  outputs: [
    {
      key: "ntcResistanceCold",
      label: "Required NTC Cold Resistance",
      symbol: "R_cold",
      unit: "\u03A9",
      precision: 2
    },
    {
      key: "peakInrush",
      label: "Peak Inrush Current",
      symbol: "I_peak",
      unit: "A",
      precision: 3,
      thresholds: {
        good: { max: 5 },
        warning: { max: 20 },
        danger: { max: 20 }
      }
    },
    {
      key: "timeConstant",
      label: "Time Constant",
      symbol: "\u03C4",
      unit: "ms",
      precision: 2
    },
    {
      key: "energyAbsorbed",
      label: "Energy Absorbed",
      symbol: "E",
      unit: "mJ",
      precision: 2
    },
    {
      key: "limitingResistor",
      label: "Limiting Resistance (cold)",
      symbol: "R_lim",
      unit: "\u03A9",
      precision: 2
    }
  ],
  calculate: calculateInrushCurrentLimiter,
  formula: {
    primary: "R_cold = V_s / I_inrush, \u03C4 = R_cold \xD7 C_f, E = 0.5 \xD7 C_f \xD7 V_s\xB2",
    variables: [
      { symbol: "V_s", description: "Supply voltage", unit: "V" },
      { symbol: "I_inrush", description: "Target inrush current", unit: "A" },
      { symbol: "C_f", description: "Filter capacitance", unit: "F" },
      { symbol: "R_cold", description: "NTC cold resistance", unit: "\u03A9" },
      { symbol: "\u03C4", description: "Time constant", unit: "s" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["mosfet-power-dissipation", "linear-regulator-dropout", "pwm-duty-cycle"]
};

// src/lib/calculators/power/charge-pump-voltage.ts
function calculateChargePump(inputs) {
  const { inputVoltage, stages, pumpCurrent, frequency, capacitance } = inputs;
  const safeFreq = Math.max(frequency, 1e-3);
  const safeCap = Math.max(capacitance, 1e-4);
  const safeStages = Math.max(Math.round(stages), 1);
  const freq_Hz = safeFreq * 1e3;
  const cap_F = safeCap * 1e-6;
  const current_A = pumpCurrent / 1e3;
  const openCircuitVoltage = inputVoltage * (safeStages + 1);
  const voltageDropPerStage = current_A / (freq_Hz * cap_F);
  const loadedVoltage = Math.max(0, openCircuitVoltage - voltageDropPerStage * safeStages);
  const outputRipple = current_A / (freq_Hz * cap_F) * 1e3;
  const efficiency = Math.max(0, Math.min(
    100,
    loadedVoltage * pumpCurrent / Math.max(inputVoltage * pumpCurrent * (safeStages + 1), 1e-3) * 100
  ));
  return {
    values: {
      openCircuitVoltage,
      loadedVoltage,
      outputRipple,
      efficiency
    }
  };
}
var chargePumpVoltage = {
  slug: "charge-pump-voltage",
  title: "Charge Pump Voltage Multiplier Calculator",
  shortTitle: "Charge Pump",
  category: "power",
  description: "Calculate Dickson charge pump output voltage, loaded voltage, output ripple, and efficiency for switched-capacitor voltage multiplier circuits",
  keywords: [
    "charge pump",
    "voltage multiplier",
    "Dickson charge pump",
    "switched capacitor",
    "voltage doubler",
    "voltage tripler",
    "capacitive boost"
  ],
  inputs: [
    {
      key: "inputVoltage",
      label: "Input Voltage",
      symbol: "V_in",
      unit: "V",
      defaultValue: 3.3,
      min: 0.1
    },
    {
      key: "stages",
      label: "Number of Stages",
      symbol: "N",
      unit: "",
      defaultValue: 2,
      min: 1,
      max: 8,
      step: 1,
      presets: [
        { label: "Doubler (1)", values: { stages: 1 } },
        { label: "Tripler (2)", values: { stages: 2 } },
        { label: "4\xD7 (3)", values: { stages: 3 } }
      ]
    },
    {
      key: "pumpCurrent",
      label: "Output Current",
      symbol: "I_out",
      unit: "mA",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Load current drawn from charge pump output"
    },
    {
      key: "frequency",
      label: "Switching Frequency",
      symbol: "f_sw",
      unit: "kHz",
      defaultValue: 100,
      min: 0.1
    },
    {
      key: "capacitance",
      label: "Pump Capacitance",
      symbol: "C_pump",
      unit: "\u03BCF",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Capacitance of each pump capacitor stage"
    }
  ],
  outputs: [
    {
      key: "openCircuitVoltage",
      label: "Open Circuit Voltage",
      symbol: "V_oc",
      unit: "V",
      precision: 3
    },
    {
      key: "loadedVoltage",
      label: "Loaded Output Voltage",
      symbol: "V_out",
      unit: "V",
      precision: 3
    },
    {
      key: "outputRipple",
      label: "Output Ripple",
      symbol: "\u0394V",
      unit: "mV",
      precision: 2,
      thresholds: {
        good: { max: 50 },
        warning: { max: 200 },
        danger: { max: 200 }
      }
    },
    {
      key: "efficiency",
      label: "Efficiency",
      symbol: "\u03B7",
      unit: "%",
      precision: 1,
      thresholds: {
        good: { min: 80 },
        warning: { min: 60 },
        danger: { min: 60 }
      }
    }
  ],
  calculate: calculateChargePump,
  formula: {
    primary: "V_oc = V_in \xD7 (N+1), V_out = V_oc \u2212 N \xD7 I_out / (f \xD7 C)",
    variables: [
      { symbol: "V_in", description: "Input voltage", unit: "V" },
      { symbol: "N", description: "Number of stages", unit: "" },
      { symbol: "I_out", description: "Output current", unit: "A" },
      { symbol: "f", description: "Switching frequency", unit: "Hz" },
      { symbol: "C", description: "Pump capacitance", unit: "F" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["pwm-duty-cycle", "switching-regulator-ripple", "boost-converter"]
};

// src/lib/calculators/power/switching-regulator-ripple.ts
function calculateSwitchingRegulatorRipple(inputs) {
  const { inductance, capacitance, esr, inputVoltage, outputVoltage, frequency } = inputs;
  const safeFreq = Math.max(frequency, 1e-3);
  const safeL = Math.max(inductance, 1e-3);
  const safeCap = Math.max(capacitance, 1e-3);
  const freq_Hz = safeFreq * 1e3;
  const L_H = safeL * 1e-6;
  const C_F = safeCap * 1e-6;
  const esr_Ohm = esr / 1e3;
  const dutyCycle = Math.min(99, Math.max(1, outputVoltage / Math.max(inputVoltage, 1e-3) * 100));
  const inductorRippleCurrent = (inputVoltage - outputVoltage) * (dutyCycle / 100) / (L_H * freq_Hz);
  const capacitorRipple = inductorRippleCurrent / (8 * freq_Hz * C_F) * 1e3;
  const inductorRipple = inductorRippleCurrent * esr_Ohm * 1e3;
  const peakToPeakRipple = Math.sqrt(capacitorRipple * capacitorRipple + inductorRipple * inductorRipple);
  return {
    values: {
      dutyCycle,
      inductorRippleCurrent,
      capacitorRipple,
      inductorRipple,
      peakToPeakRipple
    }
  };
}
var switchingRegulatorRipple = {
  slug: "switching-regulator-ripple",
  title: "Switching Regulator Output Ripple Calculator",
  shortTitle: "Switching Regulator Ripple",
  category: "power",
  description: "Calculate buck converter output voltage ripple, inductor current ripple, and ESR contribution for switching regulator design",
  keywords: [
    "buck converter ripple",
    "switching regulator",
    "output ripple",
    "ESR",
    "inductor current ripple",
    "capacitor ripple",
    "buck converter design",
    "SMPS ripple"
  ],
  inputs: [
    {
      key: "inputVoltage",
      label: "Input Voltage",
      symbol: "V_in",
      unit: "V",
      defaultValue: 12,
      min: 0.1
    },
    {
      key: "outputVoltage",
      label: "Output Voltage",
      symbol: "V_out",
      unit: "V",
      defaultValue: 5,
      min: 0.1
    },
    {
      key: "frequency",
      label: "Switching Frequency",
      symbol: "f_sw",
      unit: "kHz",
      defaultValue: 500,
      min: 1
    },
    {
      key: "inductance",
      label: "Inductance",
      symbol: "L",
      unit: "\u03BCH",
      defaultValue: 10,
      min: 0.01
    },
    {
      key: "capacitance",
      label: "Output Capacitance",
      symbol: "C_out",
      unit: "\u03BCF",
      defaultValue: 100,
      min: 0.1
    },
    {
      key: "esr",
      label: "Capacitor ESR",
      symbol: "ESR",
      unit: "m\u03A9",
      defaultValue: 20,
      min: 0.1,
      tooltip: "Equivalent series resistance of the output capacitor"
    }
  ],
  outputs: [
    {
      key: "dutyCycle",
      label: "Duty Cycle",
      symbol: "D",
      unit: "%",
      precision: 2
    },
    {
      key: "inductorRippleCurrent",
      label: "Inductor Ripple Current",
      symbol: "\u0394I_L",
      unit: "A",
      precision: 4
    },
    {
      key: "capacitorRipple",
      label: "Capacitor Ripple Voltage",
      symbol: "\u0394V_C",
      unit: "mV",
      precision: 2
    },
    {
      key: "inductorRipple",
      label: "ESR Ripple Voltage",
      symbol: "\u0394V_ESR",
      unit: "mV",
      precision: 2
    },
    {
      key: "peakToPeakRipple",
      label: "Total Peak-to-Peak Ripple",
      symbol: "\u0394V_out",
      unit: "mV",
      precision: 2,
      thresholds: {
        good: { max: 10 },
        warning: { max: 50 },
        danger: { max: 50 }
      }
    }
  ],
  calculate: calculateSwitchingRegulatorRipple,
  formula: {
    primary: "\u0394I_L = (V_in \u2212 V_out) \xD7 D / (L \xD7 f), \u0394V \u2248 \u221A(\u0394V_C\xB2 + \u0394V_ESR\xB2)",
    variables: [
      { symbol: "D", description: "Duty cycle", unit: "" },
      { symbol: "L", description: "Inductance", unit: "H" },
      { symbol: "f", description: "Switching frequency", unit: "Hz" },
      { symbol: "C", description: "Output capacitance", unit: "F" },
      { symbol: "ESR", description: "Equivalent series resistance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["buck-converter", "decoupling-capacitor", "mosfet-power-dissipation"]
};

// src/lib/calculators/power/linear-regulator-dropout.ts
function calculateLinearRegulatorDropout(inputs) {
  const { inputVoltage, outputVoltage, loadCurrent, dropoutVoltage, thetaJA } = inputs;
  const vDiff = inputVoltage - outputVoltage;
  const powerDissipation = vDiff * loadCurrent;
  const junctionTempRise = powerDissipation / 1e3 * thetaJA;
  const minInputVoltage = outputVoltage + dropoutVoltage / 1e3;
  const efficiency = outputVoltage / Math.max(inputVoltage, 1e-3) * 100;
  const headroom = (inputVoltage - outputVoltage) * 1e3 - dropoutVoltage;
  return {
    values: {
      powerDissipation,
      junctionTempRise,
      minInputVoltage,
      efficiency,
      headroom
    }
  };
}
var linearRegulatorDropout = {
  slug: "linear-regulator-dropout",
  title: "LDO Linear Regulator Dropout Calculator",
  shortTitle: "LDO Dropout",
  category: "power",
  description: "Calculate LDO regulator power dissipation, junction temperature rise, minimum input voltage, efficiency, and headroom for linear regulator design",
  keywords: [
    "LDO dropout voltage",
    "linear regulator",
    "dropout",
    "efficiency",
    "thermal dissipation",
    "LDO design",
    "low dropout regulator",
    "regulator thermal"
  ],
  inputs: [
    {
      key: "inputVoltage",
      label: "Input Voltage",
      symbol: "V_in",
      unit: "V",
      defaultValue: 5,
      min: 0.1
    },
    {
      key: "outputVoltage",
      label: "Output Voltage",
      symbol: "V_out",
      unit: "V",
      defaultValue: 3.3,
      min: 0.1
    },
    {
      key: "loadCurrent",
      label: "Load Current",
      symbol: "I_load",
      unit: "mA",
      defaultValue: 500,
      min: 1e-3
    },
    {
      key: "dropoutVoltage",
      label: "Dropout Voltage",
      symbol: "V_DO",
      unit: "mV",
      defaultValue: 300,
      min: 10,
      tooltip: "Minimum input-to-output differential for regulation (from datasheet)"
    },
    {
      key: "thetaJA",
      label: "Thermal Resistance \u03B8JA",
      symbol: "\u03B8_JA",
      unit: "\xB0C/W",
      defaultValue: 50,
      min: 1,
      tooltip: "Junction-to-ambient thermal resistance (from datasheet)"
    }
  ],
  outputs: [
    {
      key: "powerDissipation",
      label: "Power Dissipation",
      symbol: "P_D",
      unit: "mW",
      precision: 1,
      thresholds: {
        good: { max: 250 },
        warning: { max: 750 },
        danger: { max: 750 }
      }
    },
    {
      key: "junctionTempRise",
      label: "Junction Temp Rise",
      symbol: "\u0394T_j",
      unit: "\xB0C",
      precision: 1,
      thresholds: {
        good: { max: 30 },
        warning: { max: 60 },
        danger: { max: 60 }
      }
    },
    {
      key: "minInputVoltage",
      label: "Minimum Input Voltage",
      symbol: "V_in(min)",
      unit: "V",
      precision: 3
    },
    {
      key: "efficiency",
      label: "Efficiency",
      symbol: "\u03B7",
      unit: "%",
      precision: 1,
      thresholds: {
        good: { min: 85 },
        warning: { min: 70 },
        danger: { min: 70 }
      }
    },
    {
      key: "headroom",
      label: "Input Headroom",
      symbol: "V_head",
      unit: "mV",
      precision: 1,
      thresholds: {
        good: { min: 500 },
        warning: { min: 100 },
        danger: { min: 0 }
      }
    }
  ],
  calculate: calculateLinearRegulatorDropout,
  formula: {
    primary: "P_D = (V_in \u2212 V_out) \xD7 I_load, \u03B7 = V_out / V_in \xD7 100%",
    variables: [
      { symbol: "V_in", description: "Input voltage", unit: "V" },
      { symbol: "V_out", description: "Output voltage", unit: "V" },
      { symbol: "I_load", description: "Load current", unit: "A" },
      { symbol: "V_DO", description: "Dropout voltage", unit: "V" },
      { symbol: "\u03B8_JA", description: "Thermal resistance", unit: "\xB0C/W" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["mosfet-power-dissipation", "thermal-resistance-network", "switching-regulator-ripple"]
};

// src/lib/calculators/pcb/pcb-crosstalk.ts
function calculatePcbCrosstalk(inputs) {
  const { traceWidth, traceSpacing, dielectricHeight, frequency, traceLength } = inputs;
  const W = Math.max(traceWidth, 1e-3);
  const S = Math.max(traceSpacing, 1e-3);
  const h = Math.max(dielectricHeight, 1e-3);
  const f_MHz = Math.max(frequency, 1e-3);
  const Lc = Math.max(traceLength, 1e-3);
  const er = 4.5;
  const u = W / h;
  const eEff = (er + 1) / 2 + (er - 1) / 2 / Math.sqrt(1 + 12 / u);
  const v_mm_ns = 300 / Math.sqrt(eEff);
  const criticalLength = v_mm_ns * 250 / f_MHz;
  const K = W / (W + S) * Math.exp(-S / h);
  const couplingCoeff = Math.min(100, Math.max(1e-3, K * 100));
  const Kb = K / 2;
  const saturation = Math.min(1, Lc / Math.max(criticalLength, 1e-3));
  const NEXT_V = Kb * saturation;
  const next_dB = NEXT_V > 1e-10 ? 20 * Math.log10(NEXT_V) : -80;
  const Kf = Kb * Math.abs(1 - 1 / eEff);
  const Tr_ns = 350 / f_MHz;
  const Td_ns = Lc / v_mm_ns;
  const FEXT_V = Kf * 2 * Td_ns / Math.max(Tr_ns, 1e-3);
  const fext_dB = FEXT_V > 1e-10 ? 20 * Math.log10(FEXT_V) : -80;
  return {
    values: {
      couplingCoeff: Math.max(1e-3, couplingCoeff),
      next_dB: Math.max(-80, next_dB),
      fext_dB: Math.max(-80, fext_dB),
      criticalLength
    }
  };
}
var pcbCrosstalk = {
  slug: "pcb-crosstalk",
  title: "PCB Crosstalk Calculator",
  shortTitle: "PCB Crosstalk",
  category: "pcb",
  description: "Estimate PCB trace crosstalk coupling coefficient, NEXT, FEXT, and critical coupling length for signal integrity analysis on PCB layouts",
  keywords: [
    "PCB crosstalk",
    "NEXT",
    "FEXT",
    "signal integrity",
    "coupled traces",
    "PCB trace coupling",
    "near-end crosstalk",
    "far-end crosstalk"
  ],
  inputs: [
    {
      key: "traceWidth",
      label: "Trace Width",
      symbol: "W",
      unit: "mm",
      defaultValue: 0.2,
      min: 0.01
    },
    {
      key: "traceSpacing",
      label: "Trace Spacing (edge-to-edge)",
      symbol: "S",
      unit: "mm",
      defaultValue: 0.2,
      min: 0.01,
      tooltip: "Edge-to-edge spacing between traces"
    },
    {
      key: "dielectricHeight",
      label: "Dielectric Height",
      symbol: "h",
      unit: "mm",
      defaultValue: 0.1,
      min: 0.01,
      tooltip: "Height of dielectric layer between trace and reference plane"
    },
    {
      key: "frequency",
      label: "Signal Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 100,
      min: 0.1,
      tooltip: "Highest significant frequency component of the signal"
    },
    {
      key: "traceLength",
      label: "Parallel Trace Length",
      symbol: "L",
      unit: "mm",
      defaultValue: 50,
      min: 0.1,
      tooltip: "Length over which the traces run parallel"
    }
  ],
  outputs: [
    {
      key: "couplingCoeff",
      label: "Coupling Coefficient",
      symbol: "K",
      unit: "%",
      precision: 2,
      thresholds: {
        good: { max: 5 },
        warning: { max: 15 },
        danger: { min: 15 }
      }
    },
    {
      key: "next_dB",
      label: "NEXT",
      symbol: "NEXT",
      unit: "dB",
      precision: 1,
      thresholds: {
        good: { max: -30 },
        warning: { max: -20 },
        danger: { min: -20 }
      }
    },
    {
      key: "fext_dB",
      label: "FEXT",
      symbol: "FEXT",
      unit: "dB",
      precision: 1
    },
    {
      key: "criticalLength",
      label: "Critical Length (\u03BB/4)",
      symbol: "L_crit",
      unit: "mm",
      precision: 1,
      tooltip: "Quarter-wavelength at the signal frequency in PCB medium"
    }
  ],
  calculate: calculatePcbCrosstalk,
  formula: {
    primary: "Kb \u2248 K/2, NEXT = Kb \xD7 min(1, L/L_crit), FEXT \u221D Kf \xD7 L/v/T_r",
    variables: [
      { symbol: "K", description: "Coupling coefficient W/(W+S)\xB7e^(\u2212S/h)", unit: "" },
      { symbol: "Kb", description: "Backward coupling coefficient", unit: "" },
      { symbol: "Kf", description: "Forward coupling (even/odd mode asymmetry)", unit: "" },
      { symbol: "L", description: "Parallel trace length", unit: "mm" },
      { symbol: "L_crit", description: "Critical length (\u03BB/4)", unit: "mm" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["differential-pair", "controlled-impedance", "pcb-trace-inductance"]
};

// src/lib/calculators/pcb/decoupling-capacitor.ts
function calculateDecouplingCapacitor(inputs) {
  const { capacitance, esr, esl, targetFreq, supplyImpedance } = inputs;
  const cap_F = Math.max(capacitance, 1e-3) * 1e-9;
  const esl_H = Math.max(esl, 1e-3) * 1e-9;
  const esr_mOhm = Math.max(esr, 1e-3);
  const selfResonantFreq = 1 / (2 * Math.PI * Math.sqrt(esl_H * cap_F)) / 1e6;
  const impedanceAtSrf = esr_mOhm;
  const omega = 2 * Math.PI * Math.max(targetFreq, 1e-3) * 1e6;
  const Xc = 1 / (omega * cap_F) * 1e3;
  const Xl = omega * esl_H * 1e3;
  const impedanceAtTarget = Math.sqrt(esr_mOhm * esr_mOhm + (Xc - Xl) * (Xc - Xl));
  const effectiveRange = selfResonantFreq * 3;
  const numCapacitors = Math.max(1, Math.ceil(impedanceAtTarget / Math.max(supplyImpedance, 1e-3)));
  return {
    values: {
      selfResonantFreq,
      impedanceAtSrf,
      impedanceAtTarget,
      effectiveRange,
      numCapacitors
    }
  };
}
var decouplingCapacitor = {
  slug: "decoupling-capacitor",
  title: "Decoupling Capacitor Selection Calculator",
  shortTitle: "Decoupling Capacitor",
  category: "pcb",
  description: "Calculate decoupling capacitor self-resonant frequency, impedance at target frequency, effective bypass range, and number of capacitors needed for power integrity",
  keywords: [
    "decoupling capacitor",
    "bypass capacitor",
    "self-resonant frequency",
    "ESR",
    "ESL",
    "power integrity",
    "PDN design",
    "power delivery network"
  ],
  inputs: [
    {
      key: "capacitance",
      label: "Capacitance",
      symbol: "C",
      unit: "nF",
      defaultValue: 100,
      min: 1e-3,
      presets: [
        { label: "1 nF", values: { capacitance: 1 } },
        { label: "10 nF", values: { capacitance: 10 } },
        { label: "100 nF", values: { capacitance: 100 } },
        { label: "1000 nF", values: { capacitance: 1e3 } }
      ]
    },
    {
      key: "esr",
      label: "ESR",
      symbol: "ESR",
      unit: "m\u03A9",
      defaultValue: 50,
      min: 0.1,
      tooltip: "Equivalent series resistance of the capacitor"
    },
    {
      key: "esl",
      label: "ESL",
      symbol: "ESL",
      unit: "nH",
      defaultValue: 1,
      min: 0.01,
      tooltip: "Equivalent series inductance (package parasitic)"
    },
    {
      key: "targetFreq",
      label: "Target Frequency",
      symbol: "f_target",
      unit: "MHz",
      defaultValue: 100,
      min: 1e-3,
      tooltip: "Frequency at which decoupling impedance is evaluated"
    },
    {
      key: "supplyImpedance",
      label: "Target Supply Impedance",
      symbol: "Z_target",
      unit: "m\u03A9",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Maximum allowable PDN impedance at the target frequency"
    }
  ],
  outputs: [
    {
      key: "selfResonantFreq",
      label: "Self-Resonant Frequency",
      symbol: "f_SRF",
      unit: "MHz",
      precision: 2
    },
    {
      key: "impedanceAtSrf",
      label: "Impedance at SRF",
      symbol: "Z_SRF",
      unit: "m\u03A9",
      precision: 2,
      thresholds: {
        good: { max: 50 },
        warning: { max: 100 },
        danger: { min: 100 }
      }
    },
    {
      key: "impedanceAtTarget",
      label: "Impedance at Target Freq",
      symbol: "Z_target",
      unit: "m\u03A9",
      precision: 2
    },
    {
      key: "effectiveRange",
      label: "Effective Bypass Range (upper)",
      symbol: "f_eff",
      unit: "MHz",
      precision: 2
    },
    {
      key: "numCapacitors",
      label: "Capacitors Needed",
      symbol: "N_cap",
      unit: "",
      precision: 0
    }
  ],
  calculate: calculateDecouplingCapacitor,
  exportComponents: (inputs) => [
    { qty: 1, description: "Bypass Cap", value: `${inputs.capacitance} nF`, package: "0402", componentType: "C", placement: "shunt" }
  ],
  schematicSections: (inputs) => [{
    label: "Capacitor Equivalent Model (ESL\u2013ESR\u2013C)",
    elements: [
      { type: "L", placement: "series", label: `ESL ${inputs.esl}nH` },
      { type: "R", placement: "series", label: `ESR ${inputs.esr}m\u03A9` },
      { type: "C", placement: "shunt", label: `C ${inputs.capacitance}nF` }
    ]
  }],
  formula: {
    primary: "f_SRF = 1 / (2\u03C0\u221A(ESL\xB7C)), Z = \u221A(ESR\xB2 + (X_C \u2212 X_L)\xB2)",
    variables: [
      { symbol: "C", description: "Capacitance", unit: "F" },
      { symbol: "ESR", description: "Equivalent series resistance", unit: "\u03A9" },
      { symbol: "ESL", description: "Equivalent series inductance", unit: "H" },
      { symbol: "f_SRF", description: "Self-resonant frequency", unit: "Hz" },
      { symbol: "Z", description: "Impedance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["switching-regulator-ripple", "pcb-trace-inductance", "lc-resonance"]
};

// src/lib/calculators/pcb/pcb-trace-inductance.ts
function calculatePcbTraceInductance(inputs) {
  const { traceLength, traceWidth, thickness } = inputs;
  const l = Math.max(traceLength, 1e-3) * 1e-3;
  const w = Math.max(traceWidth, 1e-3) * 1e-3;
  const t = Math.max(thickness, 0.1) * 1e-6;
  const mu0 = 4 * Math.PI * 1e-7;
  const argument = 2 * l / Math.max(w + t, 1e-12);
  const L_H = mu0 * l / (2 * Math.PI) * (Math.log(argument) + 0.5 + (w + t) / (3 * Math.max(l, 1e-12)));
  const inductance = Math.max(0, L_H * 1e9);
  const inductancePerLength = inductance / Math.max(traceLength, 1e-3);
  const impedanceAt100MHz = 2 * Math.PI * 1e8 * L_H;
  const impedanceAt1GHz = 2 * Math.PI * 1e9 * L_H;
  return {
    values: {
      inductance,
      inductancePerLength,
      impedanceAt100MHz,
      impedanceAt1GHz
    }
  };
}
var pcbTraceInductance = {
  slug: "pcb-trace-inductance",
  title: "PCB Trace Inductance Calculator",
  shortTitle: "PCB Trace Inductance",
  category: "pcb",
  description: "Calculate PCB trace parasitic inductance using the Ruehli formula, including inductance per unit length and inductive impedance at key frequencies",
  keywords: [
    "PCB trace inductance",
    "trace parasitic",
    "signal integrity",
    "trace impedance",
    "parasitic inductance",
    "PCB parasitics",
    "Ruehli formula"
  ],
  inputs: [
    {
      key: "traceLength",
      label: "Trace Length",
      symbol: "l",
      unit: "mm",
      defaultValue: 10,
      min: 0.1
    },
    {
      key: "traceWidth",
      label: "Trace Width",
      symbol: "w",
      unit: "mm",
      defaultValue: 0.2,
      min: 0.01
    },
    {
      key: "thickness",
      label: "Copper Thickness",
      symbol: "t",
      unit: "\u03BCm",
      defaultValue: 35,
      min: 1,
      presets: [
        { label: "0.5 oz (17 \u03BCm)", values: { thickness: 17 } },
        { label: "1 oz (35 \u03BCm)", values: { thickness: 35 } },
        { label: "2 oz (70 \u03BCm)", values: { thickness: 70 } }
      ]
    }
  ],
  outputs: [
    {
      key: "inductance",
      label: "Total Inductance",
      symbol: "L",
      unit: "nH",
      precision: 3
    },
    {
      key: "inductancePerLength",
      label: "Inductance per Length",
      symbol: "L/l",
      unit: "nH/mm",
      precision: 4
    },
    {
      key: "impedanceAt100MHz",
      label: "Impedance at 100 MHz",
      symbol: "Z_100M",
      unit: "\u03A9",
      precision: 3
    },
    {
      key: "impedanceAt1GHz",
      label: "Impedance at 1 GHz",
      symbol: "Z_1G",
      unit: "\u03A9",
      precision: 3
    }
  ],
  calculate: calculatePcbTraceInductance,
  formula: {
    primary: "L = (\u03BC\u2080l / 2\u03C0) \xD7 [ln(2l/(w+t)) + 0.5 + (w+t)/(3l)]",
    variables: [
      { symbol: "L", description: "Inductance", unit: "H" },
      { symbol: "\u03BC\u2080", description: "Permeability of free space", unit: "H/m" },
      { symbol: "l", description: "Trace length", unit: "m" },
      { symbol: "w", description: "Trace width", unit: "m" },
      { symbol: "t", description: "Copper thickness", unit: "m" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["decoupling-capacitor", "pcb-crosstalk", "via-calculator"]
};

// src/lib/calculators/pcb/via-thermal-resistance.ts
function calculateViaThermalResistance(inputs) {
  const { viaDiameter, platingThickness, boardThickness, numVias, viaFill } = inputs;
  const safeDia = Math.max(viaDiameter, 0.01) * 1e-3;
  const safePlating = Math.max(platingThickness, 0.1) * 1e-6;
  const safeBoard = Math.max(boardThickness, 0.1) * 1e-3;
  const safeNumVias = Math.max(Math.round(numVias), 1);
  const k_copper = 385;
  const outerRadius = safeDia / 2;
  const innerRadius = Math.max(0, outerRadius - safePlating);
  let copperArea;
  if (viaFill >= 0.5) {
    copperArea = Math.PI * outerRadius * outerRadius;
  } else {
    copperArea = Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius);
  }
  const safeCopperArea = Math.max(copperArea, 1e-18);
  const viaResistance = safeBoard / (k_copper * safeCopperArea);
  const arrayResistance = viaResistance / safeNumVias;
  const thermalConductance = 1 / Math.max(arrayResistance, 1e-6);
  const area_mm2 = safeCopperArea * 1e6;
  const currentCapacity = 25 * Math.sqrt(Math.max(area_mm2, 0));
  return {
    values: {
      viaResistance,
      arrayResistance,
      thermalConductance,
      currentCapacity
    }
  };
}
var viaThermalResistance = {
  slug: "via-thermal-resistance",
  title: "Via Thermal Resistance Calculator",
  shortTitle: "Via Thermal Resistance",
  category: "pcb",
  description: "Calculate PCB via thermal resistance, array thermal resistance, thermal conductance, and current-carrying capacity for thermal via design",
  keywords: [
    "via thermal resistance",
    "thermal via",
    "PCB thermal management",
    "via current capacity",
    "thermal management",
    "PCB heat dissipation",
    "copper via"
  ],
  inputs: [
    {
      key: "viaDiameter",
      label: "Via Diameter",
      symbol: "d",
      unit: "mm",
      defaultValue: 0.3,
      min: 0.05
    },
    {
      key: "platingThickness",
      label: "Plating Thickness",
      symbol: "t_cu",
      unit: "\u03BCm",
      defaultValue: 25,
      min: 1,
      tooltip: "Copper plating thickness on via barrel walls"
    },
    {
      key: "boardThickness",
      label: "Board Thickness",
      symbol: "h",
      unit: "mm",
      defaultValue: 1.6,
      min: 0.1,
      presets: [
        { label: "0.8 mm", values: { boardThickness: 0.8 } },
        { label: "1.6 mm", values: { boardThickness: 1.6 } },
        { label: "2.4 mm", values: { boardThickness: 2.4 } }
      ]
    },
    {
      key: "numVias",
      label: "Number of Vias",
      symbol: "N",
      unit: "",
      defaultValue: 4,
      min: 1,
      max: 100,
      step: 1
    },
    {
      key: "viaFill",
      label: "Via Fill",
      symbol: "fill",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 1,
      presets: [
        { label: "Unfilled (plated)", values: { viaFill: 0 } },
        { label: "Copper filled", values: { viaFill: 1 } }
      ]
    }
  ],
  outputs: [
    {
      key: "viaResistance",
      label: "Single Via Thermal Resistance",
      symbol: "\u03B8_via",
      unit: "\xB0C/W",
      precision: 2
    },
    {
      key: "arrayResistance",
      label: "Array Thermal Resistance",
      symbol: "\u03B8_array",
      unit: "\xB0C/W",
      precision: 3,
      thresholds: {
        good: { max: 5 },
        warning: { max: 20 },
        danger: { min: 20 }
      }
    },
    {
      key: "thermalConductance",
      label: "Thermal Conductance",
      symbol: "G_th",
      unit: "W/\xB0C",
      precision: 4
    },
    {
      key: "currentCapacity",
      label: "Current Capacity (per via)",
      symbol: "I_max",
      unit: "mA",
      precision: 1
    }
  ],
  calculate: calculateViaThermalResistance,
  formula: {
    primary: "\u03B8_via = h / (k_Cu \xD7 A_Cu), \u03B8_array = \u03B8_via / N",
    variables: [
      { symbol: "\u03B8_via", description: "Via thermal resistance", unit: "\xB0C/W" },
      { symbol: "h", description: "Board thickness", unit: "m" },
      { symbol: "k_Cu", description: "Copper thermal conductivity (385 W/mK)", unit: "W/mK" },
      { symbol: "A_Cu", description: "Copper cross-sectional area", unit: "m\xB2" },
      { symbol: "N", description: "Number of vias", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["thermal-resistance-network", "via-calculator", "pcb-trace-temp"]
};

// src/lib/calculators/general/bjt-bias-point.ts
function calculateBjtBiasPoint(inputs) {
  const { vcc, r1, r2, rc, re, beta, vbe } = inputs;
  const r1_Ohm = r1 * 1e3;
  const r2_Ohm = r2 * 1e3;
  const rc_Ohm = rc * 1e3;
  const re_Ohm = re;
  const safeBeta = Math.max(beta, 1);
  const Vth = vcc * r2_Ohm / Math.max(r1_Ohm + r2_Ohm, 1e-3);
  const Rth_Ohm = r1_Ohm * r2_Ohm / Math.max(r1_Ohm + r2_Ohm, 1e-3);
  const denominator = re_Ohm + Rth_Ohm / safeBeta;
  const Ic_A = Math.max(0, (Vth - vbe) / Math.max(denominator, 1e-3));
  const Ic_mA = Ic_A * 1e3;
  const Ib_uA = Ic_mA / safeBeta * 1e3;
  const Ve = Ic_A * re_Ohm;
  const Vb = Ve + vbe;
  const Vc = vcc - Ic_A * rc_Ohm;
  const Vce = Vc - Ve;
  const powerDissipation = Ic_A * Math.max(Vce, 0) * 1e3;
  const operatingRegion = Vce > 0.2 ? 1 : 0;
  return {
    values: {
      vb: Vb,
      ve: Ve,
      vc: Vc,
      ic: Ic_mA,
      ib: Ib_uA,
      vce: Vce,
      powerDissipation,
      operatingRegion
    }
  };
}
var bjtBiasPoint = {
  slug: "bjt-bias-point",
  title: "BJT Transistor Bias Point Calculator",
  shortTitle: "BJT Bias Point",
  category: "general",
  description: "Calculate BJT voltage divider bias Q-point including collector current, base voltage, VCE, power dissipation, and operating region",
  keywords: [
    "BJT bias point",
    "transistor bias",
    "Q-point",
    "voltage divider bias",
    "BJT operating point",
    "NPN bias",
    "transistor Q-point",
    "Thevenin bias"
  ],
  inputs: [
    {
      key: "vcc",
      label: "Supply Voltage (VCC)",
      symbol: "V_CC",
      unit: "V",
      defaultValue: 12,
      min: 0.1
    },
    {
      key: "r1",
      label: "R1 (upper bias resistor)",
      symbol: "R1",
      unit: "k\u03A9",
      defaultValue: 10,
      min: 1e-3
    },
    {
      key: "r2",
      label: "R2 (lower bias resistor)",
      symbol: "R2",
      unit: "k\u03A9",
      defaultValue: 4.7,
      min: 1e-3
    },
    {
      key: "rc",
      label: "Collector Resistor",
      symbol: "R_C",
      unit: "k\u03A9",
      defaultValue: 2.2,
      min: 1e-3
    },
    {
      key: "re",
      label: "Emitter Resistor",
      symbol: "R_E",
      unit: "\u03A9",
      defaultValue: 470,
      min: 0
    },
    {
      key: "beta",
      label: "Current Gain (\u03B2 / hFE)",
      symbol: "\u03B2",
      unit: "",
      defaultValue: 100,
      min: 1
    },
    {
      key: "vbe",
      label: "Base-Emitter Voltage",
      symbol: "V_BE",
      unit: "V",
      defaultValue: 0.7,
      min: 0.1,
      max: 0.9,
      step: 0.05
    }
  ],
  outputs: [
    {
      key: "vb",
      label: "Base Voltage",
      symbol: "V_B",
      unit: "V",
      precision: 3
    },
    {
      key: "ve",
      label: "Emitter Voltage",
      symbol: "V_E",
      unit: "V",
      precision: 3
    },
    {
      key: "vc",
      label: "Collector Voltage",
      symbol: "V_C",
      unit: "V",
      precision: 3
    },
    {
      key: "ic",
      label: "Collector Current",
      symbol: "I_C",
      unit: "mA",
      precision: 3
    },
    {
      key: "ib",
      label: "Base Current",
      symbol: "I_B",
      unit: "\u03BCA",
      precision: 2
    },
    {
      key: "vce",
      label: "Collector-Emitter Voltage",
      symbol: "V_CE",
      unit: "V",
      precision: 3,
      thresholds: {
        good: { min: 1 },
        warning: { min: 0.2 },
        danger: { max: 0.2 }
      }
    },
    {
      key: "powerDissipation",
      label: "Power Dissipation",
      symbol: "P_D",
      unit: "mW",
      precision: 2
    },
    {
      key: "operatingRegion",
      label: "Operating Region (1=Active, 0=Sat)",
      symbol: "region",
      unit: "",
      precision: 0
    }
  ],
  calculate: calculateBjtBiasPoint,
  formula: {
    primary: "V_th = V_CC \xD7 R2/(R1+R2), I_C = (V_th \u2212 V_BE) / (R_E + R_th/\u03B2)",
    variables: [
      { symbol: "V_th", description: "Thevenin base voltage", unit: "V" },
      { symbol: "R_th", description: "Thevenin base resistance", unit: "\u03A9" },
      { symbol: "I_C", description: "Collector current", unit: "A" },
      { symbol: "V_CE", description: "Collector-emitter voltage", unit: "V" },
      { symbol: "\u03B2", description: "Current gain", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["transistor-switch", "mosfet-operating-point", "opamp-gain"]
};

// src/lib/calculators/general/mosfet-operating-point.ts
function calculateMosfetOperatingPoint(inputs) {
  const { vgs, vth, kn, vds, vdd, rdLoad } = inputs;
  const vgsEff = Math.max(0, vgs - vth);
  const vdsSat = vgsEff;
  let id;
  let region;
  if (vgsEff <= 0) {
    id = 0;
    region = 0;
  } else if (vds >= vdsSat) {
    id = kn / 2 * vgsEff * vgsEff;
    region = 2;
  } else {
    id = kn * (vgsEff * vds - vds * vds / 2);
    region = 1;
  }
  id = Math.max(0, id);
  const powerDissipation = id * vds;
  const gm = region === 2 ? kn * vgsEff : region === 1 ? kn * vds : 0;
  return {
    values: {
      id,
      vdsSat,
      powerDissipation,
      gm,
      region
    }
  };
}
var mosfetOperatingPoint = {
  slug: "mosfet-operating-point",
  title: "MOSFET Operating Point Calculator",
  shortTitle: "MOSFET Operating Point",
  category: "general",
  description: "Calculate MOSFET drain current, saturation voltage, transconductance, and operating region (cutoff, triode, saturation) for NMOS transistors",
  keywords: [
    "MOSFET operating point",
    "MOSFET drain current",
    "threshold voltage",
    "gm",
    "transconductance",
    "NMOS saturation",
    "MOSFET triode",
    "FET bias"
  ],
  inputs: [
    {
      key: "vgs",
      label: "Gate-Source Voltage",
      symbol: "V_GS",
      unit: "V",
      defaultValue: 5,
      min: 0
    },
    {
      key: "vth",
      label: "Threshold Voltage",
      symbol: "V_th",
      unit: "V",
      defaultValue: 2,
      min: 0.1
    },
    {
      key: "kn",
      label: "Process Transconductance (kn)",
      symbol: "k_n",
      unit: "mA/V\xB2",
      defaultValue: 100,
      min: 1e-3,
      tooltip: "Process parameter kn = \u03BC_n \xD7 Cox \xD7 W/L"
    },
    {
      key: "vds",
      label: "Drain-Source Voltage",
      symbol: "V_DS",
      unit: "V",
      defaultValue: 10,
      min: 0
    },
    {
      key: "vdd",
      label: "Supply Voltage",
      symbol: "V_DD",
      unit: "V",
      defaultValue: 12,
      min: 0.1
    },
    {
      key: "rdLoad",
      label: "Drain Load Resistance",
      symbol: "R_D",
      unit: "k\u03A9",
      defaultValue: 1,
      min: 1e-3
    }
  ],
  outputs: [
    {
      key: "id",
      label: "Drain Current",
      symbol: "I_D",
      unit: "mA",
      precision: 3
    },
    {
      key: "vdsSat",
      label: "Saturation Voltage",
      symbol: "V_DS(sat)",
      unit: "V",
      precision: 3
    },
    {
      key: "powerDissipation",
      label: "Power Dissipation",
      symbol: "P_D",
      unit: "mW",
      precision: 2
    },
    {
      key: "gm",
      label: "Transconductance",
      symbol: "g_m",
      unit: "mA/V",
      precision: 3
    },
    {
      key: "region",
      label: "Operating Region (0=Off, 1=Triode, 2=Sat)",
      symbol: "region",
      unit: "",
      precision: 0
    }
  ],
  calculate: calculateMosfetOperatingPoint,
  formula: {
    primary: "I_D = k_n/2 \xD7 (V_GS\u2212V_th)\xB2 (sat), I_D = k_n \xD7 [(V_GS\u2212V_th)V_DS \u2212 V_DS\xB2/2] (triode)",
    variables: [
      { symbol: "V_GS", description: "Gate-source voltage", unit: "V" },
      { symbol: "V_th", description: "Threshold voltage", unit: "V" },
      { symbol: "k_n", description: "Process transconductance parameter", unit: "A/V\xB2" },
      { symbol: "V_DS", description: "Drain-source voltage", unit: "V" },
      { symbol: "g_m", description: "Transconductance", unit: "A/V" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["bjt-bias-point", "mosfet-power-dissipation", "transistor-switch"]
};

// src/lib/calculators/general/comparator-hysteresis.ts
function calculateComparatorHysteresis(inputs) {
  const { vref, supplyVoltage, r1, r2, hystPercent } = inputs;
  const divisor = Math.max(r1 + r2, 1e-3);
  const vTrip_high = vref * (r2 / divisor) + supplyVoltage * (r1 / divisor);
  const vTrip_low = vref * (r2 / divisor);
  const hysteresis = Math.max(0, vTrip_high - vTrip_low) * 1e3;
  const hysteresis_V = supplyVoltage * hystPercent / 100;
  const denomHyst = Math.max(supplyVoltage - hysteresis_V, 1e-3);
  const r1Calc = r2 * hysteresis_V / denomHyst;
  const r2Calc = r2;
  return {
    values: {
      vTrip_high,
      vTrip_low,
      hysteresis,
      r1Calc,
      r2Calc
    }
  };
}
var comparatorHysteresis = {
  slug: "comparator-hysteresis",
  title: "Comparator Hysteresis (Schmitt Trigger) Calculator",
  shortTitle: "Comparator Hysteresis",
  category: "general",
  description: "Calculate comparator hysteresis trip points for Schmitt trigger circuits, upper and lower threshold voltages, and design resistor values for a desired hysteresis percentage",
  keywords: [
    "comparator hysteresis",
    "Schmitt trigger",
    "threshold voltage",
    "noise immunity",
    "positive feedback",
    "hysteresis band",
    "comparator design"
  ],
  inputs: [
    {
      key: "vref",
      label: "Reference Voltage",
      symbol: "V_ref",
      unit: "V",
      defaultValue: 2.5,
      min: 0,
      tooltip: "Reference voltage applied to the inverting input"
    },
    {
      key: "supplyVoltage",
      label: "Supply Voltage",
      symbol: "V_cc",
      unit: "V",
      defaultValue: 5,
      min: 0.1
    },
    {
      key: "r1",
      label: "R1 (feedback resistor)",
      symbol: "R1",
      unit: "k\u03A9",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Resistor from comparator output to non-inverting input"
    },
    {
      key: "r2",
      label: "R2 (input resistor)",
      symbol: "R2",
      unit: "k\u03A9",
      defaultValue: 100,
      min: 1e-3,
      tooltip: "Resistor from non-inverting input to ground (sets reference divider)"
    },
    {
      key: "hystPercent",
      label: "Desired Hysteresis",
      symbol: "hyst%",
      unit: "%",
      defaultValue: 5,
      min: 0.1,
      max: 50,
      step: 0.5,
      tooltip: "Desired hysteresis as percentage of supply voltage (for design calculation)"
    }
  ],
  outputs: [
    {
      key: "vTrip_high",
      label: "Upper Trip Point",
      symbol: "V_T+",
      unit: "V",
      precision: 3
    },
    {
      key: "vTrip_low",
      label: "Lower Trip Point",
      symbol: "V_T\u2212",
      unit: "V",
      precision: 3
    },
    {
      key: "hysteresis",
      label: "Hysteresis Band",
      symbol: "\u0394V_hyst",
      unit: "mV",
      precision: 2
    },
    {
      key: "r1Calc",
      label: "Calculated R1 (for desired hyst%)",
      symbol: "R1_calc",
      unit: "k\u03A9",
      precision: 3
    },
    {
      key: "r2Calc",
      label: "R2 (used)",
      symbol: "R2_used",
      unit: "k\u03A9",
      precision: 3
    }
  ],
  calculate: calculateComparatorHysteresis,
  formula: {
    primary: "V_T+ = V_ref \xD7 R2/(R1+R2) + V_cc \xD7 R1/(R1+R2), V_T\u2212 = V_ref \xD7 R2/(R1+R2)",
    variables: [
      { symbol: "V_ref", description: "Reference voltage", unit: "V" },
      { symbol: "V_cc", description: "Supply voltage", unit: "V" },
      { symbol: "R1", description: "Feedback resistor", unit: "\u03A9" },
      { symbol: "R2", description: "Input resistor", unit: "\u03A9" },
      { symbol: "\u0394V", description: "Hysteresis band", unit: "V" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["opamp-gain", "bjt-bias-point", "voltage-divider"]
};

// src/lib/calculators/general/555-timer.ts
function calculate555Timer(inputs) {
  const { mode, ra, rb, c, vcc } = inputs;
  const ra_Ohm = Math.max(ra, 1e-3) * 1e3;
  const rb_Ohm = Math.max(rb, 1e-3) * 1e3;
  const c_F = Math.max(c, 1e-4) * 1e-6;
  let frequency;
  let period;
  let pulseWidth;
  let dutyCycle;
  let highTime;
  let lowTime;
  if (mode >= 1) {
    pulseWidth = 1.1 * ra_Ohm * c_F * 1e3;
    highTime = pulseWidth;
    lowTime = 0;
    period = 0;
    frequency = 0;
    dutyCycle = 0;
  } else {
    highTime = 0.693 * (ra_Ohm + rb_Ohm) * c_F * 1e3;
    lowTime = 0.693 * rb_Ohm * c_F * 1e3;
    period = highTime + lowTime;
    frequency = period > 0 ? 1e3 / period : 0;
    dutyCycle = period > 0 ? highTime / period * 100 : 0;
    pulseWidth = highTime;
  }
  return {
    values: {
      frequency,
      period,
      pulseWidth,
      dutyCycle,
      highTime,
      lowTime
    }
  };
}
var timer555 = {
  slug: "555-timer",
  title: "555 Timer Calculator (Astable & Monostable)",
  shortTitle: "555 Timer",
  category: "general",
  description: "Calculate 555 timer frequency, period, duty cycle, and pulse width for both astable oscillator and monostable one-shot configurations",
  keywords: [
    "555 timer",
    "astable",
    "monostable",
    "timer circuit",
    "oscillator",
    "pulse generator",
    "NE555",
    "555 oscillator",
    "one-shot timer"
  ],
  inputs: [
    {
      key: "mode",
      label: "Timer Mode",
      symbol: "mode",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 1,
      presets: [
        { label: "Astable (oscillator)", values: { mode: 0 } },
        { label: "Monostable (one-shot)", values: { mode: 1 } }
      ]
    },
    {
      key: "ra",
      label: "Resistor RA",
      symbol: "R_A",
      unit: "k\u03A9",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Timing resistor RA (connected between VCC and discharge pin)"
    },
    {
      key: "rb",
      label: "Resistor RB",
      symbol: "R_B",
      unit: "k\u03A9",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Timing resistor RB (astable: between discharge and threshold; monostable: not used)"
    },
    {
      key: "c",
      label: "Timing Capacitor",
      symbol: "C",
      unit: "\u03BCF",
      defaultValue: 0.1,
      min: 1e-4
    },
    {
      key: "vcc",
      label: "Supply Voltage",
      symbol: "V_CC",
      unit: "V",
      defaultValue: 5,
      min: 1,
      max: 16
    }
  ],
  outputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "Hz",
      precision: 3
    },
    {
      key: "period",
      label: "Period",
      symbol: "T",
      unit: "ms",
      precision: 3
    },
    {
      key: "pulseWidth",
      label: "Pulse Width (high time)",
      symbol: "t_H",
      unit: "ms",
      precision: 3
    },
    {
      key: "dutyCycle",
      label: "Duty Cycle",
      symbol: "D",
      unit: "%",
      precision: 2
    },
    {
      key: "highTime",
      label: "High Time",
      symbol: "t_H",
      unit: "ms",
      precision: 3
    },
    {
      key: "lowTime",
      label: "Low Time",
      symbol: "t_L",
      unit: "ms",
      precision: 3
    }
  ],
  calculate: calculate555Timer,
  formula: {
    primary: "Astable: f = 1.44/((R_A+2R_B)\xD7C), Monostable: t = 1.1\xD7R_A\xD7C",
    variables: [
      { symbol: "R_A", description: "Timing resistor A", unit: "\u03A9" },
      { symbol: "R_B", description: "Timing resistor B", unit: "\u03A9" },
      { symbol: "C", description: "Timing capacitor", unit: "F" },
      { symbol: "f", description: "Frequency (astable)", unit: "Hz" },
      { symbol: "t", description: "Pulse width (monostable)", unit: "s" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["pwm-duty-cycle", "rc-time-constant", "comparator-hysteresis"]
};

// src/lib/calculators/general/transistor-switch.ts
function calculateTransistorSwitch(inputs) {
  const { vcc, loadResistor, inputVoltage, beta, vbe, vce_sat, overdriveFactor } = inputs;
  const safeLoadR = Math.max(loadResistor, 1e-3);
  const safeBeta = Math.max(beta, 1);
  const loadCurrent = (vcc - vce_sat) / safeLoadR * 1e3;
  const ib_required = loadCurrent / safeBeta * 1e3;
  const ib_design_A = ib_required * overdriveFactor * 1e-6;
  const vDrive = Math.max(inputVoltage - vbe, 0);
  const rb = vDrive / Math.max(ib_design_A, 1e-12) / 1e3;
  const rb_Ohm = rb * 1e3;
  const ib_actual = vDrive / Math.max(rb_Ohm, 1e-3) * 1e6;
  const powerDissipation = loadCurrent / 1e3 * vce_sat * 1e3;
  const switchingState = ib_actual >= ib_required ? 1 : 0;
  return {
    values: {
      loadCurrent,
      ib_required,
      rb,
      powerDissipation,
      switchingState,
      ib_actual
    }
  };
}
var transistorSwitch = {
  slug: "transistor-switch",
  title: "BJT Transistor Switch Calculator",
  shortTitle: "Transistor Switch",
  category: "general",
  description: "Calculate BJT transistor switch parameters including load current, required base current, base resistor value, saturation check, and power dissipation",
  keywords: [
    "transistor switch",
    "BJT switch",
    "saturation",
    "switching circuit",
    "base resistor",
    "NPN switch",
    "digital switch",
    "transistor saturation"
  ],
  inputs: [
    {
      key: "vcc",
      label: "Supply Voltage",
      symbol: "V_CC",
      unit: "V",
      defaultValue: 5,
      min: 0.1
    },
    {
      key: "loadResistor",
      label: "Load Resistance",
      symbol: "R_L",
      unit: "\u03A9",
      defaultValue: 100,
      min: 0.1
    },
    {
      key: "inputVoltage",
      label: "Input Drive Voltage",
      symbol: "V_in",
      unit: "V",
      defaultValue: 3.3,
      min: 0,
      tooltip: "Logic-high voltage driving the transistor base through R_B"
    },
    {
      key: "beta",
      label: "Current Gain (\u03B2)",
      symbol: "\u03B2",
      unit: "",
      defaultValue: 100,
      min: 1,
      tooltip: "Minimum DC current gain (hFE) from datasheet"
    },
    {
      key: "vbe",
      label: "Base-Emitter Voltage",
      symbol: "V_BE",
      unit: "V",
      defaultValue: 0.7,
      min: 0.1,
      max: 0.9
    },
    {
      key: "vce_sat",
      label: "Saturation Voltage VCE(sat)",
      symbol: "V_CE(sat)",
      unit: "V",
      defaultValue: 0.2,
      min: 0.01,
      tooltip: "Collector-emitter saturation voltage from datasheet"
    },
    {
      key: "overdriveFactor",
      label: "Overdrive Factor",
      symbol: "OD",
      unit: "\xD7",
      defaultValue: 5,
      min: 1,
      max: 20,
      tooltip: "Factor by which base current exceeds minimum required (typically 5-10\xD7)"
    }
  ],
  outputs: [
    {
      key: "loadCurrent",
      label: "Load Current",
      symbol: "I_C",
      unit: "mA",
      precision: 3
    },
    {
      key: "ib_required",
      label: "Required Base Current",
      symbol: "I_B(min)",
      unit: "\u03BCA",
      precision: 2
    },
    {
      key: "rb",
      label: "Base Resistor",
      symbol: "R_B",
      unit: "k\u03A9",
      precision: 3
    },
    {
      key: "ib_actual",
      label: "Actual Base Current",
      symbol: "I_B(act)",
      unit: "\u03BCA",
      precision: 2
    },
    {
      key: "powerDissipation",
      label: "Transistor Power Dissipation",
      symbol: "P_D",
      unit: "mW",
      precision: 2
    },
    {
      key: "switchingState",
      label: "Saturated? (1=Yes, 0=No)",
      symbol: "sat",
      unit: "",
      precision: 0,
      thresholds: {
        good: { min: 1 },
        danger: { max: 1 }
      }
    }
  ],
  calculate: calculateTransistorSwitch,
  formula: {
    primary: "I_C = (V_CC \u2212 V_CE(sat)) / R_L, R_B = (V_in \u2212 V_BE) / (I_B(min) \xD7 OD)",
    variables: [
      { symbol: "I_C", description: "Collector (load) current", unit: "A" },
      { symbol: "I_B", description: "Base current", unit: "A" },
      { symbol: "R_B", description: "Base resistor", unit: "\u03A9" },
      { symbol: "\u03B2", description: "Current gain", unit: "" },
      { symbol: "OD", description: "Overdrive factor", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["bjt-bias-point", "mosfet-operating-point", "led-resistor"]
};

// src/lib/calculators/general/current-mirror.ts
function calculateCurrentMirror(inputs) {
  const { refCurrent, ratio, vcc, beta, vt } = inputs;
  const safeRef = Math.max(refCurrent, 1e-3);
  const safeRatio = Math.max(ratio, 1e-3);
  const safeBeta = Math.max(beta, 1);
  const safeVcc = Math.max(vcc, 0.1);
  const idealOutput = safeRef * safeRatio;
  const actualCurrent = safeRef * safeRatio * safeBeta / Math.max(safeBeta + 2, 1);
  const error = (idealOutput - actualCurrent) / Math.max(idealOutput, 1e-3) * 100;
  const refResistor = (safeVcc - 0.7) / (safeRef / 1e3) / 1e3;
  const powerRef = safeRef / 1e3 * safeVcc * 1e3;
  let widlarResistor = 0;
  if (safeRatio < 1 && safeRatio > 0) {
    const outputCurrentMa = safeRef * safeRatio;
    const vt_V = vt / 1e3;
    widlarResistor = vt_V * Math.log(safeRef / Math.max(outputCurrentMa, 1e-4)) / Math.max(outputCurrentMa / 1e3, 1e-9) / 1e3;
  }
  return {
    values: {
      outputCurrent: actualCurrent,
      refResistor,
      powerRef,
      error,
      widlarResistor
    }
  };
}
var currentMirror = {
  slug: "current-mirror",
  title: "Current Mirror Calculator",
  shortTitle: "Current Mirror",
  category: "general",
  description: "Calculate current mirror output current, beta error, reference resistor, power consumption, and Widlar mirror resistor for analog IC and bias circuit design",
  keywords: [
    "current mirror",
    "Widlar mirror",
    "Wilson mirror",
    "bias circuit",
    "IC design",
    "analog design",
    "current source",
    "BJT current mirror"
  ],
  inputs: [
    {
      key: "refCurrent",
      label: "Reference Current",
      symbol: "I_ref",
      unit: "mA",
      defaultValue: 1,
      min: 1e-3
    },
    {
      key: "ratio",
      label: "Mirror Ratio (Iout/Iref)",
      symbol: "N",
      unit: "\xD7",
      defaultValue: 2,
      min: 1e-3,
      step: 0.5,
      presets: [
        { label: "0.1\xD7 (Widlar)", values: { ratio: 0.1 } },
        { label: "1\xD7 (unity)", values: { ratio: 1 } },
        { label: "2\xD7 (double)", values: { ratio: 2 } },
        { label: "5\xD7 (5\xD7)", values: { ratio: 5 } }
      ]
    },
    {
      key: "vcc",
      label: "Supply Voltage",
      symbol: "V_CC",
      unit: "V",
      defaultValue: 5,
      min: 0.1
    },
    {
      key: "beta",
      label: "Transistor \u03B2 (hFE)",
      symbol: "\u03B2",
      unit: "",
      defaultValue: 100,
      min: 1
    },
    {
      key: "vt",
      label: "Thermal Voltage",
      symbol: "V_T",
      unit: "mV",
      defaultValue: 26,
      min: 10,
      max: 50,
      tooltip: "Thermal voltage kT/q \u2248 26 mV at room temperature"
    }
  ],
  outputs: [
    {
      key: "outputCurrent",
      label: "Output Current (with \u03B2 error)",
      symbol: "I_out",
      unit: "mA",
      precision: 4
    },
    {
      key: "refResistor",
      label: "Reference Resistor",
      symbol: "R_ref",
      unit: "k\u03A9",
      precision: 3
    },
    {
      key: "powerRef",
      label: "Reference Branch Power",
      symbol: "P_ref",
      unit: "mW",
      precision: 3
    },
    {
      key: "error",
      label: "\u03B2 Error",
      symbol: "\u03B5_\u03B2",
      unit: "%",
      precision: 2,
      thresholds: {
        good: { max: 1 },
        warning: { max: 5 },
        danger: { max: 5 }
      }
    },
    {
      key: "widlarResistor",
      label: "Widlar Resistor (ratio<1)",
      symbol: "R_W",
      unit: "k\u03A9",
      precision: 3,
      tooltip: "Widlar emitter resistor value \u2014 only applicable when mirror ratio < 1"
    }
  ],
  calculate: calculateCurrentMirror,
  formula: {
    primary: "I_out = N \xD7 I_ref \xD7 \u03B2/(\u03B2+2), R_ref = (V_CC \u2212 V_BE) / I_ref",
    variables: [
      { symbol: "I_ref", description: "Reference current", unit: "A" },
      { symbol: "N", description: "Mirror ratio", unit: "" },
      { symbol: "\u03B2", description: "Transistor current gain", unit: "" },
      { symbol: "V_T", description: "Thermal voltage", unit: "V" },
      { symbol: "R_W", description: "Widlar emitter resistor", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["bjt-bias-point", "transistor-switch", "opamp-gain"]
};

// src/lib/calculators/thermal/thermal-resistance-network.ts
function calculateThermalResistanceNetwork(inputs) {
  const { powerDissipation, thetaJC, thetaCS, thetaSA, ambientTemp } = inputs;
  const totalThetaJA = thetaJC + thetaCS + thetaSA;
  const junctionTemp = ambientTemp + powerDissipation * totalThetaJA;
  const caseTemp = ambientTemp + powerDissipation * (thetaCS + thetaSA);
  const heatsinkTemp = ambientTemp + powerDissipation * thetaSA;
  const thermalMargin = 150 - junctionTemp;
  return {
    values: {
      junctionTemp,
      caseTemp,
      heatsinkTemp,
      totalThetaJA,
      thermalMargin
    }
  };
}
var thermalResistanceNetwork = {
  slug: "thermal-resistance-network",
  title: "Thermal Resistance Network Calculator",
  shortTitle: "Thermal Resistance Network",
  category: "thermal",
  description: "Calculate junction, case, and heatsink temperatures through a series thermal resistance network (\u03B8JC + \u03B8CS + \u03B8SA) for component thermal management",
  keywords: [
    "thermal resistance",
    "junction temperature",
    "heatsink",
    "thermal network",
    "\u03B8JC",
    "\u03B8CS",
    "\u03B8SA",
    "thermal management",
    "semiconductor cooling"
  ],
  inputs: [
    {
      key: "powerDissipation",
      label: "Power Dissipation",
      symbol: "P_D",
      unit: "W",
      defaultValue: 5,
      min: 1e-3,
      tooltip: "Total power dissipated by the device"
    },
    {
      key: "thetaJC",
      label: "Junction-to-Case (\u03B8JC)",
      symbol: "\u03B8_JC",
      unit: "\xB0C/W",
      defaultValue: 2,
      min: 0.01,
      tooltip: "Junction-to-case thermal resistance from device datasheet"
    },
    {
      key: "thetaCS",
      label: "Case-to-Heatsink (\u03B8CS)",
      symbol: "\u03B8_CS",
      unit: "\xB0C/W",
      defaultValue: 0.5,
      min: 0,
      tooltip: "Case-to-heatsink thermal resistance (thermal interface material)"
    },
    {
      key: "thetaSA",
      label: "Heatsink-to-Ambient (\u03B8SA)",
      symbol: "\u03B8_SA",
      unit: "\xB0C/W",
      defaultValue: 10,
      min: 0.1,
      tooltip: "Heatsink-to-ambient thermal resistance (heatsink specification)"
    },
    {
      key: "ambientTemp",
      label: "Ambient Temperature",
      symbol: "T_A",
      unit: "\xB0C",
      defaultValue: 25,
      min: -55,
      max: 85,
      presets: [
        { label: "25\xB0C (room)", values: { ambientTemp: 25 } },
        { label: "40\xB0C (warm)", values: { ambientTemp: 40 } },
        { label: "70\xB0C (hot)", values: { ambientTemp: 70 } },
        { label: "85\xB0C (max spec)", values: { ambientTemp: 85 } }
      ]
    }
  ],
  outputs: [
    {
      key: "junctionTemp",
      label: "Junction Temperature",
      symbol: "T_J",
      unit: "\xB0C",
      precision: 1,
      thresholds: {
        good: { max: 100 },
        warning: { max: 125 },
        danger: { max: 125 }
      }
    },
    {
      key: "caseTemp",
      label: "Case Temperature",
      symbol: "T_C",
      unit: "\xB0C",
      precision: 1
    },
    {
      key: "heatsinkTemp",
      label: "Heatsink Temperature",
      symbol: "T_S",
      unit: "\xB0C",
      precision: 1
    },
    {
      key: "totalThetaJA",
      label: "Total \u03B8JA",
      symbol: "\u03B8_JA",
      unit: "\xB0C/W",
      precision: 2
    },
    {
      key: "thermalMargin",
      label: "Thermal Margin (to 150\xB0C)",
      symbol: "\u0394T_margin",
      unit: "\xB0C",
      precision: 1,
      thresholds: {
        good: { min: 50 },
        warning: { min: 20 },
        danger: { min: 0 }
      }
    }
  ],
  calculate: calculateThermalResistanceNetwork,
  formula: {
    primary: "T_J = T_A + P_D \xD7 (\u03B8_JC + \u03B8_CS + \u03B8_SA)",
    variables: [
      { symbol: "T_J", description: "Junction temperature", unit: "\xB0C" },
      { symbol: "T_A", description: "Ambient temperature", unit: "\xB0C" },
      { symbol: "P_D", description: "Power dissipation", unit: "W" },
      { symbol: "\u03B8_JC", description: "Junction-to-case thermal resistance", unit: "\xB0C/W" },
      { symbol: "\u03B8_CS", description: "Case-to-heatsink thermal resistance", unit: "\xB0C/W" },
      { symbol: "\u03B8_SA", description: "Heatsink-to-ambient thermal resistance", unit: "\xB0C/W" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["via-thermal-resistance", "linear-regulator-dropout", "mosfet-power-dissipation"]
};

// src/lib/calculators/motor/bldc-motor.ts
function calculateBldcMotor(inputs) {
  const { kvRating, voltage, motorResistance, noLoadCurrent, propDiameter } = inputs;
  const safeKv = Math.max(kvRating, 1);
  const safeVoltage = Math.max(voltage, 0.1);
  const safeRmOhm = Math.max(motorResistance, 0.1) / 1e3;
  const safeNoLoad = Math.max(noLoadCurrent, 1e-3);
  const safePropDia = Math.max(propDiameter, 0.1);
  const noLoadRpm = safeKv * safeVoltage;
  const stallCurrent = safeVoltage / safeRmOhm;
  const kv_radV = safeKv * (2 * Math.PI / 60);
  const kt = 1 / Math.max(kv_radV, 1e-9);
  const ktMnm = kt * 1e3;
  const stallTorque = kt * stallCurrent;
  const maxEfficiency = Math.pow(1 - Math.sqrt(safeNoLoad / Math.max(stallCurrent, 1e-3)), 2) * 100;
  const iMaxEff = Math.sqrt(safeNoLoad * stallCurrent);
  const inputPower = safeVoltage * iMaxEff;
  const loadedRpm = noLoadRpm * 0.75;
  const thrust = 0.015 * Math.pow(safePropDia, 4) * Math.pow(Math.max(loadedRpm / 1e3, 0), 2);
  return {
    values: {
      noLoadRpm,
      stallCurrent,
      ktMnm,
      stallTorque,
      maxEfficiency,
      inputPower,
      thrust
    }
  };
}
var bldcMotor = {
  slug: "bldc-motor",
  title: "BLDC Motor Performance Calculator",
  shortTitle: "BLDC Motor",
  category: "motor",
  description: "Calculate brushless DC motor no-load RPM, stall torque, maximum efficiency, input power, and propeller thrust from Kv rating and electrical parameters",
  keywords: [
    "BLDC motor",
    "brushless motor",
    "Kv rating",
    "motor torque",
    "motor efficiency",
    "ESC",
    "drone motor",
    "brushless DC",
    "motor Kt"
  ],
  inputs: [
    {
      key: "kvRating",
      label: "Motor Kv Rating",
      symbol: "K_v",
      unit: "RPM/V",
      defaultValue: 1e3,
      min: 1,
      tooltip: "Motor velocity constant \u2014 RPM per volt at no load"
    },
    {
      key: "voltage",
      label: "Operating Voltage",
      symbol: "V",
      unit: "V",
      defaultValue: 12,
      min: 0.1,
      presets: [
        { label: "3S LiPo (11.1V)", values: { voltage: 11.1 } },
        { label: "4S LiPo (14.8V)", values: { voltage: 14.8 } },
        { label: "6S LiPo (22.2V)", values: { voltage: 22.2 } }
      ]
    },
    {
      key: "motorResistance",
      label: "Motor Winding Resistance",
      symbol: "R_m",
      unit: "m\u03A9",
      defaultValue: 50,
      min: 0.1,
      tooltip: "Phase-to-phase winding resistance from datasheet"
    },
    {
      key: "noLoadCurrent",
      label: "No-Load Current",
      symbol: "I_0",
      unit: "A",
      defaultValue: 0.5,
      min: 1e-3,
      tooltip: "No-load current (iron losses, friction) from datasheet"
    },
    {
      key: "propDiameter",
      label: "Propeller Diameter",
      symbol: "d_prop",
      unit: "inch",
      defaultValue: 5,
      min: 0.5,
      tooltip: "Propeller diameter for thrust estimate (multirotor)"
    }
  ],
  outputs: [
    {
      key: "noLoadRpm",
      label: "No-Load RPM",
      symbol: "N_0",
      unit: "RPM",
      precision: 0,
      tooltip: "RPM with no propeller attached (theoretical maximum speed)"
    },
    {
      key: "stallCurrent",
      label: "Stall Current",
      symbol: "I_stall",
      unit: "A",
      precision: 1,
      tooltip: "Theoretical locked-rotor current = V/Rm. Size your ESC well above typical operating current, not stall current."
    },
    {
      key: "ktMnm",
      label: "Torque Constant",
      symbol: "K_t",
      unit: "mNm/A",
      precision: 3,
      tooltip: "Torque produced per amp of current. K_t = 60/(2\u03C0 \xD7 K_v)"
    },
    {
      key: "stallTorque",
      label: "Stall Torque",
      symbol: "T_stall",
      unit: "Nm",
      precision: 4,
      tooltip: "Maximum theoretical torque at locked rotor = K_t \xD7 I_stall"
    },
    {
      key: "maxEfficiency",
      label: "Maximum Efficiency",
      symbol: "\u03B7_max",
      unit: "%",
      precision: 1,
      thresholds: {
        good: { min: 80 },
        warning: { min: 60 },
        danger: { min: 60 }
      }
    },
    {
      key: "inputPower",
      label: "Input Power at Max Efficiency",
      symbol: "P_in",
      unit: "W",
      precision: 1,
      tooltip: "Power drawn at the operating point of maximum efficiency: P = V \xD7 \u221A(I\u2080 \xD7 I_stall)"
    },
    {
      key: "thrust",
      label: "Estimated Thrust",
      symbol: "F_thrust",
      unit: "g",
      precision: 0,
      tooltip: "Empirical estimate assuming ~75% of no-load RPM under prop load. Actual thrust varies with prop pitch, air density, and throttle."
    }
  ],
  calculate: calculateBldcMotor,
  formula: {
    primary: "N_0 = K_v \xD7 V, K_t = 60/(2\u03C0 \xD7 K_v), T_stall = K_t \xD7 I_stall",
    variables: [
      { symbol: "K_v", description: "Velocity constant", unit: "RPM/V" },
      { symbol: "K_t", description: "Torque constant", unit: "Nm/A" },
      { symbol: "N_0", description: "No-load speed", unit: "RPM" },
      { symbol: "I_stall", description: "Stall current", unit: "A" },
      { symbol: "R_m", description: "Winding resistance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["dc-motor-speed", "stepper-motor", "mosfet-power-dissipation"]
};

// src/lib/calculators/motor/servo-motor.ts
function calculateServoMotor(inputs) {
  const { voltage, current, speed, armRes } = inputs;
  const inputPower = voltage * current;
  const backEmf = voltage - current * armRes;
  const speedRads = speed * Math.PI / 30;
  const copperLoss = current * current * armRes;
  const outputPower = Math.max(0, inputPower - copperLoss);
  const efficiency = inputPower > 0 ? Math.min(outputPower / inputPower * 100, 100) : 0;
  const mechanicalTorque = speedRads > 0 ? outputPower / speedRads : 0;
  return { values: { inputPower, outputPower, efficiency, backEmf, stallTorque: mechanicalTorque } };
}
var servoMotor = {
  slug: "servo-motor",
  title: "Servo Motor Torque & Speed",
  shortTitle: "Servo Motor",
  category: "motor",
  description: "Calculate servo motor torque, speed, efficiency, and back-EMF from electrical and load parameters.",
  keywords: ["servo motor", "torque speed", "back EMF", "servo efficiency", "RC servo", "servo power"],
  inputs: [
    { key: "voltage", label: "Supply Voltage", symbol: "V", unit: "V", defaultValue: 5, min: 0 },
    { key: "current", label: "Operating Current", symbol: "I", unit: "A", defaultValue: 0.5, min: 0 },
    { key: "speed", label: "No-Load Speed", symbol: "n", unit: "RPM", defaultValue: 500, min: 1 },
    { key: "loadTorque", label: "Load Torque", symbol: "T_L", unit: "N\xB7m", defaultValue: 0.05, min: 0, step: 1e-3 },
    { key: "armRes", label: "Winding Resistance", symbol: "R_a", unit: "\u03A9", defaultValue: 2, min: 0.1 }
  ],
  outputs: [
    { key: "inputPower", label: "Input Power", symbol: "P_in", unit: "W", precision: 2 },
    { key: "outputPower", label: "Output Power", symbol: "P_out", unit: "W", precision: 3 },
    { key: "efficiency", label: "Efficiency", symbol: "\u03B7", unit: "%", precision: 1, thresholds: { good: { min: 60 }, warning: { min: 40 } } },
    { key: "backEmf", label: "Back-EMF", symbol: "V_emf", unit: "V", precision: 2 },
    { key: "stallTorque", label: "Mechanical Torque", symbol: "T", unit: "N\xB7m", precision: 4, tooltip: "Torque at operating speed: T = P_out / \u03C9" }
  ],
  calculate: calculateServoMotor,
  formula: {
    primary: "T = P_out / \u03C9,  \u03B7 = P_out/P_in \xD7 100%",
    variables: [
      { symbol: "T", description: "Mechanical torque", unit: "N\xB7m" },
      { symbol: "\u03C9", description: "Angular speed (= 2\u03C0 \xD7 RPM / 60)", unit: "rad/s" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["dc-motor-speed", "bldc-motor", "gear-ratio"]
};

// src/lib/calculators/motor/gear-ratio.ts
function calculateGearRatio(inputs) {
  const { driverTeeth, drivenTeeth, inputSpeed, inputTorque, efficiency } = inputs;
  const gearRatio2 = drivenTeeth / driverTeeth;
  const outputSpeed = inputSpeed / gearRatio2;
  const outputTorque = inputTorque * gearRatio2 * (efficiency / 100);
  const inputPower = inputTorque * inputSpeed * Math.PI / 30;
  const outputPower = inputPower * (efficiency / 100);
  return { values: { gearRatio: gearRatio2, outputSpeed, outputTorque, inputPower, outputPower } };
}
var gearRatio = {
  slug: "gear-ratio",
  title: "Gear Ratio Calculator",
  shortTitle: "Gear Ratio",
  category: "motor",
  description: "Calculate gear ratio, output speed, torque multiplication, and power transmission efficiency for gear trains.",
  keywords: ["gear ratio", "gear train", "torque multiplication", "speed reduction", "gear efficiency", "planetary gear"],
  inputs: [
    { key: "driverTeeth", label: "Driver (Input) Teeth", symbol: "N\u2081", unit: "teeth", defaultValue: 10, min: 1 },
    { key: "drivenTeeth", label: "Driven (Output) Teeth", symbol: "N\u2082", unit: "teeth", defaultValue: 40, min: 1 },
    { key: "inputSpeed", label: "Input Speed", symbol: "n\u2081", unit: "RPM", defaultValue: 1e3, min: 0 },
    { key: "inputTorque", label: "Input Torque", symbol: "T\u2081", unit: "N\xB7m", defaultValue: 0.5, min: 0, step: 0.01 },
    { key: "efficiency", label: "Gear Efficiency", symbol: "\u03B7", unit: "%", defaultValue: 95, min: 10, max: 100 }
  ],
  outputs: [
    { key: "gearRatio", label: "Gear Ratio", symbol: "GR", unit: ":1", precision: 2 },
    { key: "outputSpeed", label: "Output Speed", symbol: "n\u2082", unit: "RPM", precision: 1 },
    { key: "outputTorque", label: "Output Torque", symbol: "T\u2082", unit: "N\xB7m", precision: 3 },
    { key: "inputPower", label: "Input Power", symbol: "P_in", unit: "W", precision: 2 },
    { key: "outputPower", label: "Output Power", symbol: "P_out", unit: "W", precision: 2 }
  ],
  calculate: calculateGearRatio,
  formula: {
    primary: "GR = N\u2082/N\u2081,  n\u2082 = n\u2081/GR,  T\u2082 = T\u2081 \xD7 GR \xD7 \u03B7",
    variables: [
      { symbol: "N\u2081", description: "Driver teeth count", unit: "" },
      { symbol: "N\u2082", description: "Driven teeth count", unit: "" },
      { symbol: "\u03B7", description: "Gear efficiency", unit: "%" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["servo-motor", "dc-motor-speed", "torque-unit-converter"]
};

// src/lib/calculators/motor/pwm-duty-cycle-motor.ts
function calculatePwmDutyCycleMotor(inputs) {
  const { supplyVoltage, dutyCycle, motorKv, motorResistance } = inputs;
  const effectiveVoltage = supplyVoltage * (dutyCycle / 100);
  const noLoadSpeed = effectiveVoltage * motorKv;
  const stallCurrent = effectiveVoltage / motorResistance;
  const peakPower = effectiveVoltage * stallCurrent;
  const rippleVoltageFactor = supplyVoltage * (dutyCycle / 100) * (1 - dutyCycle / 100);
  return { values: { effectiveVoltage, noLoadSpeed, stallCurrent, peakPower, rippleVoltageFactor } };
}
var pwmDutyCycleMotor = {
  slug: "pwm-duty-cycle-motor",
  title: "PWM Duty Cycle to Motor Voltage",
  shortTitle: "PWM Motor Speed",
  category: "motor",
  description: "Convert PWM duty cycle to effective motor voltage, calculate no-load speed and stall current for DC motor PWM control.",
  keywords: ["PWM duty cycle", "motor voltage", "PWM motor control", "effective voltage", "motor speed control", "H-bridge PWM"],
  inputs: [
    { key: "supplyVoltage", label: "Supply Voltage", symbol: "V_s", unit: "V", defaultValue: 12, min: 0.1 },
    { key: "dutyCycle", label: "Duty Cycle", symbol: "D", unit: "%", defaultValue: 75, min: 0, max: 100 },
    { key: "motorKv", label: "Motor Kv Constant", symbol: "Kv", unit: "RPM/V", defaultValue: 100, min: 1, tooltip: "Speed per volt at no load" },
    { key: "motorResistance", label: "Winding Resistance", symbol: "R", unit: "\u03A9", defaultValue: 1.5, min: 0.01 }
  ],
  outputs: [
    { key: "effectiveVoltage", label: "Effective Voltage", symbol: "V_eff", unit: "V", precision: 2 },
    { key: "noLoadSpeed", label: "No-Load Speed", symbol: "n\u2080", unit: "RPM", precision: 0 },
    { key: "stallCurrent", label: "Stall Current", symbol: "I_s", unit: "A", precision: 2, thresholds: { good: { max: 10 }, warning: { max: 20 } } },
    { key: "peakPower", label: "Peak Power (stall)", symbol: "P_s", unit: "W", precision: 1 },
    { key: "rippleVoltageFactor", label: "PWM Voltage Factor", symbol: "\u0394V", unit: "V", precision: 3, tooltip: "Voltage ripple factor \u2014 V_s \xD7 D \xD7 (1\u2212D); indicates PWM voltage variation, not current" }
  ],
  calculate: calculatePwmDutyCycleMotor,
  formula: {
    primary: "V_eff = V_s \xD7 D,  n\u2080 = V_eff \xD7 Kv",
    variables: [
      { symbol: "D", description: "Duty cycle (0\u20131)", unit: "" },
      { symbol: "Kv", description: "Motor speed constant", unit: "RPM/V" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["dc-motor-speed", "h-bridge-selection", "motor-driver-power"]
};

// src/lib/calculators/motor/torque-unit-converter.ts
function calculateTorqueUnitConverter(inputs) {
  const { nm } = inputs;
  const lbFt = nm * 0.737562;
  const lbIn = nm * 8.85075;
  const ozIn = nm * 141.612;
  const kgCm = nm * 10.1972;
  const kgM = nm * 0.101972;
  const dyneCm = nm * 1e7;
  return { values: { lbFt, lbIn, ozIn, kgCm, kgM, dyneCm } };
}
var torqueUnitConverter = {
  slug: "torque-unit-converter",
  title: "Torque Unit Converter",
  shortTitle: "Torque Converter",
  category: "motor",
  description: "Convert torque between Newton-metres, pound-feet, pound-inches, oz\xB7in, kg\xB7cm and dyne\xB7cm \u2014 covers all motor datasheet units.",
  keywords: ["torque converter", "N\xB7m to lb\xB7ft", "oz-in to N-m", "kg-cm torque", "torque unit conversion", "motor torque units"],
  inputs: [
    {
      key: "nm",
      label: "Torque",
      symbol: "T",
      unit: "N\xB7m",
      defaultValue: 1,
      min: 0,
      step: 1e-3,
      presets: [
        { label: "Micro servo (0.05 N\xB7m)", values: { nm: 0.05 } },
        { label: "Small motor (0.5 N\xB7m)", values: { nm: 0.5 } },
        { label: "Stepper motor (1 N\xB7m)", values: { nm: 1 } },
        { label: "Automotive starter (50 N\xB7m)", values: { nm: 50 } }
      ]
    }
  ],
  outputs: [
    { key: "lbFt", label: "Pound-feet", symbol: "lb\xB7ft", unit: "lb\xB7ft", precision: 4 },
    { key: "lbIn", label: "Pound-inches", symbol: "lb\xB7in", unit: "lb\xB7in", precision: 3 },
    { key: "ozIn", label: "Oz-inches", symbol: "oz\xB7in", unit: "oz\xB7in", precision: 2 },
    { key: "kgCm", label: "Kilogram-cm", symbol: "kg\xB7cm", unit: "kg\xB7cm", precision: 3 },
    { key: "kgM", label: "Kilogram-metres", symbol: "kg\xB7m", unit: "kg\xB7m", precision: 4 },
    { key: "dyneCm", label: "Dyne-centimetres", symbol: "dyn\xB7cm", unit: "dyn\xB7cm", precision: 0 }
  ],
  calculate: calculateTorqueUnitConverter,
  formula: {
    primary: "1 N\xB7m = 0.7376 lb\xB7ft = 8.851 lb\xB7in = 141.6 oz\xB7in",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["gear-ratio", "servo-motor", "dc-motor-speed"]
};

// src/lib/calculators/motor/motor-efficiency.ts
function calculateMotorEfficiency(inputs) {
  const { inputVoltage, inputCurrent, outputPowerW } = inputs;
  const inputPower = inputVoltage * inputCurrent;
  const efficiency = inputPower > 0 ? outputPowerW / inputPower * 100 : 0;
  const losses = inputPower - outputPowerW;
  const heatDissipation = losses;
  if (outputPowerW > inputPower) {
    return { values: {}, errors: ["Output power cannot exceed input power"] };
  }
  return { values: { inputPower, efficiency, losses, heatDissipation } };
}
var motorEfficiency = {
  slug: "motor-efficiency",
  title: "Motor Input/Output Efficiency",
  shortTitle: "Motor Efficiency",
  category: "motor",
  description: "Calculate motor efficiency, power losses, and heat dissipation from electrical input and mechanical output measurements.",
  keywords: ["motor efficiency", "motor losses", "motor heat", "efficiency percentage", "motor power", "motor thermal"],
  inputs: [
    { key: "inputVoltage", label: "Supply Voltage", symbol: "V", unit: "V", defaultValue: 12, min: 0.1 },
    { key: "inputCurrent", label: "Supply Current", symbol: "I", unit: "A", defaultValue: 2, min: 0 },
    { key: "outputPowerW", label: "Mechanical Output Power", symbol: "P_out", unit: "W", defaultValue: 18, min: 0, tooltip: "Measure with a torque + speed sensor, or use P = T \xD7 \u03C9" }
  ],
  outputs: [
    { key: "inputPower", label: "Input Power", symbol: "P_in", unit: "W", precision: 2 },
    { key: "efficiency", label: "Efficiency", symbol: "\u03B7", unit: "%", precision: 1, thresholds: { good: { min: 75 }, warning: { min: 50 } } },
    { key: "losses", label: "Total Losses", symbol: "P_loss", unit: "W", precision: 2 },
    { key: "heatDissipation", label: "Heat Dissipated", symbol: "Q", unit: "W", precision: 2 }
  ],
  calculate: calculateMotorEfficiency,
  formula: {
    primary: "\u03B7 = P_out / P_in \xD7 100%,  P_loss = P_in \u2212 P_out",
    variables: [
      { symbol: "\u03B7", description: "Efficiency", unit: "%" },
      { symbol: "P_in", description: "Electrical input power", unit: "W" },
      { symbol: "P_out", description: "Mechanical output power", unit: "W" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["dc-motor-speed", "motor-heat-dissipation", "bldc-motor"]
};

// src/lib/calculators/motor/induction-motor-slip.ts
function calculateInductionMotorSlip(inputs) {
  const { syncSpeed, rotorSpeed, poles, frequency } = inputs;
  const calculatedSyncSpeed = 120 * frequency / poles;
  const effectiveSyncSpeed = syncSpeed > 0 ? syncSpeed : calculatedSyncSpeed;
  if (effectiveSyncSpeed <= 0) {
    return { values: {}, errors: ["Synchronous speed must be greater than zero"] };
  }
  const slip = (effectiveSyncSpeed - rotorSpeed) / effectiveSyncSpeed;
  const slipPercent = slip * 100;
  const slipFrequency = slip * frequency;
  const slipRPM = effectiveSyncSpeed - rotorSpeed;
  return { values: { effectiveSyncSpeed, slip, slipPercent, slipFrequency, slipRPM } };
}
var inductionMotorSlip = {
  slug: "induction-motor-slip",
  title: "Induction Motor Slip",
  shortTitle: "Motor Slip",
  category: "motor",
  description: "Calculate induction motor slip, synchronous speed, slip frequency, and rotor speed for AC induction motors.",
  keywords: ["induction motor", "motor slip", "synchronous speed", "slip frequency", "AC motor", "slip RPM"],
  inputs: [
    {
      key: "frequency",
      label: "Supply Frequency",
      symbol: "f",
      unit: "Hz",
      defaultValue: 60,
      min: 1,
      presets: [
        { label: "50 Hz (Europe)", values: { frequency: 50 } },
        { label: "60 Hz (North America)", values: { frequency: 60 } }
      ]
    },
    { key: "poles", label: "Number of Poles", symbol: "p", unit: "", defaultValue: 4, min: 2, step: 2, tooltip: "Must be even (2, 4, 6, 8...)" },
    { key: "rotorSpeed", label: "Rotor Speed (actual)", symbol: "n_r", unit: "RPM", defaultValue: 1750, min: 0 },
    { key: "syncSpeed", label: "Synchronous Speed (override)", symbol: "n_s", unit: "RPM", defaultValue: 0, min: 0, tooltip: "Leave 0 to calculate from frequency and poles" }
  ],
  outputs: [
    { key: "effectiveSyncSpeed", label: "Synchronous Speed", symbol: "n_s", unit: "RPM", precision: 0 },
    { key: "slipPercent", label: "Slip", symbol: "s", unit: "%", precision: 2, thresholds: { good: { max: 5 }, warning: { max: 10 } } },
    { key: "slipRPM", label: "Speed Difference", symbol: "\u0394n", unit: "RPM", precision: 0 },
    { key: "slipFrequency", label: "Rotor Frequency", symbol: "f_r", unit: "Hz", precision: 2 },
    { key: "slip", label: "Slip (per-unit)", symbol: "s", unit: "", precision: 4 }
  ],
  calculate: calculateInductionMotorSlip,
  formula: {
    primary: "n_s = 120f/p,  s = (n_s \u2212 n_r)/n_s",
    variables: [
      { symbol: "n_s", description: "Synchronous speed", unit: "RPM" },
      { symbol: "n_r", description: "Rotor speed", unit: "RPM" },
      { symbol: "f", description: "Supply frequency", unit: "Hz" },
      { symbol: "p", description: "Number of poles", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["dc-motor-speed", "motor-efficiency", "three-phase-power"]
};

// src/lib/calculators/motor/motor-inrush-current.ts
function calculateMotorInrushCurrent(inputs) {
  const { ratedCurrent, inrushMultiplier, startupDuration, supplyVoltage, lineResistance } = inputs;
  const inrushCurrent = ratedCurrent * inrushMultiplier;
  const voltageDropAtInrush = inrushCurrent * lineResistance;
  const voltageDropPercent = voltageDropAtInrush / supplyVoltage * 100;
  const fuseISquaredT = inrushCurrent * inrushCurrent * startupDuration;
  const peakPower = inrushCurrent * supplyVoltage;
  return { values: { inrushCurrent, voltageDropAtInrush, voltageDropPercent, fuseISquaredT, peakPower } };
}
var motorInrushCurrent = {
  slug: "motor-inrush-current",
  title: "Motor Inrush Current",
  shortTitle: "Motor Inrush",
  category: "motor",
  description: "Calculate motor inrush current, voltage drop during startup, and I\xB2t value for fuse/breaker selection.",
  keywords: ["motor inrush current", "startup current", "locked rotor current", "I2t fuse", "motor protection", "motor soft start"],
  inputs: [
    { key: "ratedCurrent", label: "Rated Full-Load Current", symbol: "I_FL", unit: "A", defaultValue: 5, min: 0.01 },
    { key: "inrushMultiplier", label: "Inrush Multiplier", symbol: "k", unit: "\xD7", defaultValue: 6, min: 1, max: 15, tooltip: "Typically 5\u20138\xD7 for induction motors" },
    { key: "startupDuration", label: "Startup Duration", symbol: "t", unit: "s", defaultValue: 0.1, min: 1e-3, step: 0.01 },
    { key: "supplyVoltage", label: "Supply Voltage", symbol: "V", unit: "V", defaultValue: 120, min: 1 },
    { key: "lineResistance", label: "Line Resistance", symbol: "R_line", unit: "\u03A9", defaultValue: 0.5, min: 0, step: 0.01 }
  ],
  outputs: [
    { key: "inrushCurrent", label: "Inrush Current", symbol: "I_inrush", unit: "A", precision: 1 },
    { key: "voltageDropAtInrush", label: "Voltage Drop", symbol: "\u0394V", unit: "V", precision: 2 },
    { key: "voltageDropPercent", label: "Voltage Drop", symbol: "\u0394V%", unit: "%", precision: 1, thresholds: { good: { max: 3 }, warning: { max: 10 } } },
    { key: "fuseISquaredT", label: "I\xB2t (fuse energy)", symbol: "I\xB2t", unit: "A\xB2s", precision: 0 },
    { key: "peakPower", label: "Peak Power Draw", symbol: "P_peak", unit: "W", precision: 0 }
  ],
  calculate: calculateMotorInrushCurrent,
  formula: {
    primary: "I_inrush = k \xD7 I_FL,  \u0394V = I_inrush \xD7 R_line",
    variables: [
      { symbol: "k", description: "Inrush multiplier (5\u20138 typical)", unit: "\xD7" },
      { symbol: "I\xB2t", description: "Fuse energy rating", unit: "A\xB2\xB7s" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["motor-efficiency", "induction-motor-slip", "dc-motor-speed"]
};

// src/lib/calculators/motor/motor-heat-dissipation.ts
function calculateMotorHeatDissipation(inputs) {
  const { inputPower, efficiency, ambientTemp, thermalResistance } = inputs;
  const losses = inputPower * (1 - efficiency / 100);
  const tempRise = losses * thermalResistance;
  const motorTemp = ambientTemp + tempRise;
  const outputPower = inputPower - losses;
  return { values: { losses, tempRise, motorTemp, outputPower } };
}
var motorHeatDissipation = {
  slug: "motor-heat-dissipation",
  title: "Motor Heat Dissipation",
  shortTitle: "Motor Heat",
  category: "motor",
  description: "Calculate motor heat dissipation, temperature rise, and operating temperature from input power and efficiency.",
  keywords: ["motor heat", "motor temperature", "motor cooling", "motor losses", "thermal resistance motor", "motor temperature rise"],
  inputs: [
    { key: "inputPower", label: "Input Power", symbol: "P_in", unit: "W", defaultValue: 50, min: 0 },
    { key: "efficiency", label: "Motor Efficiency", symbol: "\u03B7", unit: "%", defaultValue: 80, min: 1, max: 100 },
    { key: "ambientTemp", label: "Ambient Temperature", symbol: "T_a", unit: "\xB0C", defaultValue: 25, min: -40, max: 85 },
    { key: "thermalResistance", label: "Thermal Resistance (motor)", symbol: "R\u03B8", unit: "\xB0C/W", defaultValue: 2.5, min: 0.01, tooltip: "Motor winding to ambient thermal resistance from datasheet" }
  ],
  outputs: [
    { key: "losses", label: "Power Losses", symbol: "P_loss", unit: "W", precision: 2 },
    { key: "tempRise", label: "Temperature Rise", symbol: "\u0394T", unit: "\xB0C", precision: 1 },
    { key: "motorTemp", label: "Motor Operating Temp", symbol: "T_m", unit: "\xB0C", precision: 1, thresholds: { good: { max: 80 }, warning: { max: 100 }, danger: { max: 130 } } },
    { key: "outputPower", label: "Output Power", symbol: "P_out", unit: "W", precision: 2 }
  ],
  calculate: calculateMotorHeatDissipation,
  formula: {
    primary: "P_loss = P_in \xD7 (1\u2212\u03B7),  \u0394T = P_loss \xD7 R\u03B8",
    variables: [
      { symbol: "R\u03B8", description: "Winding-to-ambient thermal resistance", unit: "\xB0C/W" },
      { symbol: "\u0394T", description: "Temperature rise above ambient", unit: "\xB0C" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["motor-efficiency", "junction-temperature", "heatsink-calculator"]
};

// src/lib/calculators/motor/encoder-resolution.ts
function calculateEncoderResolution(inputs) {
  const { ppr, quadrature, gearRatio: gearRatio2, motorMaxRpm } = inputs;
  const countsMechanicalRev = quadrature > 0 ? ppr * 4 : ppr;
  const countsPerOutputRev = countsMechanicalRev * gearRatio2;
  const degreePerCount = 360 / countsPerOutputRev;
  const maxFrequency = motorMaxRpm / 60 * ppr;
  return { values: { countsMechanicalRev, countsPerOutputRev, degreePerCount, maxFrequency } };
}
var encoderResolution = {
  slug: "encoder-resolution",
  title: "Encoder Resolution Calculator",
  shortTitle: "Encoder Resolution",
  category: "motor",
  description: "Calculate encoder counts per revolution, angular resolution, and maximum frequency for quadrature and single-channel encoders.",
  keywords: ["encoder resolution", "quadrature encoder", "PPR encoder", "CPR encoder", "encoder counts", "optical encoder"],
  inputs: [
    {
      key: "ppr",
      label: "Pulses Per Revolution (PPR)",
      symbol: "PPR",
      unit: "pulses",
      defaultValue: 1e3,
      min: 1,
      presets: [
        { label: "512 PPR", values: { ppr: 512 } },
        { label: "1000 PPR", values: { ppr: 1e3 } },
        { label: "2000 PPR", values: { ppr: 2e3 } },
        { label: "4096 PPR", values: { ppr: 4096 } }
      ]
    },
    { key: "quadrature", label: "Quadrature (\xD74)", symbol: "\xD74", unit: "", defaultValue: 1, min: 0, max: 1, tooltip: "Set 1 for quadrature (4\xD7 edge count), 0 for single channel" },
    { key: "gearRatio", label: "Gear Ratio", symbol: "GR", unit: ":1", defaultValue: 1, min: 0.01 },
    { key: "motorMaxRpm", label: "Max Motor Speed", symbol: "n_max", unit: "RPM", defaultValue: 3e3, min: 1 }
  ],
  outputs: [
    { key: "countsMechanicalRev", label: "Counts/Motor Rev", symbol: "CPR", unit: "counts", precision: 0 },
    { key: "countsPerOutputRev", label: "Counts/Output Rev", symbol: "CPR_out", unit: "counts", precision: 0 },
    { key: "degreePerCount", label: "Angular Resolution", symbol: "\u03B8/count", unit: "\xB0/count", precision: 4 },
    { key: "maxFrequency", label: "Max Pulse Frequency", symbol: "f_max", unit: "Hz", precision: 0 }
  ],
  calculate: calculateEncoderResolution,
  formula: {
    primary: "CPR = PPR \xD7 4 (quadrature),  \u03B8 = 360\xB0/CPR",
    variables: [
      { symbol: "PPR", description: "Pulses per revolution", unit: "pulses" },
      { symbol: "CPR", description: "Counts per revolution (\xD74 for quadrature)", unit: "counts" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["dc-motor-speed", "servo-motor", "gear-ratio"]
};

// src/lib/calculators/motor/motor-starting-torque.ts
function calculateMotorStartingTorque(inputs) {
  const { voltage, resistance, torqueConst, backEmfConst } = inputs;
  const stallCurrent = voltage / resistance;
  const startingTorque = torqueConst * stallCurrent;
  const noLoadSpeed = voltage / backEmfConst;
  const powerAtStall = voltage * stallCurrent;
  return { values: { stallCurrent, startingTorque, noLoadSpeed, powerAtStall } };
}
var motorStartingTorque = {
  slug: "motor-starting-torque",
  title: "Motor Starting Torque",
  shortTitle: "Starting Torque",
  category: "motor",
  description: "Calculate DC motor starting (stall) torque, stall current, no-load speed, and peak power at startup.",
  keywords: ["motor starting torque", "stall torque", "locked rotor torque", "motor startup", "stall current", "DC motor stall"],
  inputs: [
    { key: "voltage", label: "Supply Voltage", symbol: "V", unit: "V", defaultValue: 12, min: 0.1 },
    { key: "resistance", label: "Winding Resistance", symbol: "R", unit: "\u03A9", defaultValue: 0.5, min: 1e-3 },
    { key: "torqueConst", label: "Torque Constant", symbol: "Kt", unit: "N\xB7m/A", defaultValue: 0.05, min: 1e-3, step: 1e-3 },
    { key: "backEmfConst", label: "Back-EMF Constant", symbol: "Ke", unit: "V/RPM", defaultValue: 0.01, min: 1e-4, step: 1e-3 }
  ],
  outputs: [
    { key: "startingTorque", label: "Starting (Stall) Torque", symbol: "T_s", unit: "N\xB7m", precision: 3 },
    { key: "stallCurrent", label: "Stall Current", symbol: "I_s", unit: "A", precision: 2 },
    { key: "noLoadSpeed", label: "No-Load Speed", symbol: "n\u2080", unit: "RPM", precision: 0 },
    { key: "powerAtStall", label: "Power at Stall", symbol: "P_s", unit: "W", precision: 1 }
  ],
  calculate: calculateMotorStartingTorque,
  formula: {
    primary: "T_s = Kt \xD7 V/R,  I_s = V/R",
    variables: [
      { symbol: "Kt", description: "Torque constant", unit: "N\xB7m/A" },
      { symbol: "R", description: "Winding resistance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["dc-motor-speed", "motor-inrush-current", "gear-ratio"]
};

// src/lib/calculators/motor/battery-runtime-motor.ts
function calculateBatteryRuntimeMotor(inputs) {
  const { batteryCapacityMah, batteryVoltage, motorCurrentA, efficiency, depthOfDischarge } = inputs;
  const usableCapacityMah = batteryCapacityMah * (depthOfDischarge / 100);
  const effectiveCurrent = motorCurrentA / (efficiency / 100);
  const runtimeHours = usableCapacityMah / (effectiveCurrent * 1e3);
  const runtimeMinutes = runtimeHours * 60;
  const energyWh = batteryCapacityMah * batteryVoltage / 1e3;
  return { values: { usableCapacityMah, runtimeHours, runtimeMinutes, energyWh } };
}
var batteryRuntimeMotor = {
  slug: "battery-runtime-motor",
  title: "Battery Runtime (Motor Load)",
  shortTitle: "Motor Battery Life",
  category: "motor",
  description: "Calculate battery runtime for motor-driven systems accounting for motor current draw, efficiency, and depth of discharge.",
  keywords: ["battery runtime motor", "motor battery life", "robot battery", "motor run time", "mAh motor", "battery capacity motor"],
  inputs: [
    { key: "batteryCapacityMah", label: "Battery Capacity", symbol: "C", unit: "mAh", defaultValue: 2e3, min: 1 },
    { key: "batteryVoltage", label: "Battery Voltage", symbol: "V_bat", unit: "V", defaultValue: 3.7, min: 0.5, presets: [
      { label: "LiPo 1S", values: { batteryVoltage: 3.7 } },
      { label: "LiPo 2S", values: { batteryVoltage: 7.4 } },
      { label: "NiMH AA", values: { batteryVoltage: 1.2 } },
      { label: "12V Lead", values: { batteryVoltage: 12 } }
    ] },
    { key: "motorCurrentA", label: "Motor Current (avg)", symbol: "I_avg", unit: "A", defaultValue: 0.5, min: 1e-3 },
    { key: "efficiency", label: "Drive Efficiency", symbol: "\u03B7", unit: "%", defaultValue: 85, min: 10, max: 100, tooltip: "Motor driver + motor combined efficiency" },
    { key: "depthOfDischarge", label: "Depth of Discharge", symbol: "DoD", unit: "%", defaultValue: 80, min: 1, max: 100 }
  ],
  outputs: [
    { key: "runtimeHours", label: "Runtime", symbol: "t", unit: "h", precision: 2 },
    { key: "runtimeMinutes", label: "Runtime", symbol: "t", unit: "min", precision: 0 },
    { key: "usableCapacityMah", label: "Usable Capacity", symbol: "C_use", unit: "mAh", precision: 0 },
    { key: "energyWh", label: "Battery Energy (est.)", symbol: "E", unit: "Wh", precision: 2 }
  ],
  calculate: calculateBatteryRuntimeMotor,
  formula: {
    primary: "t = C_usable / I_draw,  C_usable = C \xD7 DoD",
    variables: [
      { symbol: "C", description: "Battery capacity", unit: "mAh" },
      { symbol: "DoD", description: "Depth of discharge", unit: "%" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["battery-life", "motor-efficiency", "dc-motor-speed"]
};

// src/lib/calculators/motor/motor-winding-resistance.ts
function calculateMotorWindingResistance(inputs) {
  const { resistance25, tempCoeff, temperature } = inputs;
  const deltaT = temperature - 25;
  const resistanceAtTemp = resistance25 * (1 + tempCoeff * deltaT);
  const resistanceChange = resistanceAtTemp - resistance25;
  const resistanceChangePercent = resistanceChange / resistance25 * 100;
  return { values: { resistanceAtTemp, resistanceChange, resistanceChangePercent } };
}
var motorWindingResistance = {
  slug: "motor-winding-resistance",
  title: "Winding Resistance vs Temperature",
  shortTitle: "Winding Resistance",
  category: "motor",
  description: "Calculate motor winding resistance at operating temperature using the copper temperature coefficient of resistance.",
  keywords: ["winding resistance", "motor resistance temperature", "copper TCR", "motor temperature coefficient", "winding temperature", "motor derating"],
  inputs: [
    { key: "resistance25", label: "Resistance at 25\xB0C", symbol: "R\u2082\u2085", unit: "\u03A9", defaultValue: 1, min: 1e-3 },
    { key: "temperature", label: "Operating Temperature", symbol: "T", unit: "\xB0C", defaultValue: 80, min: -40, max: 200 },
    { key: "tempCoeff", label: "Temperature Coefficient", symbol: "\u03B1", unit: "/\xB0C", defaultValue: 393e-5, min: 0, step: 1e-4, tooltip: "Copper: 0.00393/\xB0C, Aluminium: 0.00429/\xB0C" }
  ],
  outputs: [
    { key: "resistanceAtTemp", label: "Resistance at Temp", symbol: "R(T)", unit: "\u03A9", precision: 4 },
    { key: "resistanceChange", label: "Resistance Change", symbol: "\u0394R", unit: "\u03A9", precision: 4 },
    { key: "resistanceChangePercent", label: "Change", symbol: "\u0394R%", unit: "%", precision: 1 }
  ],
  calculate: calculateMotorWindingResistance,
  formula: {
    primary: "R(T) = R\u2082\u2085 \xD7 [1 + \u03B1 \xD7 (T \u2212 25\xB0C)]",
    variables: [
      { symbol: "\u03B1", description: "Temperature coefficient (Cu: 0.00393)", unit: "/\xB0C" },
      { symbol: "T", description: "Operating temperature", unit: "\xB0C" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["motor-heat-dissipation", "motor-efficiency", "dc-motor-speed"]
};

// src/lib/calculators/motor/h-bridge-selection.ts
function calculateHBridgeSelection(inputs) {
  const { motorCurrent, motorVoltage, inrushMultiplier, pwmFrequency, mosfetRdson } = inputs;
  const peakCurrent = motorCurrent * inrushMultiplier;
  const conductionLoss = motorCurrent * motorCurrent * mosfetRdson;
  const switchingLoss = motorVoltage * motorCurrent * 5e-8 * pwmFrequency;
  const totalLoss = (conductionLoss + switchingLoss) * 4;
  const mosfetCurrentRating = peakCurrent * 1.5;
  return { values: { peakCurrent, conductionLoss, switchingLoss, totalLoss, mosfetCurrentRating } };
}
var hBridgeSelection = {
  slug: "h-bridge-selection",
  title: "H-Bridge MOSFET Selection",
  shortTitle: "H-Bridge",
  category: "motor",
  description: "Calculate H-bridge MOSFET requirements including peak current, conduction losses, and minimum current rating for DC motor drivers.",
  keywords: ["H-bridge", "motor driver", "MOSFET selection", "H-bridge design", "motor driver IC", "RDS(on) motor"],
  inputs: [
    { key: "motorCurrent", label: "Motor Rated Current", symbol: "I_rated", unit: "A", defaultValue: 2, min: 0.1 },
    { key: "motorVoltage", label: "Motor Supply Voltage", symbol: "V_m", unit: "V", defaultValue: 12, min: 1 },
    { key: "inrushMultiplier", label: "Inrush Multiplier", symbol: "k", unit: "\xD7", defaultValue: 6, min: 1, max: 15 },
    {
      key: "pwmFrequency",
      label: "PWM Frequency",
      symbol: "f_pwm",
      unit: "Hz",
      defaultValue: 2e4,
      min: 100,
      presets: [
        { label: "20 kHz", values: { pwmFrequency: 2e4 } },
        { label: "50 kHz", values: { pwmFrequency: 5e4 } }
      ]
    },
    { key: "mosfetRdson", label: "MOSFET RDS(on)", symbol: "R_DS", unit: "\u03A9", defaultValue: 0.01, min: 1e-3, step: 1e-3 }
  ],
  outputs: [
    { key: "peakCurrent", label: "Peak Current", symbol: "I_peak", unit: "A", precision: 1 },
    { key: "mosfetCurrentRating", label: "Min. MOSFET Current Rating", symbol: "I_DS_min", unit: "A", precision: 1 },
    { key: "conductionLoss", label: "Conduction Loss (per FET)", symbol: "P_cond", unit: "W", precision: 3 },
    { key: "switchingLoss", label: "Switching Loss (per FET)", symbol: "P_sw", unit: "W", precision: 3 },
    { key: "totalLoss", label: "Total Bridge Loss (est.)", symbol: "P_total", unit: "W", precision: 2 }
  ],
  calculate: calculateHBridgeSelection,
  formula: {
    primary: "I_peak = I_rated \xD7 k,  P_cond = I\xB2\xD7 R_DS(on)",
    variables: [
      { symbol: "k", description: "Inrush multiplier", unit: "\xD7" },
      { symbol: "R_DS", description: "MOSFET on-resistance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["motor-driver-power", "motor-inrush-current", "mosfet-power-dissipation"]
};

// src/lib/calculators/motor/motor-driver-power.ts
function calculateMotorDriverPower(inputs) {
  const { motorCurrent, rdson, dutyCycle, switchingFreq, gateCharge, supplyVoltage } = inputs;
  const conductionLoss = motorCurrent * motorCurrent * rdson * (dutyCycle / 100);
  const switchingLoss = switchingFreq * gateCharge * supplyVoltage * 1e-9;
  const totalLossPerFet = conductionLoss + switchingLoss;
  const totalLossBridge = totalLossPerFet * 4;
  const efficiency = supplyVoltage * motorCurrent > 0 ? (1 - totalLossBridge / (supplyVoltage * motorCurrent)) * 100 : 0;
  return { values: { conductionLoss, switchingLoss, totalLossPerFet, totalLossBridge, efficiency } };
}
var motorDriverPower = {
  slug: "motor-driver-power",
  title: "Motor Driver Power Dissipation",
  shortTitle: "Driver Power",
  category: "motor",
  description: "Calculate motor driver IC or discrete MOSFET power dissipation including conduction loss and switching loss at a given PWM frequency.",
  keywords: ["motor driver power", "motor driver loss", "MOSFET switching loss", "motor driver efficiency", "PWM loss", "motor driver heat"],
  inputs: [
    { key: "motorCurrent", label: "Motor Current (RMS)", symbol: "I", unit: "A", defaultValue: 2, min: 0 },
    { key: "supplyVoltage", label: "Supply Voltage", symbol: "V", unit: "V", defaultValue: 12, min: 1 },
    { key: "rdson", label: "RDS(on)", symbol: "R_DS", unit: "\u03A9", defaultValue: 0.015, min: 1e-3, step: 1e-3 },
    { key: "dutyCycle", label: "PWM Duty Cycle", symbol: "D", unit: "%", defaultValue: 75, min: 0, max: 100 },
    { key: "switchingFreq", label: "Switching Frequency", symbol: "f_sw", unit: "Hz", defaultValue: 2e4, min: 100 },
    { key: "gateCharge", label: "Gate Charge Qg", symbol: "Qg", unit: "nC", defaultValue: 30, min: 0.1, tooltip: "From MOSFET datasheet" }
  ],
  outputs: [
    { key: "conductionLoss", label: "Conduction Loss / FET", symbol: "P_cond", unit: "W", precision: 3 },
    { key: "switchingLoss", label: "Switching Loss / FET", symbol: "P_sw", unit: "W", precision: 3 },
    { key: "totalLossPerFet", label: "Total Loss / FET", symbol: "P_FET", unit: "W", precision: 3 },
    { key: "totalLossBridge", label: "Total Bridge Loss", symbol: "P_bridge", unit: "W", precision: 2 },
    { key: "efficiency", label: "Driver Efficiency (est.)", symbol: "\u03B7", unit: "%", precision: 1 }
  ],
  calculate: calculateMotorDriverPower,
  formula: {
    primary: "P_cond = I\xB2 \xD7 R_DS \xD7 D,  P_sw = f \xD7 Qg \xD7 V",
    variables: [
      { symbol: "R_DS", description: "On-state resistance", unit: "\u03A9" },
      { symbol: "Qg", description: "Gate charge", unit: "nC" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["h-bridge-selection", "mosfet-power-dissipation", "motor-efficiency"]
};

// src/lib/calculators/motor/pid-tuning.ts
function calculatePidTuning(inputs) {
  const { processGain, deadTime, timeConstant } = inputs;
  const kpPID = 1.2 * timeConstant / (processGain * deadTime);
  const tiPID = 2 * deadTime;
  const tdPID = 0.5 * deadTime;
  const kiPID = kpPID / tiPID;
  const kdPID = kpPID * tdPID;
  const kpPI = 0.9 * timeConstant / (processGain * deadTime);
  const tiPI = 3.33 * deadTime;
  return { values: { kpPID, kiPID, kdPID, tiPID, tdPID, kpPI, tiPI } };
}
var pidTuning = {
  slug: "pid-tuning",
  title: "PID Controller Tuning (Ziegler-Nichols)",
  shortTitle: "PID Tuning",
  category: "motor",
  description: "Calculate PID controller gains using the Ziegler-Nichols open-loop (reaction curve) method from process gain, dead time, and time constant.",
  keywords: ["PID tuning", "Ziegler-Nichols", "PID gains", "PID controller", "motor PID", "Kp Ki Kd"],
  inputs: [
    { key: "processGain", label: "Process Gain (K)", symbol: "K", unit: "", defaultValue: 1.5, min: 1e-3, step: 0.1, tooltip: "Output change / Input step size from step test" },
    { key: "deadTime", label: "Dead Time (L)", symbol: "L", unit: "s", defaultValue: 0.1, min: 1e-3, step: 0.01, tooltip: "Time before response begins" },
    { key: "timeConstant", label: "Time Constant (\u03C4)", symbol: "\u03C4", unit: "s", defaultValue: 1, min: 1e-3, step: 0.1, tooltip: "Time for 63.2% of final step response" }
  ],
  outputs: [
    { key: "kpPID", label: "Kp (PID)", symbol: "Kp", unit: "", precision: 3 },
    { key: "kiPID", label: "Ki (PID)", symbol: "Ki", unit: "1/s", precision: 3 },
    { key: "kdPID", label: "Kd (PID)", symbol: "Kd", unit: "s", precision: 4 },
    { key: "kpPI", label: "Kp (PI only)", symbol: "Kp_PI", unit: "", precision: 3 },
    { key: "tiPI", label: "Ti (PI only)", symbol: "Ti_PI", unit: "s", precision: 3 },
    { key: "tiPID", label: "Ti (PID)", symbol: "Ti", unit: "s", precision: 3 },
    { key: "tdPID", label: "Td (PID)", symbol: "Td", unit: "s", precision: 4 }
  ],
  calculate: calculatePidTuning,
  formula: {
    primary: "Kp = 1.2\u03C4/(K\xB7L),  Ti = 2L,  Td = 0.5L",
    variables: [
      { symbol: "K", description: "Process gain", unit: "" },
      { symbol: "L", description: "Dead time", unit: "s" },
      { symbol: "\u03C4", description: "Time constant", unit: "s" }
    ],
    reference: "Ziegler & Nichols, 1942"
  },
  visualization: { type: "none" },
  relatedCalculators: ["dc-motor-speed", "encoder-resolution", "induction-motor-slip"]
};

// src/lib/calculators/sensor/ntc-thermistor.ts
function calculateNtcThermistor(inputs) {
  const { resistance, beta, T0, R0 } = inputs;
  if (resistance <= 0 || R0 <= 0 || beta <= 0) {
    return { values: { temperature: 0, temperatureK: 0 }, errors: ["Resistance, R0, and beta must be positive"] };
  }
  const T0_K = T0 + 273.15;
  const temperatureK = 1 / (1 / T0_K + 1 / beta * Math.log(resistance / R0));
  const temperature = temperatureK - 273.15;
  return {
    values: {
      temperature,
      temperatureK
    }
  };
}
var ntcThermistor = {
  slug: "ntc-thermistor",
  title: "NTC Thermistor Temperature Calculator",
  shortTitle: "NTC Thermistor",
  category: "sensor",
  description: "Calculate temperature from NTC thermistor resistance using the Steinhart-Hart beta equation. Useful for PT100/PT1000 and generic NTC thermistors.",
  keywords: [
    "NTC thermistor",
    "thermistor temperature",
    "Steinhart-Hart",
    "beta equation",
    "temperature sensor",
    "NTC resistance",
    "temperature from resistance"
  ],
  inputs: [
    {
      key: "resistance",
      label: "Measured Resistance",
      symbol: "R",
      unit: "\u03A9",
      defaultValue: 1e4,
      min: 0.1,
      tooltip: "Measured thermistor resistance at unknown temperature"
    },
    {
      key: "beta",
      label: "Beta Coefficient",
      symbol: "\u03B2",
      unit: "K",
      defaultValue: 3950,
      min: 100,
      max: 1e4,
      tooltip: "Beta (B) coefficient of the thermistor, from datasheet. Typically 3000\u20134500 K.",
      presets: [
        { label: "3380 K (NTC 10K)", values: { beta: 3380 } },
        { label: "3950 K (common)", values: { beta: 3950 } },
        { label: "4250 K (high-temp)", values: { beta: 4250 } }
      ]
    },
    {
      key: "T0",
      label: "Reference Temperature",
      symbol: "T\u2080",
      unit: "\xB0C",
      defaultValue: 25,
      min: -55,
      max: 200,
      tooltip: "Reference temperature at which R0 is specified (usually 25\xB0C)"
    },
    {
      key: "R0",
      label: "Reference Resistance",
      symbol: "R\u2080",
      unit: "\u03A9",
      defaultValue: 1e4,
      min: 0.1,
      tooltip: "Thermistor resistance at reference temperature T0 (e.g. 10k\u03A9 at 25\xB0C)",
      presets: [
        { label: "10k\u03A9 (NTC 10K)", values: { R0: 1e4 } },
        { label: "100k\u03A9 (NTC 100K)", values: { R0: 1e5 } }
      ]
    }
  ],
  outputs: [
    {
      key: "temperature",
      label: "Temperature",
      symbol: "T",
      unit: "\xB0C",
      precision: 2,
      tooltip: "Calculated temperature in degrees Celsius"
    },
    {
      key: "temperatureK",
      label: "Temperature (Kelvin)",
      symbol: "T",
      unit: "K",
      precision: 2,
      tooltip: "Calculated temperature in Kelvin"
    }
  ],
  calculate: calculateNtcThermistor,
  formula: {
    primary: "1/T = 1/T\u2080 + (1/\u03B2)\xB7ln(R/R\u2080)",
    latex: "\\frac{1}{T} = \\frac{1}{T_0} + \\frac{1}{\\beta} \\ln\\left(\\frac{R}{R_0}\\right)",
    variables: [
      { symbol: "T", description: "Temperature", unit: "K" },
      { symbol: "T\u2080", description: "Reference temperature", unit: "K" },
      { symbol: "\u03B2", description: "Beta coefficient", unit: "K" },
      { symbol: "R", description: "Measured resistance", unit: "\u03A9" },
      { symbol: "R\u2080", description: "Reference resistance at T\u2080", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["rtd-temperature", "wheatstone-bridge", "junction-temperature"]
};

// src/lib/calculators/sensor/rtd-temperature.ts
function calculateRtdTemperature(inputs) {
  const { resistance, r0, alpha } = inputs;
  if (r0 <= 0 || alpha <= 0) {
    return { values: { temperature: 0, resistanceAt100C: 0 }, errors: ["R0 and alpha must be positive"] };
  }
  const temperature = (resistance - r0) / (r0 * alpha);
  const resistanceAt100C = r0 * (1 + alpha * 100);
  return {
    values: {
      temperature,
      resistanceAt100C
    }
  };
}
var rtdTemperature = {
  slug: "rtd-temperature",
  title: "RTD Temperature Calculator (PT100/PT1000)",
  shortTitle: "RTD Temperature",
  category: "sensor",
  description: "Calculate temperature from PT100 or PT1000 RTD (Resistance Temperature Detector) measured resistance using the linear Callendar-Van Dusen approximation.",
  keywords: [
    "RTD temperature",
    "PT100 calculator",
    "PT1000 calculator",
    "resistance temperature detector",
    "Callendar-Van Dusen",
    "temperature from resistance",
    "RTD sensor"
  ],
  inputs: [
    {
      key: "resistance",
      label: "Measured Resistance",
      symbol: "R",
      unit: "\u03A9",
      defaultValue: 119.4,
      min: 1,
      tooltip: "Measured RTD resistance. At 0\xB0C: PT100=100\u03A9, PT1000=1000\u03A9.",
      presets: [
        { label: "PT100 at 50\xB0C (119.4\u03A9)", values: { resistance: 119.4, r0: 100 } },
        { label: "PT1000 at 50\xB0C (1194\u03A9)", values: { resistance: 1194, r0: 1e3 } },
        { label: "PT100 at 100\xB0C (138.5\u03A9)", values: { resistance: 138.5, r0: 100 } }
      ]
    },
    {
      key: "r0",
      label: "Nominal Resistance (R\u2080)",
      symbol: "R\u2080",
      unit: "\u03A9",
      defaultValue: 100,
      min: 1,
      tooltip: "Nominal resistance at 0\xB0C, e.g. 100 for PT100, 1000 for PT1000",
      presets: [
        { label: "PT100 (100\u03A9)", values: { r0: 100 } },
        { label: "PT1000 (1000\u03A9)", values: { r0: 1e3 } }
      ]
    },
    {
      key: "alpha",
      label: "Temperature Coefficient",
      symbol: "\u03B1",
      unit: "\xB0C\u207B\xB9",
      defaultValue: 3851e-6,
      min: 1e-3,
      max: 0.01,
      step: 1e-6,
      tooltip: "Temperature coefficient of resistance. IEC 60751 standard: 0.003851 \xB0C\u207B\xB9",
      presets: [
        { label: "IEC 60751 (0.003851)", values: { alpha: 3851e-6 } },
        { label: "American (0.003911)", values: { alpha: 3911e-6 } }
      ]
    }
  ],
  outputs: [
    {
      key: "temperature",
      label: "Temperature",
      symbol: "T",
      unit: "\xB0C",
      precision: 2,
      tooltip: "Calculated temperature using linear RTD approximation"
    },
    {
      key: "resistanceAt100C",
      label: "Resistance at 100\xB0C",
      symbol: "R\u2081\u2080\u2080",
      unit: "\u03A9",
      precision: 3,
      tooltip: "Calculated resistance at 100\xB0C for this RTD type"
    }
  ],
  calculate: calculateRtdTemperature,
  formula: {
    primary: "T = (R \u2212 R\u2080) / (R\u2080 \xB7 \u03B1)",
    latex: "T = \\frac{R - R_0}{R_0 \\cdot \\alpha}",
    variables: [
      { symbol: "T", description: "Temperature", unit: "\xB0C" },
      { symbol: "R", description: "Measured resistance", unit: "\u03A9" },
      { symbol: "R\u2080", description: "Nominal resistance at 0\xB0C", unit: "\u03A9" },
      { symbol: "\u03B1", description: "Temperature coefficient of resistance", unit: "\xB0C\u207B\xB9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["ntc-thermistor", "wheatstone-bridge", "junction-temperature"]
};

// src/lib/calculators/sensor/wheatstone-bridge.ts
function calculateWheatstoneBridge(inputs) {
  const { vin, r1, r2, r3, r4 } = inputs;
  if (r1 <= 0 || r2 <= 0 || r3 <= 0 || r4 <= 0) {
    return { values: { vout: 0, voutMv: 0, balance: 0, sensitivity: 0 }, errors: ["All resistances must be positive"] };
  }
  const vout = vin * (r3 / (r1 + r3) - r4 / (r2 + r4));
  const voutMv = vout * 1e3;
  const balance = r1 / r3 - r2 / r4;
  const sensitivity = vout / vin * 1e3;
  return {
    values: {
      vout,
      voutMv,
      balance,
      sensitivity
    }
  };
}
var wheatstoneBridge = {
  slug: "wheatstone-bridge",
  title: "Wheatstone Bridge Calculator",
  shortTitle: "Wheatstone Bridge",
  category: "sensor",
  description: "Calculate Wheatstone bridge output voltage, balance condition, and sensitivity. Used for strain gauges, RTDs, and precision resistance measurements.",
  keywords: [
    "Wheatstone bridge",
    "bridge circuit",
    "differential voltage",
    "bridge balance",
    "strain gauge",
    "sensor bridge",
    "bridge sensitivity"
  ],
  inputs: [
    {
      key: "vin",
      label: "Supply Voltage",
      symbol: "V_in",
      unit: "V",
      defaultValue: 5,
      min: 0.1,
      max: 30,
      tooltip: "Bridge excitation supply voltage"
    },
    {
      key: "r1",
      label: "R1 (top-left)",
      symbol: "R\u2081",
      unit: "\u03A9",
      defaultValue: 1e3,
      min: 1,
      tooltip: "Bridge resistor R1 (top-left arm)"
    },
    {
      key: "r2",
      label: "R2 (top-right)",
      symbol: "R\u2082",
      unit: "\u03A9",
      defaultValue: 1e3,
      min: 1,
      tooltip: "Bridge resistor R2 (top-right arm)"
    },
    {
      key: "r3",
      label: "R3 (bottom-left)",
      symbol: "R\u2083",
      unit: "\u03A9",
      defaultValue: 1e3,
      min: 1,
      tooltip: "Bridge resistor R3 (bottom-left arm, often the sensor)"
    },
    {
      key: "r4",
      label: "R4 (bottom-right)",
      symbol: "R\u2084",
      unit: "\u03A9",
      defaultValue: 1e3,
      min: 1,
      tooltip: "Bridge resistor R4 (bottom-right arm)"
    }
  ],
  outputs: [
    {
      key: "vout",
      label: "Output Voltage",
      symbol: "V_out",
      unit: "V",
      precision: 4,
      tooltip: "Differential output voltage of the bridge"
    },
    {
      key: "voutMv",
      label: "Output Voltage",
      symbol: "V_out",
      unit: "mV",
      precision: 3,
      tooltip: "Differential output voltage in millivolts"
    },
    {
      key: "balance",
      label: "Balance Factor",
      symbol: "\u0394B",
      unit: "",
      precision: 4,
      tooltip: "Balance indicator: 0 = perfectly balanced (R1/R3 = R2/R4)"
    },
    {
      key: "sensitivity",
      label: "Sensitivity",
      symbol: "S",
      unit: "mV/V",
      precision: 3,
      tooltip: "Bridge sensitivity: output mV per V of excitation"
    }
  ],
  calculate: calculateWheatstoneBridge,
  formula: {
    primary: "V_out = V_in \xB7 (R3/(R1+R3) \u2212 R4/(R2+R4))",
    latex: "V_{out} = V_{in} \\left(\\frac{R_3}{R_1+R_3} - \\frac{R_4}{R_2+R_4}\\right)",
    variables: [
      { symbol: "V_out", description: "Differential output voltage", unit: "V" },
      { symbol: "V_in", description: "Bridge supply voltage", unit: "V" },
      { symbol: "R1\u2013R4", description: "Bridge arm resistances", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["strain-gauge-bridge", "rtd-temperature", "ntc-thermistor"]
};

// src/lib/calculators/sensor/hall-effect-sensor.ts
function calculateHallEffectSensor(inputs) {
  const { current, Bfield, thickness, carrierDensity } = inputs;
  const e = 1602e-22;
  const n = carrierDensity * 1e23;
  if (n <= 0 || thickness <= 0 || Bfield <= 0) {
    return { values: { hallVoltage: 0, hallCoefficient: 0, sensitivity: 0 }, errors: ["Carrier density, thickness, and magnetic field must be positive"] };
  }
  const RH = 1 / (n * e);
  const I_A = current * 1e-3;
  const B_T = Bfield * 1e-3;
  const t_m = thickness * 1e-3;
  const VH_V = RH * I_A * B_T / t_m;
  const hallVoltage = VH_V * 1e3;
  const sensitivity = hallVoltage / Bfield;
  return {
    values: {
      hallVoltage,
      hallCoefficient: RH,
      sensitivity
    }
  };
}
var hallEffectSensor = {
  slug: "hall-effect-sensor",
  title: "Hall Effect Sensor Calculator",
  shortTitle: "Hall Effect Sensor",
  category: "sensor",
  description: "Calculate Hall voltage, Hall coefficient, and sensitivity for Hall effect sensors. Useful for magnetic field measurement, current sensing, and position detection.",
  keywords: [
    "Hall effect",
    "Hall voltage",
    "Hall coefficient",
    "magnetic sensor",
    "current sensor",
    "Hall sensor sensitivity",
    "magnetic field measurement"
  ],
  inputs: [
    {
      key: "current",
      label: "Control Current",
      symbol: "I",
      unit: "mA",
      defaultValue: 100,
      min: 1e-3,
      max: 1e3,
      tooltip: "Control current flowing through the Hall element"
    },
    {
      key: "Bfield",
      label: "Magnetic Field",
      symbol: "B",
      unit: "mT",
      defaultValue: 100,
      min: 0,
      tooltip: "Applied magnetic field perpendicular to current flow",
      presets: [
        { label: "Earth field (~0.05 mT)", values: { Bfield: 0.05 } },
        { label: "Typical magnet (100 mT)", values: { Bfield: 100 } },
        { label: "Strong magnet (500 mT)", values: { Bfield: 500 } }
      ]
    },
    {
      key: "thickness",
      label: "Element Thickness",
      symbol: "t",
      unit: "mm",
      defaultValue: 0.5,
      min: 1e-3,
      tooltip: "Thickness of the Hall element in the direction of magnetic field"
    },
    {
      key: "carrierDensity",
      label: "Carrier Density (\xD710\xB2\xB3)",
      symbol: "n",
      unit: "\xD710\xB2\xB3/m\xB3",
      defaultValue: 8.5,
      min: 1e-3,
      tooltip: "Charge carrier density (8.5\xD710\xB2\xB3 for copper, ~10\xB2\u2074 for silicon)",
      presets: [
        { label: "Copper (8.5\xD710\xB2\u2078/m\xB3 \u2192 use 8.5e5)", values: { carrierDensity: 85e4 } },
        { label: "InSb semiconductor (0.02)", values: { carrierDensity: 0.02 } },
        { label: "Si typical (1.5\xD710\xB9\u2076/m\xB3 \u2192 1.5e-7)", values: { carrierDensity: 15e-8 } }
      ]
    }
  ],
  outputs: [
    {
      key: "hallVoltage",
      label: "Hall Voltage",
      symbol: "V_H",
      unit: "mV",
      precision: 4,
      tooltip: "Developed Hall voltage across the element"
    },
    {
      key: "hallCoefficient",
      label: "Hall Coefficient",
      symbol: "R_H",
      unit: "m\xB3/C",
      precision: 4,
      format: "scientific",
      tooltip: "Hall coefficient R_H = 1/(n\xB7e)"
    },
    {
      key: "sensitivity",
      label: "Sensitivity",
      symbol: "S",
      unit: "mV/mT",
      precision: 4,
      tooltip: "Hall sensor sensitivity: output mV per mT of applied field"
    }
  ],
  calculate: calculateHallEffectSensor,
  formula: {
    primary: "V_H = (R_H \xB7 I \xB7 B) / t,  R_H = 1/(n\xB7e)",
    latex: "V_H = \\frac{R_H \\cdot I \\cdot B}{t}, \\quad R_H = \\frac{1}{n \\cdot e}",
    variables: [
      { symbol: "V_H", description: "Hall voltage", unit: "V" },
      { symbol: "R_H", description: "Hall coefficient", unit: "m\xB3/C" },
      { symbol: "I", description: "Control current", unit: "A" },
      { symbol: "B", description: "Magnetic flux density", unit: "T" },
      { symbol: "t", description: "Element thickness", unit: "m" },
      { symbol: "n", description: "Charge carrier density", unit: "m\u207B\xB3" },
      { symbol: "e", description: "Elementary charge (1.602\xD710\u207B\xB9\u2079)", unit: "C" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["wheatstone-bridge", "strain-gauge-bridge", "snr-calculator"]
};

// src/lib/calculators/sensor/strain-gauge-bridge.ts
function calculateStrainGaugeBridge(inputs) {
  const { vin, gaugeFactor, strain, bridgeConfig } = inputs;
  if (gaugeFactor <= 0 || vin <= 0) {
    return { values: { vout: 0, resistance_change: 0, strain_SI: 0 }, errors: ["Vin and gauge factor must be positive"] };
  }
  const strain_SI = strain * 1e-6;
  const vout = vin * (gaugeFactor * strain_SI / 4) * bridgeConfig * 1e3;
  const resistance_change = gaugeFactor * strain_SI * 100;
  return {
    values: {
      vout,
      resistance_change,
      strain_SI
    }
  };
}
var strainGaugeBridge = {
  slug: "strain-gauge-bridge",
  title: "Strain Gauge Bridge Calculator",
  shortTitle: "Strain Gauge Bridge",
  category: "sensor",
  description: "Calculate Wheatstone bridge output voltage for strain gauges. Supports quarter, half, and full bridge configurations for structural monitoring and load cell design.",
  keywords: [
    "strain gauge",
    "Wheatstone bridge",
    "gauge factor",
    "microstrain",
    "load cell",
    "bridge output",
    "structural monitoring"
  ],
  inputs: [
    {
      key: "vin",
      label: "Excitation Voltage",
      symbol: "V_in",
      unit: "V",
      defaultValue: 5,
      min: 0.1,
      max: 30,
      tooltip: "Bridge excitation (supply) voltage"
    },
    {
      key: "gaugeFactor",
      label: "Gauge Factor",
      symbol: "GF",
      unit: "",
      defaultValue: 2.1,
      min: 0.1,
      max: 200,
      tooltip: "Gauge factor (sensitivity) of the strain gauge. Metal foil: ~2, semiconductor: 50\u2013200.",
      presets: [
        { label: "Metal foil (2.0)", values: { gaugeFactor: 2 } },
        { label: "Metal foil (2.1)", values: { gaugeFactor: 2.1 } },
        { label: "Semiconductor (100)", values: { gaugeFactor: 100 } }
      ]
    },
    {
      key: "strain",
      label: "Applied Strain",
      symbol: "\u03B5",
      unit: "\u03BC\u03B5",
      defaultValue: 1e3,
      min: 0,
      max: 5e4,
      tooltip: "Strain in microstrain (\u03BC\u03B5). 1000 \u03BC\u03B5 = 0.1% elongation."
    },
    {
      key: "bridgeConfig",
      label: "Bridge Configuration",
      symbol: "N",
      unit: "active arms",
      defaultValue: 1,
      min: 1,
      max: 4,
      step: 1,
      tooltip: "Number of active gauge arms: 1=quarter bridge, 2=half bridge, 4=full bridge",
      presets: [
        { label: "Quarter bridge (1 active)", values: { bridgeConfig: 1 } },
        { label: "Half bridge (2 active)", values: { bridgeConfig: 2 } },
        { label: "Full bridge (4 active)", values: { bridgeConfig: 4 } }
      ]
    }
  ],
  outputs: [
    {
      key: "vout",
      label: "Bridge Output",
      symbol: "V_out",
      unit: "mV",
      precision: 4,
      tooltip: "Bridge differential output voltage in millivolts"
    },
    {
      key: "resistance_change",
      label: "Resistance Change",
      symbol: "\u0394R/R",
      unit: "%",
      precision: 4,
      tooltip: "Fractional change in gauge resistance as percentage (\u0394R/R = GF \xD7 \u03B5)"
    },
    {
      key: "strain_SI",
      label: "Strain (SI)",
      symbol: "\u03B5",
      unit: "m/m",
      precision: 6,
      format: "scientific",
      tooltip: "Strain in SI units (dimensionless, m/m)"
    }
  ],
  calculate: calculateStrainGaugeBridge,
  formula: {
    primary: "V_out = V_in \xB7 (GF \xB7 \u03B5 / 4) \xB7 N",
    latex: "V_{out} = V_{in} \\cdot \\frac{GF \\cdot \\varepsilon}{4} \\cdot N",
    variables: [
      { symbol: "V_out", description: "Bridge output voltage", unit: "V" },
      { symbol: "V_in", description: "Excitation voltage", unit: "V" },
      { symbol: "GF", description: "Gauge factor", unit: "" },
      { symbol: "\u03B5", description: "Applied strain (m/m)", unit: "m/m" },
      { symbol: "N", description: "Number of active arms (1, 2, or 4)", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["wheatstone-bridge", "rtd-temperature", "ntc-thermistor"]
};

// src/lib/calculators/sensor/pt100-resistance.ts
function calculatePt100Resistance(inputs) {
  const { temperature, r0 } = inputs;
  const A = 39083e-7;
  const B = -5775e-10;
  const C = -4183e-15;
  let resistance;
  if (temperature >= 0) {
    resistance = r0 * (1 + A * temperature + B * temperature ** 2);
  } else {
    resistance = r0 * (1 + A * temperature + B * temperature ** 2 + C * (temperature - 100) * temperature ** 3);
  }
  const sensitivityOhmPerDeg = r0 * (A + 2 * B * temperature);
  return { values: { resistance, sensitivityOhmPerDeg } };
}
var pt100Resistance = {
  slug: "pt100-resistance",
  title: "PT100/PT1000 Resistance vs Temperature",
  shortTitle: "PT100 Resistance",
  category: "sensor",
  description: "Calculate PT100 or PT1000 RTD resistance at any temperature using the ITS-90 Callendar-Van Dusen equation.",
  keywords: ["PT100", "PT1000", "RTD resistance", "Callendar Van Dusen", "temperature sensor resistance", "RTD temperature"],
  inputs: [
    {
      key: "r0",
      label: "R\u2080 (at 0\xB0C)",
      symbol: "R\u2080",
      unit: "\u03A9",
      defaultValue: 100,
      min: 1,
      presets: [
        { label: "PT100 (100 \u03A9)", values: { r0: 100 } },
        { label: "PT500 (500 \u03A9)", values: { r0: 500 } },
        { label: "PT1000 (1000 \u03A9)", values: { r0: 1e3 } }
      ]
    },
    {
      key: "temperature",
      label: "Temperature",
      symbol: "T",
      unit: "\xB0C",
      defaultValue: 25,
      min: -200,
      max: 850,
      presets: [
        { label: "Ice point (0\xB0C)", values: { temperature: 0 } },
        { label: "Room (25\xB0C)", values: { temperature: 25 } },
        { label: "Steam (100\xB0C)", values: { temperature: 100 } }
      ]
    }
  ],
  outputs: [
    { key: "resistance", label: "Resistance", symbol: "R(T)", unit: "\u03A9", precision: 3 },
    { key: "sensitivityOhmPerDeg", label: "Sensitivity", symbol: "dR/dT", unit: "\u03A9/\xB0C", precision: 4 }
  ],
  calculate: calculatePt100Resistance,
  formula: {
    primary: "R(T) = R\u2080(1 + AT + BT\xB2) for T \u2265 0\xB0C",
    variables: [
      { symbol: "R\u2080", description: "Resistance at 0\xB0C", unit: "\u03A9" },
      { symbol: "A", description: "3.9083 \xD7 10\u207B\xB3", unit: "/\xB0C" },
      { symbol: "B", description: "\u22125.775 \xD7 10\u207B\u2077", unit: "/\xB0C\xB2" }
    ],
    reference: "IEC 60751 / ITS-90"
  },
  visualization: { type: "none" },
  relatedCalculators: ["rtd-temperature", "ntc-thermistor", "thermocouple-voltage"]
};

// src/lib/calculators/sensor/thermocouple-voltage.ts
function calculateThermocoupleVoltage(inputs) {
  const { temperature, coldJunctionTemp, type } = inputs;
  const seebeckCoefficients = {
    0: 41,
    // K
    1: 51,
    // J
    2: 43,
    // T
    3: 68
    // E
  };
  const seebeck = seebeckCoefficients[Math.round(type)] ?? 41;
  const deltaT = temperature - coldJunctionTemp;
  const voltage = seebeck * deltaT;
  const coldJunctionCorrection = seebeck * coldJunctionTemp;
  return { values: { voltage, coldJunctionCorrection, seebeck, deltaT } };
}
var thermocoupleVoltage = {
  slug: "thermocouple-voltage",
  title: "Thermocouple Voltage & Temperature",
  shortTitle: "Thermocouple",
  category: "sensor",
  description: "Calculate thermocouple EMF voltage from hot junction temperature and cold junction compensation for Type K, J, T, and E thermocouples.",
  keywords: ["thermocouple voltage", "Type K thermocouple", "cold junction compensation", "thermocouple EMF", "Seebeck coefficient", "thermocouple mV"],
  inputs: [
    {
      key: "type",
      label: "Thermocouple Type",
      symbol: "type",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 3,
      step: 1,
      tooltip: "0=K (41 \u03BCV/\xB0C), 1=J (51 \u03BCV/\xB0C), 2=T (43 \u03BCV/\xB0C), 3=E (68 \u03BCV/\xB0C)"
    },
    {
      key: "temperature",
      label: "Hot Junction Temperature",
      symbol: "T_hot",
      unit: "\xB0C",
      defaultValue: 200,
      min: -270,
      max: 1372
    },
    {
      key: "coldJunctionTemp",
      label: "Cold Junction Temperature",
      symbol: "T_cold",
      unit: "\xB0C",
      defaultValue: 25,
      min: -50,
      max: 70
    }
  ],
  outputs: [
    { key: "voltage", label: "Output Voltage", symbol: "E", unit: "\u03BCV", precision: 0 },
    { key: "coldJunctionCorrection", label: "Cold Junction Correction", symbol: "E_cjc", unit: "\u03BCV", precision: 0 },
    { key: "seebeck", label: "Seebeck Coefficient", symbol: "S", unit: "\u03BCV/\xB0C", precision: 0 },
    { key: "deltaT", label: "Temperature Difference", symbol: "\u0394T", unit: "\xB0C", precision: 0 }
  ],
  calculate: calculateThermocoupleVoltage,
  formula: {
    primary: "E = S \xD7 (T_hot \u2212 T_cold)",
    variables: [
      { symbol: "S", description: "Seebeck coefficient (K: 41 \u03BCV/\xB0C)", unit: "\u03BCV/\xB0C" },
      { symbol: "T", description: "Temperature", unit: "\xB0C" }
    ],
    reference: "NIST Monograph 175"
  },
  visualization: { type: "none" },
  relatedCalculators: ["pt100-resistance", "rtd-temperature", "ntc-thermistor"]
};

// src/lib/calculators/sensor/load-cell-amplifier.ts
function calculateLoadCellAmplifier(inputs) {
  const { excitationVoltage, sensitivity, fullScaleLoad, gain } = inputs;
  if (fullScaleLoad <= 0) {
    return { values: { fullScaleOutputMv: 0, amplifiedOutput: 0, sensitivityPerUnit: 0, requiredGain: 0 }, errors: ["Full-scale load must be positive"] };
  }
  const fullScaleOutputMv = sensitivity * excitationVoltage;
  const amplifiedOutput = fullScaleOutputMv / 1e3 * gain;
  const sensitivityPerUnit = fullScaleOutputMv / fullScaleLoad;
  const requiredGain = 5e3 / fullScaleOutputMv;
  return { values: { fullScaleOutputMv, amplifiedOutput, sensitivityPerUnit, requiredGain } };
}
var loadCellAmplifier = {
  slug: "load-cell-amplifier",
  title: "Load Cell Amplifier Gain",
  shortTitle: "Load Cell Amp",
  category: "sensor",
  description: "Calculate load cell output voltage, required amplifier gain, and sensitivity for Wheatstone bridge load cells.",
  keywords: ["load cell amplifier", "load cell gain", "load cell mV/V", "INA125 gain", "strain gauge amplifier", "weigh scale amplifier"],
  inputs: [
    {
      key: "excitationVoltage",
      label: "Excitation Voltage",
      symbol: "V_ex",
      unit: "V",
      defaultValue: 5,
      min: 0.1
    },
    {
      key: "sensitivity",
      label: "Load Cell Sensitivity",
      symbol: "S",
      unit: "mV/V",
      defaultValue: 2,
      min: 0.01,
      tooltip: "From load cell datasheet, typically 1\u20133 mV/V"
    },
    {
      key: "fullScaleLoad",
      label: "Full-Scale Load",
      symbol: "F_max",
      unit: "kg",
      defaultValue: 10,
      min: 1e-3
    },
    {
      key: "gain",
      label: "Amplifier Gain",
      symbol: "G",
      unit: "V/V",
      defaultValue: 500,
      min: 1
    }
  ],
  outputs: [
    { key: "fullScaleOutputMv", label: "Full-Scale Output", symbol: "V_FS", unit: "mV", precision: 2 },
    { key: "amplifiedOutput", label: "Amplified Full-Scale", symbol: "V_amp", unit: "V", precision: 3 },
    { key: "sensitivityPerUnit", label: "Sensitivity", symbol: "S_per_unit", unit: "mV/kg", precision: 4 },
    { key: "requiredGain", label: "Gain for 5V ADC", symbol: "G_5V", unit: "V/V", precision: 0 }
  ],
  calculate: calculateLoadCellAmplifier,
  formula: {
    primary: "V_FS = S \xD7 V_ex,  V_amp = V_FS \xD7 G",
    variables: [
      { symbol: "S", description: "Sensitivity", unit: "mV/V" },
      { symbol: "V_ex", description: "Excitation voltage", unit: "V" },
      { symbol: "G", description: "Amplifier gain", unit: "V/V" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["wheatstone-bridge", "strain-gauge-bridge", "pressure-bridge-output"]
};

// src/lib/calculators/sensor/photodiode-transimpedance.ts
var photodiodeTransimpedance = {
  slug: "photodiode-transimpedance",
  title: "Photodiode Transimpedance Amplifier",
  shortTitle: "TIA Design",
  category: "sensor",
  description: "Calculate transimpedance amplifier (TIA) output voltage, bandwidth, and noise for photodiode signal conditioning.",
  keywords: ["transimpedance amplifier", "TIA photodiode", "photodiode amplifier", "op-amp TIA", "current to voltage converter", "TIA bandwidth"],
  inputs: [
    {
      key: "photocurrent",
      label: "Photocurrent",
      symbol: "I_ph",
      unit: "\u03BCA",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "At operating light level"
    },
    {
      key: "feedbackResistance",
      label: "Feedback Resistor (Rf)",
      symbol: "R_f",
      unit: "k\u03A9",
      defaultValue: 100,
      min: 1e-3
    },
    {
      key: "feedbackCapacitance",
      label: "Feedback Capacitor (Cf)",
      symbol: "C_f",
      unit: "pF",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Stabilizing capacitor in parallel with Rf"
    }
  ],
  outputs: [
    { key: "outputVoltageV", label: "Output Voltage", symbol: "V_out", unit: "mV", precision: 2 },
    { key: "bandwidth", label: "Bandwidth (\u22123 dB)", symbol: "BW", unit: "kHz", precision: 1 },
    { key: "noiseVoltage", label: "Johnson Noise", symbol: "e_n", unit: "nV/\u221AHz", precision: 1 }
  ],
  calculate: (inputs) => {
    const { photocurrent, feedbackResistance, feedbackCapacitance } = inputs;
    const rfOhm = feedbackResistance * 1e3;
    const cfF = feedbackCapacitance * 1e-12;
    const outputVoltageV = photocurrent * 1e-6 * rfOhm * 1e3;
    const bandwidth = cfF > 0 ? 1 / (2 * Math.PI * rfOhm * cfF) / 1e3 : 0;
    const noiseVoltage = Math.sqrt(4 * 138e-25 * 293 * rfOhm) * 1e9;
    return { values: { outputVoltageV, bandwidth, noiseVoltage } };
  },
  formula: {
    primary: "V_out = I_ph \xD7 R_f,  BW = 1/(2\u03C0 \xD7 R_f \xD7 C_f)",
    variables: [
      { symbol: "R_f", description: "Feedback resistance", unit: "\u03A9" },
      { symbol: "C_f", description: "Feedback capacitance", unit: "F" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["wheatstone-bridge", "load-cell-amplifier", "sensor-accuracy-budget"]
};

// src/lib/calculators/sensor/capacitive-proximity.ts
function calculateCapacitiveProximity(inputs) {
  const { plateArea, gapDistance, permittivity } = inputs;
  if (gapDistance <= 0) {
    return { values: { capacitancePf: 0, sensitivity: 0 }, errors: ["Gap distance must be positive"] };
  }
  const eps0 = 8854e-15;
  const areaSqM = plateArea * 1e-4;
  const gapM = gapDistance * 1e-3;
  const capacitancePf = eps0 * permittivity * areaSqM / gapM * 1e12;
  const sensitivity = eps0 * permittivity * areaSqM / gapM ** 2 * 1e12 * 1e-3;
  return { values: { capacitancePf, sensitivity } };
}
var capacitiveProximity = {
  slug: "capacitive-proximity",
  title: "Capacitive Proximity Sensor",
  shortTitle: "Capacitive Sensor",
  category: "sensor",
  description: "Calculate capacitance between sensor plate and target, and sensitivity (pF/mm) for capacitive proximity sensor design.",
  keywords: ["capacitive proximity sensor", "capacitive sensor", "proximity sensor design", "capacitance gap", "touch sensor", "capacitive transducer"],
  inputs: [
    {
      key: "plateArea",
      label: "Sensor Plate Area",
      symbol: "A",
      unit: "cm\xB2",
      defaultValue: 1,
      min: 1e-3
    },
    {
      key: "gapDistance",
      label: "Gap to Target",
      symbol: "d",
      unit: "mm",
      defaultValue: 5,
      min: 0.1
    },
    {
      key: "permittivity",
      label: "Relative Permittivity (\u03B5\u1D63)",
      symbol: "\u03B5\u1D63",
      unit: "",
      defaultValue: 1,
      min: 1,
      tooltip: "Air: 1, Glass: 4\u201310, Water: 80"
    }
  ],
  outputs: [
    { key: "capacitancePf", label: "Capacitance", symbol: "C", unit: "pF", precision: 3 },
    { key: "sensitivity", label: "Sensitivity", symbol: "dC/dd", unit: "pF/mm", precision: 4 }
  ],
  calculate: calculateCapacitiveProximity,
  formula: {
    primary: "C = \u03B5\u2080\u03B5\u1D63A/d",
    variables: [
      { symbol: "\u03B5\u2080", description: "8.854 \xD7 10\u207B\xB9\xB2 F/m", unit: "F/m" },
      { symbol: "\u03B5\u1D63", description: "Relative permittivity", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["hall-effect-sensor", "sensor-accuracy-budget", "photodiode-transimpedance"]
};

// src/lib/calculators/sensor/current-shunt.ts
var currentShunt = {
  slug: "current-shunt",
  title: "Current Shunt Resistor",
  shortTitle: "Current Shunt",
  category: "sensor",
  description: "Calculate shunt resistor voltage drop, amplifier output, power dissipation, and ADC resolution for current sensing.",
  keywords: ["current shunt", "shunt resistor", "current sensing", "INA219", "current monitor", "shunt amplifier"],
  inputs: [
    {
      key: "current",
      label: "Measured Current",
      symbol: "I",
      unit: "A",
      defaultValue: 10,
      min: 0
    },
    {
      key: "shuntResistance",
      label: "Shunt Resistance",
      symbol: "R_sh",
      unit: "m\u03A9",
      defaultValue: 10,
      min: 1e-3,
      step: 0.1
    },
    {
      key: "amplifierGain",
      label: "Amplifier Gain",
      symbol: "G",
      unit: "V/V",
      defaultValue: 50,
      min: 1,
      tooltip: "INA219: 1\u2013128\xD7, INA240: 20\u2013200\xD7"
    },
    {
      key: "adcVoltage",
      label: "ADC Reference Voltage",
      symbol: "V_ref",
      unit: "V",
      defaultValue: 3.3,
      min: 0.1
    }
  ],
  outputs: [
    { key: "shuntVoltage", label: "Shunt Voltage Drop", symbol: "V_sh", unit: "mV", precision: 2 },
    { key: "amplifiedVoltage", label: "Amplified Voltage", symbol: "V_amp", unit: "V", precision: 3 },
    { key: "powerDissipation", label: "Shunt Power Dissipation", symbol: "P_sh", unit: "mW", precision: 2 },
    { key: "adcResolutionCurrent", label: "ADC Resolution (12-bit)", symbol: "\u0394I", unit: "mA/LSB", precision: 3 }
  ],
  calculate: (inputs) => {
    const { current, shuntResistance, amplifierGain, adcVoltage } = inputs;
    const rShOhm = shuntResistance * 1e-3;
    const shuntVoltage = current * rShOhm * 1e3;
    const amplifiedVoltage = shuntVoltage / 1e3 * amplifierGain;
    const powerDissipation = current ** 2 * rShOhm * 1e3;
    const adcResolutionCurrent = amplifierGain > 0 && rShOhm > 0 ? adcVoltage / 4096 / (amplifierGain * rShOhm) * 1e3 : 0;
    return { values: { shuntVoltage, amplifiedVoltage, powerDissipation, adcResolutionCurrent } };
  },
  formula: {
    primary: "V_sh = I \xD7 R_sh,  P = I\xB2 \xD7 R_sh",
    variables: [
      { symbol: "R_sh", description: "Shunt resistance", unit: "\u03A9" },
      { symbol: "I", description: "Measured current", unit: "A" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["wheatstone-bridge", "load-cell-amplifier", "sensor-accuracy-budget"]
};

// src/lib/calculators/sensor/accelerometer-sensitivity.ts
function calculateAccelerometerSensitivity(inputs) {
  const { sensitivity, fullScaleRange, supplyVoltage, adcBits } = inputs;
  const fullScaleVoltage = sensitivity * fullScaleRange * 2;
  const adcCounts = Math.pow(2, adcBits);
  const voltagePerCount = supplyVoltage * 1e3 / adcCounts;
  const accelerationPerCount = sensitivity > 0 ? voltagePerCount / sensitivity : 0;
  const accelerationMgPerCount = accelerationPerCount * 1e3;
  return { values: { fullScaleVoltage, voltagePerCount, accelerationMgPerCount } };
}
var accelerometerSensitivity = {
  slug: "accelerometer-sensitivity",
  title: "Accelerometer Range & Sensitivity",
  shortTitle: "Accelerometer",
  category: "sensor",
  description: "Calculate accelerometer output voltage, ADC resolution, and mg per LSB from sensitivity and full-scale range specifications.",
  keywords: ["accelerometer sensitivity", "accelerometer range", "MEMS accelerometer", "mg/LSB", "accelerometer ADC", "vibration sensor"],
  inputs: [
    {
      key: "sensitivity",
      label: "Sensitivity",
      symbol: "S",
      unit: "mV/g",
      defaultValue: 300,
      min: 1e-3,
      tooltip: "From accelerometer datasheet (e.g., ADXL335: 300 mV/g)"
    },
    {
      key: "fullScaleRange",
      label: "Full-Scale Range",
      symbol: "FS",
      unit: "g",
      defaultValue: 3,
      min: 0.1,
      presets: [
        { label: "\xB12g", values: { fullScaleRange: 2 } },
        { label: "\xB13g", values: { fullScaleRange: 3 } },
        { label: "\xB116g", values: { fullScaleRange: 16 } }
      ]
    },
    {
      key: "supplyVoltage",
      label: "Supply Voltage",
      symbol: "V_cc",
      unit: "V",
      defaultValue: 3.3,
      min: 0.1
    },
    {
      key: "adcBits",
      label: "ADC Resolution",
      symbol: "N",
      unit: "bits",
      defaultValue: 12,
      min: 8,
      max: 24,
      step: 1
    }
  ],
  outputs: [
    { key: "fullScaleVoltage", label: "Full-Scale Output Swing", symbol: "V_FS", unit: "mV", precision: 0 },
    { key: "voltagePerCount", label: "Voltage per LSB", symbol: "mV/LSB", unit: "mV", precision: 3 },
    { key: "accelerationMgPerCount", label: "Acceleration per LSB", symbol: "mg/LSB", unit: "mg", precision: 2 }
  ],
  calculate: calculateAccelerometerSensitivity,
  formula: {
    primary: "V_out = V_ref/2 \xB1 (S \xD7 a)",
    variables: [
      { symbol: "S", description: "Sensitivity", unit: "mV/g" },
      { symbol: "a", description: "Acceleration", unit: "g" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["hall-effect-sensor", "sensor-accuracy-budget", "strain-gauge-bridge"]
};

// src/lib/calculators/sensor/pressure-bridge-output.ts
var pressureBridgeOutput = {
  slug: "pressure-bridge-output",
  title: "Pressure Sensor Bridge Output",
  shortTitle: "Pressure Bridge",
  category: "sensor",
  description: "Calculate Wheatstone bridge output voltage for piezoresistive pressure sensors from excitation, sensitivity, and applied pressure.",
  keywords: ["pressure sensor bridge", "piezoresistive sensor", "bridge output voltage", "pressure transducer mV/V", "pressure sensor output", "bridge pressure"],
  inputs: [
    {
      key: "excitationVoltage",
      label: "Bridge Excitation Voltage",
      symbol: "V_ex",
      unit: "V",
      defaultValue: 5,
      min: 0.1
    },
    {
      key: "bridgeSensitivity",
      label: "Bridge Sensitivity",
      symbol: "S",
      unit: "mV/V",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Full-scale output in mV per V of excitation"
    },
    {
      key: "appliedPressure",
      label: "Applied Pressure",
      symbol: "P",
      unit: "kPa",
      defaultValue: 50,
      min: 0
    },
    {
      key: "fullScalePressure",
      label: "Full-Scale Pressure",
      symbol: "P_FS",
      unit: "kPa",
      defaultValue: 100,
      min: 1e-3
    }
  ],
  outputs: [
    { key: "bridgeOutputMv", label: "Bridge Output", symbol: "V_out", unit: "mV", precision: 2 },
    { key: "fullScaleOutput", label: "Full-Scale Output", symbol: "V_FS", unit: "mV", precision: 2 },
    { key: "fractionalDeflection", label: "Fractional Deflection", symbol: "P/P_FS", unit: "%", precision: 1 }
  ],
  calculate: (inputs) => {
    const { excitationVoltage, bridgeSensitivity, appliedPressure, fullScalePressure } = inputs;
    if (fullScalePressure <= 0) {
      return { values: { bridgeOutputMv: 0, fullScaleOutput: 0, fractionalDeflection: 0 }, errors: ["Full-scale pressure must be positive"] };
    }
    const fractionalDeflection = appliedPressure / fullScalePressure * 100;
    const bridgeOutputMv = excitationVoltage * bridgeSensitivity * (appliedPressure / fullScalePressure);
    const fullScaleOutput = excitationVoltage * bridgeSensitivity;
    return { values: { bridgeOutputMv, fullScaleOutput, fractionalDeflection } };
  },
  formula: {
    primary: "V_out = V_ex \xD7 S \xD7 (P/P_FS)",
    variables: [
      { symbol: "S", description: "Sensitivity", unit: "mV/V" },
      { symbol: "P_FS", description: "Full-scale pressure", unit: "kPa" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["wheatstone-bridge", "load-cell-amplifier", "strain-gauge-bridge"]
};

// src/lib/calculators/sensor/sensor-accuracy-budget.ts
function calculateSensorAccuracyBudget(inputs) {
  const { offsetError, gainError, nonlinearity, resolution, tempDrift, tempRange } = inputs;
  const tempError = tempDrift * tempRange;
  const totalRss = Math.sqrt(
    offsetError ** 2 + gainError ** 2 + nonlinearity ** 2 + resolution ** 2 + tempError ** 2
  );
  const totalWorstCase = offsetError + gainError + nonlinearity + resolution + tempError;
  return { values: { tempError, totalRss, totalWorstCase } };
}
var sensorAccuracyBudget = {
  slug: "sensor-accuracy-budget",
  title: "Sensor Accuracy Budget",
  shortTitle: "Sensor Accuracy",
  category: "sensor",
  description: "Calculate total sensor system accuracy using RSS and worst-case methods from offset, gain, nonlinearity, resolution, and temperature drift errors.",
  keywords: ["sensor accuracy budget", "error budget", "sensor accuracy", "RSS error", "sensor system accuracy", "measurement accuracy"],
  inputs: [
    {
      key: "offsetError",
      label: "Offset Error",
      symbol: "e_off",
      unit: "% FS",
      defaultValue: 0.1,
      min: 0
    },
    {
      key: "gainError",
      label: "Gain/Sensitivity Error",
      symbol: "e_gain",
      unit: "% FS",
      defaultValue: 0.2,
      min: 0
    },
    {
      key: "nonlinearity",
      label: "Nonlinearity",
      symbol: "e_NL",
      unit: "% FS",
      defaultValue: 0.1,
      min: 0
    },
    {
      key: "resolution",
      label: "Resolution Error",
      symbol: "e_res",
      unit: "% FS",
      defaultValue: 0.05,
      min: 0
    },
    {
      key: "tempDrift",
      label: "Temp Drift",
      symbol: "\u03B1",
      unit: "% FS/\xB0C",
      defaultValue: 5e-3,
      min: 0
    },
    {
      key: "tempRange",
      label: "Temperature Range",
      symbol: "\u0394T",
      unit: "\xB0C",
      defaultValue: 40,
      min: 0
    }
  ],
  outputs: [
    { key: "tempError", label: "Temperature Error", symbol: "e_temp", unit: "% FS", precision: 3 },
    { key: "totalRss", label: "Total Accuracy (RSS)", symbol: "e_RSS", unit: "% FS", precision: 3 },
    { key: "totalWorstCase", label: "Total Accuracy (Worst Case)", symbol: "e_WC", unit: "% FS", precision: 3 }
  ],
  calculate: calculateSensorAccuracyBudget,
  formula: {
    primary: "e_RSS = \u221A(e\u2081\xB2 + e\u2082\xB2 + ... + e\u2099\xB2)",
    variables: [
      { symbol: "e_WC", description: "Worst-case: sum of all errors", unit: "% FS" },
      { symbol: "e_RSS", description: "RSS: root-sum-square", unit: "% FS" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["wheatstone-bridge", "load-cell-amplifier", "current-shunt"]
};

// src/lib/calculators/sensor/optical-sensor-range.ts
function calculateOpticalSensorRange(inputs) {
  const { emitterPower, detectorSensitivity, targetReflectivity, safetyFactor } = inputs;
  if (safetyFactor <= 0) {
    return { values: { maxRange: 0, normalizedRange: 0 }, errors: ["Safety factor must be positive"] };
  }
  const reflFraction = targetReflectivity / 100;
  const normalizedRange = Math.sqrt(emitterPower * detectorSensitivity * reflFraction);
  const maxRange = normalizedRange / safetyFactor;
  return { values: { maxRange, normalizedRange } };
}
var opticalSensorRange = {
  slug: "optical-sensor-range",
  title: "Optical Proximity Sensor Range",
  shortTitle: "Optical Range",
  category: "sensor",
  description: "Compare optical proximity sensor configurations using a relative detection factor derived from emitter power, detector responsivity, and target reflectivity. The output is dimensionless \u2014 use it to rank or compare configurations, not as an absolute distance.",
  keywords: ["optical proximity sensor", "IR sensor range", "photointerrupter", "reflective optical sensor", "sensor range", "optical encoder range"],
  inputs: [
    {
      key: "emitterPower",
      label: "Emitter Power",
      symbol: "P_e",
      unit: "mW",
      defaultValue: 10,
      min: 1e-3
    },
    {
      key: "detectorSensitivity",
      label: "Detector Responsivity",
      symbol: "R_d",
      unit: "A/W",
      defaultValue: 0.6,
      min: 1e-3,
      tooltip: "Typical silicon photodiode: 0.5\u20130.8 A/W at 850 nm"
    },
    {
      key: "targetReflectivity",
      label: "Target Reflectivity",
      symbol: "R_t",
      unit: "%",
      defaultValue: 90,
      min: 0.1,
      max: 100,
      presets: [
        { label: "White paper (90%)", values: { targetReflectivity: 90 } },
        { label: "Gray plastic (40%)", values: { targetReflectivity: 40 } },
        { label: "Black rubber (5%)", values: { targetReflectivity: 5 } }
      ]
    },
    {
      key: "safetyFactor",
      label: "Safety Factor",
      symbol: "SF",
      unit: "",
      defaultValue: 1.5,
      min: 1
    }
  ],
  outputs: [
    { key: "maxRange", label: "Relative Detection Factor", symbol: "D_rel", unit: "", precision: 3 },
    { key: "normalizedRange", label: "Nominal Detection Factor", symbol: "D_nom", unit: "", precision: 3 }
  ],
  calculate: calculateOpticalSensorRange,
  formula: {
    primary: "D_rel = \u221A(P_e \xD7 R_d \xD7 (R_t/100)) / SF  [dimensionless relative factor]",
    variables: [
      { symbol: "P_e", description: "Emitter power", unit: "mW" },
      { symbol: "R_d", description: "Detector responsivity", unit: "A/W" },
      { symbol: "R_t", description: "Target reflectivity (0\u2013100%)", unit: "%" },
      { symbol: "SF", description: "Safety factor (\u22651)", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["photodiode-transimpedance", "sensor-accuracy-budget", "hall-effect-sensor"]
};

// src/lib/calculators/sensor/lvdt-sensitivity.ts
function calculateLvdtSensitivity(inputs) {
  const { sensitivity, excitationVoltage, coreDisplacement, fullScaleRange } = inputs;
  if (fullScaleRange <= 0) {
    return { values: { outputVoltage: 0, fullScaleOutput: 0, sensitivityMvMm: 0, linearRange: 0 }, errors: ["Full-scale range must be positive"] };
  }
  const outputVoltage = sensitivity * excitationVoltage * (coreDisplacement / fullScaleRange) * 100;
  const fullScaleOutput = sensitivity * excitationVoltage * 100;
  const sensitivityMvMm = sensitivity * excitationVoltage * 100 / fullScaleRange;
  const linearRange = fullScaleRange * 0.8;
  return { values: { outputVoltage, fullScaleOutput, sensitivityMvMm, linearRange } };
}
var lvdtSensitivity = {
  slug: "lvdt-sensitivity",
  title: "LVDT Sensitivity & Range",
  shortTitle: "LVDT",
  category: "sensor",
  description: "Calculate LVDT (Linear Variable Differential Transformer) output voltage, sensitivity in mV/mm, and linear range from excitation and stroke.",
  keywords: ["LVDT", "linear variable differential transformer", "LVDT sensitivity", "LVDT range", "displacement sensor", "position sensor LVDT"],
  inputs: [
    {
      key: "excitationVoltage",
      label: "Excitation Voltage (RMS)",
      symbol: "V_ex",
      unit: "V",
      defaultValue: 5,
      min: 0.1
    },
    {
      key: "sensitivity",
      label: "Sensitivity",
      symbol: "S",
      unit: "mV/V/%FS",
      defaultValue: 4,
      min: 1e-3,
      tooltip: "mV output per V excitation per % of full stroke (from datasheet)"
    },
    {
      key: "coreDisplacement",
      label: "Core Displacement",
      symbol: "x",
      unit: "mm",
      defaultValue: 5,
      min: 0
    },
    {
      key: "fullScaleRange",
      label: "Full-Scale Range (\xB1)",
      symbol: "FS",
      unit: "mm",
      defaultValue: 25,
      min: 1e-3
    }
  ],
  outputs: [
    { key: "outputVoltage", label: "Output Voltage (RMS)", symbol: "V_out", unit: "mV", precision: 2 },
    { key: "fullScaleOutput", label: "Full-Scale Output", symbol: "V_FS", unit: "mV", precision: 1 },
    { key: "sensitivityMvMm", label: "Sensitivity", symbol: "S", unit: "mV/mm", precision: 3 },
    { key: "linearRange", label: "Linear Range (est.)", symbol: "x_lin", unit: "mm", precision: 0 }
  ],
  calculate: calculateLvdtSensitivity,
  formula: {
    primary: "V_out = S \xD7 V_ex \xD7 (x/FS) \xD7 100",
    variables: [
      { symbol: "S", description: "Sensitivity", unit: "mV/V/%FS" },
      { symbol: "x", description: "Core displacement", unit: "mm" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["sensor-accuracy-budget", "capacitive-proximity", "hall-effect-sensor"]
};

// src/lib/calculators/sensor/loop-transmitter-4-20ma.ts
function calculateLoopTransmitter4to20ma(inputs) {
  const { loopCurrent, loopResistance, supplyVoltage, sensorRangeMin, sensorRangeMax } = inputs;
  const voltageAtLoad = loopCurrent * 1e-3 * loopResistance;
  const availableVoltage = supplyVoltage - voltageAtLoad;
  const sensorValue = sensorRangeMin + (sensorRangeMax - sensorRangeMin) * ((loopCurrent - 4) / 16);
  const maxLoopResistance = supplyVoltage > 12 ? (supplyVoltage - 12) / 0.02 : 0;
  return { values: { voltageAtLoad, availableVoltage, sensorValue, maxLoopResistance } };
}
var loopTransmitter420ma = {
  slug: "4-20ma-transmitter",
  title: "4\u201320 mA Loop Transmitter",
  shortTitle: "4-20mA Loop",
  category: "sensor",
  description: "Calculate 4\u201320 mA current loop voltage budget, sensor value from current, and maximum loop resistance for industrial sensor transmitters.",
  keywords: ["4-20mA loop", "current loop", "4-20mA transmitter", "industrial sensor", "loop resistance", "HART current loop"],
  inputs: [
    {
      key: "supplyVoltage",
      label: "Loop Supply Voltage",
      symbol: "V_s",
      unit: "V",
      defaultValue: 24,
      min: 12,
      presets: [
        { label: "24 V (standard)", values: { supplyVoltage: 24 } },
        { label: "12 V (battery)", values: { supplyVoltage: 12 } }
      ]
    },
    {
      key: "loopCurrent",
      label: "Loop Current",
      symbol: "I_loop",
      unit: "mA",
      defaultValue: 12,
      min: 4,
      max: 20
    },
    {
      key: "loopResistance",
      label: "Loop Resistance",
      symbol: "R_loop",
      unit: "\u03A9",
      defaultValue: 250,
      min: 0,
      tooltip: "Total cable + load resistance (250 \u03A9 = standard 1\u20135 V input)"
    },
    {
      key: "sensorRangeMin",
      label: "Sensor Range Min",
      symbol: "X_min",
      unit: "",
      defaultValue: 0,
      min: -99999
    },
    {
      key: "sensorRangeMax",
      label: "Sensor Range Max",
      symbol: "X_max",
      unit: "",
      defaultValue: 100,
      min: -99999
    }
  ],
  outputs: [
    { key: "sensorValue", label: "Sensor Value", symbol: "X", unit: "eng units", precision: 2 },
    { key: "voltageAtLoad", label: "Voltage at Load", symbol: "V_load", unit: "V", precision: 2 },
    { key: "availableVoltage", label: "Transmitter Voltage", symbol: "V_tx", unit: "V", precision: 2 },
    { key: "maxLoopResistance", label: "Max Loop Resistance", symbol: "R_max", unit: "\u03A9", precision: 0 }
  ],
  calculate: calculateLoopTransmitter4to20ma,
  formula: {
    primary: "I = 4 + 16 \xD7 (X \u2212 X_min)/(X_max \u2212 X_min) mA",
    variables: [
      { symbol: "I", description: "Loop current", unit: "mA" },
      { symbol: "X", description: "Process variable", unit: "eng units" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["current-shunt", "sensor-accuracy-budget", "load-cell-amplifier"]
};

// src/lib/calculators/unit-conversion/frequency-wavelength.ts
function calculateFrequencyWavelength(inputs) {
  const { frequency, velocityFactor } = inputs;
  if (frequency <= 0 || velocityFactor <= 0) {
    return { values: { wavelength: 0, wavelengthCm: 0, wavelengthMm: 0, halfWave: 0, quarterWave: 0 }, errors: ["Frequency and velocity factor must be positive"] };
  }
  const c = 3e8;
  const f_Hz = frequency * 1e6;
  const wavelength = c * velocityFactor / f_Hz;
  const wavelengthCm = wavelength * 100;
  const wavelengthMm = wavelength * 1e3;
  const halfWave = wavelength / 2;
  const quarterWave = wavelength / 4;
  return {
    values: {
      wavelength,
      wavelengthCm,
      wavelengthMm,
      halfWave,
      quarterWave
    }
  };
}
var frequencyWavelength = {
  slug: "frequency-wavelength",
  title: "Frequency to Wavelength Converter",
  shortTitle: "Frequency \u2194 Wavelength",
  category: "unit-conversion",
  description: "Convert frequency to wavelength in any medium. Calculates full, half, and quarter wavelengths for antenna design, transmission line, and RF system planning.",
  keywords: [
    "frequency wavelength",
    "wavelength calculator",
    "velocity factor",
    "half wavelength",
    "quarter wavelength",
    "antenna length",
    "transmission line wavelength"
  ],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 2400,
      min: 1e-3,
      tooltip: "Signal frequency in MHz",
      presets: [
        { label: "433 MHz", values: { frequency: 433 } },
        { label: "915 MHz", values: { frequency: 915 } },
        { label: "2.4 GHz", values: { frequency: 2400 } },
        { label: "5.8 GHz", values: { frequency: 5800 } },
        { label: "24 GHz", values: { frequency: 24e3 } }
      ]
    },
    {
      key: "velocityFactor",
      label: "Velocity Factor",
      symbol: "VF",
      unit: "",
      defaultValue: 1,
      min: 0.01,
      max: 1,
      step: 0.01,
      tooltip: "Velocity factor of medium: 1.0=free space, 0.66=coax, 0.97=FR4 PCB, 0.85=open-wire",
      presets: [
        { label: "Free space (1.0)", values: { velocityFactor: 1 } },
        { label: "Coaxial cable (0.66)", values: { velocityFactor: 0.66 } },
        { label: "FR4 PCB trace (0.57)", values: { velocityFactor: 0.57 } },
        { label: "Open-wire line (0.95)", values: { velocityFactor: 0.95 } }
      ]
    }
  ],
  outputs: [
    {
      key: "wavelength",
      label: "Wavelength",
      symbol: "\u03BB",
      unit: "m",
      precision: 4,
      tooltip: "Full wavelength in meters"
    },
    {
      key: "wavelengthCm",
      label: "Wavelength",
      symbol: "\u03BB",
      unit: "cm",
      precision: 3,
      tooltip: "Full wavelength in centimeters"
    },
    {
      key: "wavelengthMm",
      label: "Wavelength",
      symbol: "\u03BB",
      unit: "mm",
      precision: 2,
      tooltip: "Full wavelength in millimeters"
    },
    {
      key: "halfWave",
      label: "Half Wavelength (\u03BB/2)",
      symbol: "\u03BB/2",
      unit: "m",
      precision: 4,
      tooltip: "Half wavelength \u2014 typical dipole antenna length"
    },
    {
      key: "quarterWave",
      label: "Quarter Wavelength (\u03BB/4)",
      symbol: "\u03BB/4",
      unit: "m",
      precision: 4,
      tooltip: "Quarter wavelength \u2014 typical monopole antenna length"
    }
  ],
  calculate: calculateFrequencyWavelength,
  formula: {
    primary: "\u03BB = (c \xB7 VF) / f",
    latex: "\\lambda = \\frac{c \\cdot VF}{f}",
    variables: [
      { symbol: "\u03BB", description: "Wavelength", unit: "m" },
      { symbol: "c", description: "Speed of light (3\xD710\u2078)", unit: "m/s" },
      { symbol: "VF", description: "Velocity factor of medium", unit: "" },
      { symbol: "f", description: "Frequency", unit: "Hz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["free-space-path-loss", "dipole-antenna", "wavelength-frequency"],
  liveWidgets: [
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ]
};

// src/lib/calculators/unit-conversion/dbm-watts.ts
function calculateDbmWatts(inputs) {
  const { dbm } = inputs;
  const watts = Math.pow(10, dbm / 10) * 1e-3;
  const milliwatts = watts * 1e3;
  const dBW = dbm - 30;
  const volts = Math.sqrt(watts * 50);
  const dBuV = watts > 0 ? 20 * Math.log10(volts / 1e-6) : -Infinity;
  return {
    values: {
      watts,
      milliwatts,
      dBW,
      dBuV,
      volts
    }
  };
}
var dbmWatts = {
  slug: "dbm-watts",
  title: "dBm to Watts Power Converter",
  shortTitle: "dBm \u2194 Watts",
  category: "unit-conversion",
  description: "Convert RF power between dBm, Watts, milliwatts, dBW, dB\u03BCV, and RMS volts into 50\u03A9. Essential for link budgets, amplifier analysis, and RF system design.",
  keywords: [
    "dBm to watts",
    "power converter",
    "dBm calculator",
    "RF power",
    "dBW converter",
    "milliwatts",
    "dBuV",
    "RF unit conversion"
  ],
  inputs: [
    {
      key: "dbm",
      label: "Power",
      symbol: "P",
      unit: "dBm",
      defaultValue: 0,
      min: -200,
      max: 100,
      tooltip: "Power level in dBm (dB relative to 1 milliwatt)",
      presets: [
        { label: "\u2212100 dBm (noise floor)", values: { dbm: -100 } },
        { label: "\u221230 dBm (1 \u03BCW)", values: { dbm: -30 } },
        { label: "0 dBm (1 mW)", values: { dbm: 0 } },
        { label: "10 dBm (10 mW)", values: { dbm: 10 } },
        { label: "20 dBm (100 mW)", values: { dbm: 20 } },
        { label: "30 dBm (1 W)", values: { dbm: 30 } },
        { label: "43 dBm (20 W)", values: { dbm: 43 } }
      ]
    }
  ],
  outputs: [
    {
      key: "watts",
      label: "Power",
      symbol: "P",
      unit: "W",
      precision: 4,
      format: "engineering",
      tooltip: "Power in Watts"
    },
    {
      key: "milliwatts",
      label: "Power",
      symbol: "P",
      unit: "mW",
      precision: 4,
      format: "engineering",
      tooltip: "Power in milliwatts"
    },
    {
      key: "dBW",
      label: "Power",
      symbol: "P",
      unit: "dBW",
      precision: 2,
      tooltip: "Power in dBW (dB relative to 1 Watt). dBW = dBm \u2212 30"
    },
    {
      key: "dBuV",
      label: "Voltage Level (50\u03A9)",
      symbol: "V",
      unit: "dB\u03BCV",
      precision: 2,
      tooltip: "Voltage level in dB\u03BCV referenced to 1\u03BCV, in 50\u03A9 system"
    },
    {
      key: "volts",
      label: "RMS Voltage (50\u03A9)",
      symbol: "V",
      unit: "V",
      precision: 4,
      format: "engineering",
      tooltip: "RMS voltage into 50\u03A9 load: V = \u221A(P \xD7 50)"
    }
  ],
  calculate: calculateDbmWatts,
  formula: {
    primary: "P(W) = 10^(dBm/10) \xD7 10\u207B\xB3,  V = \u221A(P \xD7 50)",
    latex: "P(W) = 10^{dBm/10} \\times 10^{-3}, \\quad V = \\sqrt{P \\times 50}",
    variables: [
      { symbol: "P", description: "Power", unit: "W or mW" },
      { symbol: "dBm", description: "Power in dBm", unit: "dBm" },
      { symbol: "dBW", description: "Power in dBW (= dBm \u2212 30)", unit: "dBW" },
      { symbol: "V", description: "RMS voltage into 50\u03A9", unit: "V" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["db-converter", "rf-link-budget", "eirp-calculator"]
};

// src/lib/calculators/unit-conversion/temperature-converter.ts
function calculateTemperatureConverter(inputs) {
  const { celsius } = inputs;
  const fahrenheit = celsius * 9 / 5 + 32;
  const kelvin = celsius + 273.15;
  const rankine = kelvin * 9 / 5;
  const reaumur = celsius * 4 / 5;
  return {
    values: {
      fahrenheit,
      kelvin,
      rankine,
      reaumur
    }
  };
}
var temperatureConverter = {
  slug: "temperature-converter",
  title: "Temperature Unit Converter",
  shortTitle: "Temperature Converter",
  category: "unit-conversion",
  description: "Convert temperature between Celsius, Fahrenheit, Kelvin, Rankine, and R\xE9aumur scales. Useful for thermal analysis, datasheet comparison, and engineering calculations.",
  keywords: [
    "temperature converter",
    "Celsius to Fahrenheit",
    "Kelvin converter",
    "Rankine temperature",
    "temperature unit conversion",
    "C to F",
    "K to C"
  ],
  inputs: [
    {
      key: "celsius",
      label: "Temperature",
      symbol: "T",
      unit: "\xB0C",
      defaultValue: 25,
      min: -273.15,
      tooltip: "Temperature in degrees Celsius",
      presets: [
        { label: "Absolute zero (\u2212273.15\xB0C)", values: { celsius: -273.15 } },
        { label: "Water freezes (0\xB0C)", values: { celsius: 0 } },
        { label: "Standard room (25\xB0C)", values: { celsius: 25 } },
        { label: "Body temperature (37\xB0C)", values: { celsius: 37 } },
        { label: "Water boils (100\xB0C)", values: { celsius: 100 } },
        { label: "Solder melts (183\xB0C)", values: { celsius: 183 } }
      ]
    }
  ],
  outputs: [
    {
      key: "fahrenheit",
      label: "Fahrenheit",
      symbol: "\xB0F",
      unit: "\xB0F",
      precision: 2,
      tooltip: "Temperature in degrees Fahrenheit: F = C \xD7 9/5 + 32"
    },
    {
      key: "kelvin",
      label: "Kelvin",
      symbol: "K",
      unit: "K",
      precision: 2,
      tooltip: "Temperature in Kelvin (absolute scale): K = C + 273.15"
    },
    {
      key: "rankine",
      label: "Rankine",
      symbol: "\xB0R",
      unit: "\xB0R",
      precision: 2,
      tooltip: "Temperature in degrees Rankine (absolute Fahrenheit scale): R = K \xD7 9/5"
    },
    {
      key: "reaumur",
      label: "R\xE9aumur",
      symbol: "\xB0R\xE9",
      unit: "\xB0R\xE9",
      precision: 2,
      tooltip: "Temperature in degrees R\xE9aumur: R\xE9 = C \xD7 4/5"
    }
  ],
  calculate: calculateTemperatureConverter,
  formula: {
    primary: "F = C\xD79/5 + 32,  K = C + 273.15",
    latex: "F = \\frac{9}{5}C + 32, \\quad K = C + 273.15",
    variables: [
      { symbol: "C", description: "Celsius", unit: "\xB0C" },
      { symbol: "F", description: "Fahrenheit", unit: "\xB0F" },
      { symbol: "K", description: "Kelvin", unit: "K" },
      { symbol: "R", description: "Rankine", unit: "\xB0R" },
      { symbol: "R\xE9", description: "R\xE9aumur", unit: "\xB0R\xE9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["junction-temperature", "ntc-thermistor", "rtd-temperature"]
};

// src/lib/calculators/unit-conversion/awg-wire.ts
function calculateAwgWire(inputs) {
  const { awg } = inputs;
  if (awg < 0 || awg > 40) {
    return { values: { diameterMm: 0, diameterIn: 0, areaMm2: 0, resistance20C: 0, currentCapacity: 0 }, errors: ["AWG must be between 0 and 40"] };
  }
  const diameterIn = 5e-3 * Math.pow(92, (36 - awg) / 39);
  const diameterMm = diameterIn * 25.4;
  const areaMm2 = Math.PI * Math.pow(diameterMm / 2, 2);
  const resistance20C = 1 / (58e6 * areaMm2 * 1e-6) * 1e3;
  const currentCapacity = 7 * Math.pow(areaMm2, 0.726);
  return {
    values: {
      diameterMm,
      diameterIn,
      areaMm2,
      resistance20C,
      currentCapacity
    }
  };
}
var awgWire = {
  slug: "awg-wire",
  title: "AWG Wire Gauge Calculator",
  shortTitle: "AWG Wire Gauge",
  category: "unit-conversion",
  description: "Convert AWG wire gauge to diameter (mm/inches), cross-sectional area (mm\xB2), resistance per meter, and approximate current carrying capacity.",
  keywords: [
    "AWG wire gauge",
    "wire diameter",
    "wire resistance",
    "copper wire",
    "wire cross section",
    "current capacity",
    "wire calculator",
    "AWG to mm"
  ],
  inputs: [
    {
      key: "awg",
      label: "AWG Gauge",
      symbol: "AWG",
      unit: "AWG",
      defaultValue: 24,
      min: 0,
      max: 40,
      step: 1,
      tooltip: "American Wire Gauge number. Lower number = thicker wire.",
      presets: [
        { label: "10 AWG (5.26mm\xB2)", values: { awg: 10 } },
        { label: "18 AWG (0.82mm\xB2)", values: { awg: 18 } },
        { label: "22 AWG (0.33mm\xB2)", values: { awg: 22 } },
        { label: "24 AWG (0.20mm\xB2)", values: { awg: 24 } },
        { label: "26 AWG (0.13mm\xB2)", values: { awg: 26 } },
        { label: "28 AWG (0.08mm\xB2)", values: { awg: 28 } },
        { label: "30 AWG (0.05mm\xB2)", values: { awg: 30 } }
      ]
    }
  ],
  outputs: [
    {
      key: "diameterMm",
      label: "Diameter",
      symbol: "d",
      unit: "mm",
      precision: 4,
      tooltip: "Wire conductor diameter in millimeters"
    },
    {
      key: "diameterIn",
      label: "Diameter",
      symbol: "d",
      unit: "in",
      precision: 5,
      tooltip: "Wire conductor diameter in inches"
    },
    {
      key: "areaMm2",
      label: "Cross-Section Area",
      symbol: "A",
      unit: "mm\xB2",
      precision: 4,
      tooltip: "Conductor cross-sectional area in mm\xB2"
    },
    {
      key: "resistance20C",
      label: "Resistance (20\xB0C)",
      symbol: "R",
      unit: "m\u03A9/m",
      precision: 3,
      tooltip: "DC resistance per meter at 20\xB0C for copper conductor"
    },
    {
      key: "currentCapacity",
      label: "Current Capacity",
      symbol: "I_max",
      unit: "A",
      precision: 2,
      tooltip: "Approximate current capacity for chassis wiring (free air). Derate 40\u201350% in conduit."
    }
  ],
  calculate: calculateAwgWire,
  formula: {
    primary: "d(in) = 0.005 \xD7 92^((36\u2212AWG)/39)",
    latex: "d_{in} = 0.005 \\times 92^{\\frac{36-AWG}{39}}",
    variables: [
      { symbol: "d", description: "Wire diameter", unit: "in" },
      { symbol: "AWG", description: "American Wire Gauge number", unit: "" },
      { symbol: "A", description: "Cross-sectional area (\u03C0 \xD7 (d/2)\xB2)", unit: "mm\xB2" },
      { symbol: "R", description: "Resistance: \u03C1\xB7L/A (copper \u03C1 = 1/58 \u03BC\u03A9\xB7m)", unit: "m\u03A9/m" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["trace-width-current", "trace-resistance", "ohms-law"]
};

// src/lib/calculators/unit-conversion/capacitor-code.ts
function calculateCapacitorCode(inputs) {
  const { code } = inputs;
  const codeInt = Math.round(code);
  if (codeInt < 100 || codeInt > 999) {
    return {
      values: { picofarads: 0, nanofarads: 0, microfarads: 0, voltageCode: 0 },
      errors: ["Code must be a 3-digit number between 100 and 999"]
    };
  }
  const d1 = Math.floor(codeInt / 100);
  const d2 = Math.floor(codeInt % 100 / 10);
  const d3 = codeInt % 10;
  let multiplier;
  if (d3 === 9) {
    multiplier = 0.1;
  } else {
    multiplier = Math.pow(10, d3);
  }
  const picofarads = (d1 * 10 + d2) * multiplier;
  const nanofarads = picofarads / 1e3;
  const microfarads = picofarads / 1e6;
  const voltageCode = 0;
  return {
    values: {
      picofarads,
      nanofarads,
      microfarads,
      voltageCode
    }
  };
}
var capacitorCode = {
  slug: "capacitor-code",
  title: "Capacitor Code Decoder",
  shortTitle: "Capacitor Code",
  category: "unit-conversion",
  description: "Decode 3-digit capacitor code (e.g., 104 = 100nF) to capacitance in pF, nF, and \u03BCF. Works with ceramic, film, and tantalum capacitor markings.",
  keywords: [
    "capacitor code",
    "capacitor decoder",
    "3-digit code",
    "capacitor value",
    "ceramic capacitor",
    "104 capacitor",
    "capacitor marking"
  ],
  inputs: [
    {
      key: "code",
      label: "Capacitor Code",
      symbol: "code",
      unit: "",
      defaultValue: 104,
      min: 100,
      max: 999,
      step: 1,
      tooltip: "3-digit code: first 2 digits = significant figures, 3rd digit = multiplier power of 10 in pF. E.g., 104 = 10 \xD7 10\u2074 pF = 100nF",
      presets: [
        { label: "100 = 10pF", values: { code: 100 } },
        { label: "101 = 100pF", values: { code: 101 } },
        { label: "102 = 1nF", values: { code: 102 } },
        { label: "103 = 10nF", values: { code: 103 } },
        { label: "104 = 100nF", values: { code: 104 } },
        { label: "105 = 1\u03BCF", values: { code: 105 } },
        { label: "224 = 220nF", values: { code: 224 } },
        { label: "473 = 47nF", values: { code: 473 } }
      ]
    }
  ],
  outputs: [
    {
      key: "picofarads",
      label: "Capacitance",
      symbol: "C",
      unit: "pF",
      precision: 2,
      tooltip: "Capacitance in picofarads (pF)"
    },
    {
      key: "nanofarads",
      label: "Capacitance",
      symbol: "C",
      unit: "nF",
      precision: 4,
      tooltip: "Capacitance in nanofarads (nF)"
    },
    {
      key: "microfarads",
      label: "Capacitance",
      symbol: "C",
      unit: "\u03BCF",
      precision: 6,
      tooltip: "Capacitance in microfarads (\u03BCF)"
    },
    {
      key: "voltageCode",
      label: "Voltage Code",
      symbol: "V",
      unit: "V",
      precision: 0,
      tooltip: "Voltage rating from separate letter code (if present; 0 = not encoded in 3-digit code)"
    }
  ],
  calculate: calculateCapacitorCode,
  formula: {
    primary: "C(pF) = (d1 \xD7 10 + d2) \xD7 10^d3",
    latex: "C(pF) = (d_1 \\times 10 + d_2) \\times 10^{d_3}",
    variables: [
      { symbol: "d1", description: "First digit (hundreds)", unit: "" },
      { symbol: "d2", description: "Second digit (tens)", unit: "" },
      { symbol: "d3", description: "Third digit (multiplier exponent)", unit: "" },
      { symbol: "C", description: "Capacitance", unit: "pF" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["capacitor-energy", "rc-time-constant", "lc-resonance"]
};

// src/lib/calculators/unit-conversion/inductance-units.ts
function calculateInductanceUnits(inputs) {
  const { henry } = inputs;
  return {
    values: {
      millihenry: henry * 1e3,
      microhenry: henry * 1e6,
      nanohenry: henry * 1e9,
      picohenry: henry * 1e12
    }
  };
}
var inductanceUnits = {
  slug: "inductance-units",
  title: "Inductance Unit Converter",
  shortTitle: "Inductance Converter",
  category: "unit-conversion",
  description: "Convert inductance between henries, millihenries, microhenries, nanohenries, and picohenries.",
  keywords: ["inductance converter", "henry to microhenry", "mH to \u03BCH", "nH to \u03BCH", "inductance unit conversion", "inductor value converter"],
  inputs: [
    {
      key: "henry",
      label: "Inductance",
      symbol: "L",
      unit: "H",
      defaultValue: 1e-6,
      min: 0,
      step: 1e-9,
      presets: [
        { label: "1 nH (bond wire)", values: { henry: 1e-9 } },
        { label: "100 nH (RF choke)", values: { henry: 1e-7 } },
        { label: "10 \u03BCH (SMPS)", values: { henry: 1e-5 } },
        { label: "100 \u03BCH (filter)", values: { henry: 1e-4 } },
        { label: "10 mH (audio)", values: { henry: 0.01 } },
        { label: "1 H (power)", values: { henry: 1 } }
      ]
    }
  ],
  outputs: [
    { key: "millihenry", label: "Millihenries", symbol: "mH", unit: "mH", precision: 6 },
    { key: "microhenry", label: "Microhenries", symbol: "\u03BCH", unit: "\u03BCH", precision: 4 },
    { key: "nanohenry", label: "Nanohenries", symbol: "nH", unit: "nH", precision: 2 },
    { key: "picohenry", label: "Picohenries", symbol: "pH", unit: "pH", precision: 0 }
  ],
  calculate: calculateInductanceUnits,
  formula: {
    primary: "1 H = 10\xB3 mH = 10\u2076 \u03BCH = 10\u2079 nH = 10\xB9\xB2 pH",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["capacitance-units", "lc-resonance", "frequency-wavelength"]
};

// src/lib/calculators/unit-conversion/capacitance-units.ts
function calculateCapacitanceUnits(inputs) {
  const { farad } = inputs;
  return {
    values: {
      millifarad: farad * 1e3,
      microfarad: farad * 1e6,
      nanofarad: farad * 1e9,
      picofarad: farad * 1e12
    }
  };
}
var capacitanceUnits = {
  slug: "capacitance-units",
  title: "Capacitance Unit Converter",
  shortTitle: "Capacitance Converter",
  category: "unit-conversion",
  description: "Convert capacitance between farads, millifarads, microfarads, nanofarads, and picofarads.",
  keywords: ["capacitance converter", "\u03BCF to nF", "pF to nF", "capacitor value converter", "capacitance unit conversion", "farad converter"],
  inputs: [
    {
      key: "farad",
      label: "Capacitance",
      symbol: "C",
      unit: "F",
      defaultValue: 1e-7,
      min: 0,
      step: 1e-12,
      presets: [
        { label: "1 pF (PCB stray)", values: { farad: 1e-12 } },
        { label: "100 pF (RF)", values: { farad: 1e-10 } },
        { label: "10 nF (bypass)", values: { farad: 1e-8 } },
        { label: "100 nF (decoupling)", values: { farad: 1e-7 } },
        { label: "10 \u03BCF (bulk)", values: { farad: 1e-5 } },
        { label: "1000 \u03BCF (electrolytic)", values: { farad: 1e-3 } }
      ]
    }
  ],
  outputs: [
    { key: "millifarad", label: "Millifarads", symbol: "mF", unit: "mF", precision: 6 },
    { key: "microfarad", label: "Microfarads", symbol: "\u03BCF", unit: "\u03BCF", precision: 4 },
    { key: "nanofarad", label: "Nanofarads", symbol: "nF", unit: "nF", precision: 3 },
    { key: "picofarad", label: "Picofarads", symbol: "pF", unit: "pF", precision: 1 }
  ],
  calculate: calculateCapacitanceUnits,
  formula: {
    primary: "1 F = 10\xB3 mF = 10\u2076 \u03BCF = 10\u2079 nF = 10\xB9\xB2 pF",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["inductance-units", "capacitor-code", "lc-resonance"]
};

// src/lib/calculators/unit-conversion/resistance-units.ts
function calculateResistanceUnits(inputs) {
  const { ohm } = inputs;
  return {
    values: {
      milliohm: ohm * 1e3,
      kilohm: ohm * 1e-3,
      megaohm: ohm * 1e-6,
      gigaohm: ohm * 1e-9
    }
  };
}
var resistanceUnits = {
  slug: "resistance-units",
  title: "Resistance Unit Converter",
  shortTitle: "Resistance Converter",
  category: "unit-conversion",
  description: "Convert resistance between milliohms, ohms, kilohms, megaohms, and gigaohms.",
  keywords: ["resistance converter", "ohm to kilohm", "M\u03A9 to k\u03A9", "resistance unit conversion", "resistor value converter", "m\u03A9 to \u03A9"],
  inputs: [
    {
      key: "ohm",
      label: "Resistance",
      symbol: "R",
      unit: "\u03A9",
      defaultValue: 1e3,
      min: 0,
      presets: [
        { label: "10 m\u03A9 (shunt)", values: { ohm: 0.01 } },
        { label: "50 \u03A9 (RF)", values: { ohm: 50 } },
        { label: "1 k\u03A9", values: { ohm: 1e3 } },
        { label: "10 k\u03A9", values: { ohm: 1e4 } },
        { label: "1 M\u03A9", values: { ohm: 1e6 } },
        { label: "100 M\u03A9 (insulation)", values: { ohm: 1e8 } }
      ]
    }
  ],
  outputs: [
    { key: "milliohm", label: "Milliohms", symbol: "m\u03A9", unit: "m\u03A9", precision: 3 },
    { key: "kilohm", label: "Kilohms", symbol: "k\u03A9", unit: "k\u03A9", precision: 4 },
    { key: "megaohm", label: "Megaohms", symbol: "M\u03A9", unit: "M\u03A9", precision: 6 },
    { key: "gigaohm", label: "Gigaohms", symbol: "G\u03A9", unit: "G\u03A9", precision: 9 }
  ],
  calculate: calculateResistanceUnits,
  formula: {
    primary: "1 k\u03A9 = 1000 \u03A9,  1 M\u03A9 = 10\u2076 \u03A9",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["inductance-units", "capacitance-units", "ohms-law"]
};

// src/lib/calculators/unit-conversion/current-units.ts
function calculateCurrentUnits(inputs) {
  const { ampere } = inputs;
  return {
    values: {
      milliampere: ampere * 1e3,
      microampere: ampere * 1e6,
      nanoampere: ampere * 1e9,
      picoampere: ampere * 1e12
    }
  };
}
var currentUnits = {
  slug: "current-units",
  title: "Current Unit Converter",
  shortTitle: "Current Converter",
  category: "unit-conversion",
  description: "Convert electric current between amperes, milliamperes, microamperes, nanoamperes, and picoamperes.",
  keywords: ["current converter", "mA to \u03BCA", "nA to mA", "current unit conversion", "ampere converter", "\u03BCA to A"],
  inputs: [
    {
      key: "ampere",
      label: "Current",
      symbol: "I",
      unit: "A",
      defaultValue: 0.01,
      min: 0,
      step: 1e-9,
      presets: [
        { label: "1 pA (photodiode dark current)", values: { ampere: 1e-12 } },
        { label: "1 \u03BCA (quiescent)", values: { ampere: 1e-6 } },
        { label: "1 mA (LED)", values: { ampere: 1e-3 } },
        { label: "10 mA (MCU GPIO)", values: { ampere: 0.01 } },
        { label: "1 A (small motor)", values: { ampere: 1 } },
        { label: "10 A (power)", values: { ampere: 10 } }
      ]
    }
  ],
  outputs: [
    { key: "milliampere", label: "Milliamperes", symbol: "mA", unit: "mA", precision: 4 },
    { key: "microampere", label: "Microamperes", symbol: "\u03BCA", unit: "\u03BCA", precision: 3 },
    { key: "nanoampere", label: "Nanoamperes", symbol: "nA", unit: "nA", precision: 2 },
    { key: "picoampere", label: "Picoamperes", symbol: "pA", unit: "pA", precision: 1 }
  ],
  calculate: calculateCurrentUnits,
  formula: {
    primary: "1 A = 10\xB3 mA = 10\u2076 \u03BCA = 10\u2079 nA = 10\xB9\xB2 pA",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["voltage-units", "resistance-units", "ohms-law"]
};

// src/lib/calculators/unit-conversion/voltage-units.ts
function calculateVoltageUnits(inputs) {
  const { volt } = inputs;
  return {
    values: {
      microvolt: volt * 1e6,
      millivolt: volt * 1e3,
      kilovolt: volt * 1e-3,
      megavolt: volt * 1e-6
    }
  };
}
var voltageUnits = {
  slug: "voltage-units",
  title: "Voltage Unit Converter",
  shortTitle: "Voltage Converter",
  category: "unit-conversion",
  description: "Convert voltage between microvolts, millivolts, volts, kilovolts, and megavolts.",
  keywords: ["voltage converter", "mV to V", "kV to V", "voltage unit conversion", "volt converter", "\u03BCV to mV"],
  inputs: [
    {
      key: "volt",
      label: "Voltage",
      symbol: "V",
      unit: "V",
      defaultValue: 1,
      min: 0,
      presets: [
        { label: "1 \u03BCV (noise floor)", values: { volt: 1e-6 } },
        { label: "1 mV (thermocouple)", values: { volt: 1e-3 } },
        { label: "3.3 V (logic)", values: { volt: 3.3 } },
        { label: "12 V (DC supply)", values: { volt: 12 } },
        { label: "230 V (mains)", values: { volt: 230 } },
        { label: "1 kV (HV)", values: { volt: 1e3 } }
      ]
    }
  ],
  outputs: [
    { key: "microvolt", label: "Microvolts", symbol: "\u03BCV", unit: "\u03BCV", precision: 2 },
    { key: "millivolt", label: "Millivolts", symbol: "mV", unit: "mV", precision: 4 },
    { key: "kilovolt", label: "Kilovolts", symbol: "kV", unit: "kV", precision: 6 },
    { key: "megavolt", label: "Megavolts", symbol: "MV", unit: "MV", precision: 9 }
  ],
  calculate: calculateVoltageUnits,
  formula: {
    primary: "1 V = 10\xB3 mV = 10\u2076 \u03BCV",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["current-units", "resistance-units", "ohms-law"]
};

// src/lib/calculators/unit-conversion/time-units.ts
function calculateTimeUnits(inputs) {
  const { second } = inputs;
  return {
    values: {
      millisecond: second * 1e3,
      microsecond: second * 1e6,
      nanosecond: second * 1e9,
      picosecond: second * 1e12,
      femtosecond: second * 1e15
    }
  };
}
var timeUnits = {
  slug: "time-units",
  title: "Time Unit Converter",
  shortTitle: "Time Converter",
  category: "unit-conversion",
  description: "Convert time between seconds, milliseconds, microseconds, nanoseconds, picoseconds, and femtoseconds for digital and RF applications.",
  keywords: ["time unit converter", "ns to \u03BCs", "ms to \u03BCs", "picosecond converter", "nanosecond converter", "time conversion electronics"],
  inputs: [
    {
      key: "second",
      label: "Time",
      symbol: "t",
      unit: "s",
      defaultValue: 1e-6,
      min: 0,
      step: 1e-12,
      presets: [
        { label: "1 fs (optical)", values: { second: 1e-15 } },
        { label: "1 ps (RF)", values: { second: 1e-12 } },
        { label: "1 ns (digital)", values: { second: 1e-9 } },
        { label: "1 \u03BCs (MCU)", values: { second: 1e-6 } },
        { label: "1 ms (audio)", values: { second: 1e-3 } },
        { label: "1 s", values: { second: 1 } }
      ]
    }
  ],
  outputs: [
    { key: "millisecond", label: "Milliseconds", symbol: "ms", unit: "ms", precision: 6 },
    { key: "microsecond", label: "Microseconds", symbol: "\u03BCs", unit: "\u03BCs", precision: 4 },
    { key: "nanosecond", label: "Nanoseconds", symbol: "ns", unit: "ns", precision: 2 },
    { key: "picosecond", label: "Picoseconds", symbol: "ps", unit: "ps", precision: 0 },
    { key: "femtosecond", label: "Femtoseconds", symbol: "fs", unit: "fs", precision: 0 }
  ],
  calculate: calculateTimeUnits,
  formula: {
    primary: "1 s = 10\xB3 ms = 10\u2076 \u03BCs = 10\u2079 ns = 10\xB9\xB2 ps = 10\xB9\u2075 fs",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["frequency-wavelength", "current-units", "rc-time-constant"]
};

// src/lib/calculators/unit-conversion/magnetic-flux-units.ts
function calculateMagneticFluxUnits(inputs) {
  const { tesla } = inputs;
  return {
    values: {
      millitesla: tesla * 1e3,
      microtesla: tesla * 1e6,
      nanotesla: tesla * 1e9,
      gauss: tesla * 1e4
    }
  };
}
var magneticFluxUnits = {
  slug: "magnetic-flux-units",
  title: "Magnetic Flux Density Converter",
  shortTitle: "Magnetic Units",
  category: "unit-conversion",
  description: "Convert magnetic flux density between Tesla, milliTesla, microTesla, Gauss, and nanoTesla for sensor and motor applications.",
  keywords: ["tesla converter", "gauss to tesla", "magnetic flux density", "magnetic field units", "nT to \u03BCT", "magnetics unit conversion"],
  inputs: [
    {
      key: "tesla",
      label: "Magnetic Flux Density",
      symbol: "B",
      unit: "T",
      defaultValue: 1e-3,
      min: 0,
      step: 1e-9,
      presets: [
        { label: "Earth field (50 \u03BCT)", values: { tesla: 5e-5 } },
        { label: "Hall sensor range (0.1 T)", values: { tesla: 0.1 } },
        { label: "Neodymium magnet (1 T)", values: { tesla: 1 } },
        { label: "MRI scanner (3 T)", values: { tesla: 3 } }
      ]
    }
  ],
  outputs: [
    { key: "millitesla", label: "Millitesla", symbol: "mT", unit: "mT", precision: 4 },
    { key: "microtesla", label: "Microtesla", symbol: "\u03BCT", unit: "\u03BCT", precision: 2 },
    { key: "nanotesla", label: "Nanotesla", symbol: "nT", unit: "nT", precision: 0 },
    { key: "gauss", label: "Gauss", symbol: "G", unit: "G", precision: 2 }
  ],
  calculate: calculateMagneticFluxUnits,
  formula: {
    primary: "1 T = 10\u2074 G = 10\xB3 mT = 10\u2076 \u03BCT",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["hall-effect-sensor", "inductance-units", "current-units"]
};

// src/lib/calculators/unit-conversion/data-rate-units.ts
function calculateDataRateUnits(inputs) {
  const { bps } = inputs;
  return {
    values: {
      kbps: bps / 1e3,
      mbps: bps / 1e6,
      gbps: bps / 1e9,
      bytesPerSecond: bps / 8,
      kBps: bps / 8 / 1e3,
      mBps: bps / 8 / 1e6
    }
  };
}
var dataRateUnits = {
  slug: "data-rate-units",
  title: "Data Rate Unit Converter",
  shortTitle: "Data Rate Converter",
  category: "unit-conversion",
  description: "Convert data rates between bits per second (bps), kbps, Mbps, Gbps, and bytes per second.",
  keywords: ["data rate converter", "bps to Mbps", "Mbps to MBps", "bandwidth converter", "bits per second", "data throughput"],
  inputs: [
    {
      key: "bps",
      label: "Data Rate",
      symbol: "R",
      unit: "bps",
      defaultValue: 1e6,
      min: 0,
      presets: [
        { label: "9600 bps (UART)", values: { bps: 9600 } },
        { label: "1 Mbps (CAN)", values: { bps: 1e6 } },
        { label: "100 Mbps (Ethernet)", values: { bps: 1e8 } },
        { label: "1 Gbps (GbE)", values: { bps: 1e9 } },
        { label: "10 Gbps (SFP+)", values: { bps: 1e10 } }
      ]
    }
  ],
  outputs: [
    { key: "kbps", label: "Kilobits/sec", symbol: "kbps", unit: "kbps", precision: 3 },
    { key: "mbps", label: "Megabits/sec", symbol: "Mbps", unit: "Mbps", precision: 4 },
    { key: "gbps", label: "Gigabits/sec", symbol: "Gbps", unit: "Gbps", precision: 5 },
    { key: "bytesPerSecond", label: "Bytes/sec", symbol: "B/s", unit: "B/s", precision: 0 },
    { key: "kBps", label: "Kilobytes/sec", symbol: "kB/s", unit: "kB/s", precision: 2 },
    { key: "mBps", label: "Megabytes/sec", symbol: "MB/s", unit: "MB/s", precision: 3 }
  ],
  calculate: calculateDataRateUnits,
  formula: {
    primary: "1 byte = 8 bits,  1 Mbps = 10\u2076 bps",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["time-units", "uart-baud-rate", "frequency-wavelength"]
};

// src/lib/calculators/unit-conversion/angle-units.ts
function calculateAngleUnits(inputs) {
  const { degree } = inputs;
  const radian = degree * Math.PI / 180;
  const gradian = degree * 400 / 360;
  const arcminute = degree * 60;
  const arcsecond = degree * 3600;
  const turn = degree / 360;
  return { values: { radian, gradian, arcminute, arcsecond, turn } };
}
var angleUnits = {
  slug: "angle-units",
  title: "Angle Unit Converter",
  shortTitle: "Angle Converter",
  category: "unit-conversion",
  description: "Convert angles between degrees, radians, gradians, arcminutes, arcseconds, and turns for motor, antenna, and RF applications.",
  keywords: ["angle converter", "degrees to radians", "radians to degrees", "gradian", "arcminute arcsecond", "angle unit conversion"],
  inputs: [
    {
      key: "degree",
      label: "Angle",
      symbol: "\u03B8",
      unit: "\xB0",
      defaultValue: 90,
      min: -360,
      max: 360,
      presets: [
        { label: "45\xB0 (eighth turn)", values: { degree: 45 } },
        { label: "90\xB0 (quarter turn)", values: { degree: 90 } },
        { label: "180\xB0 (half turn)", values: { degree: 180 } },
        { label: "360\xB0 (full turn)", values: { degree: 360 } }
      ]
    }
  ],
  outputs: [
    { key: "radian", label: "Radians", symbol: "rad", unit: "rad", precision: 6 },
    { key: "gradian", label: "Gradians", symbol: "grad", unit: "grad", precision: 3 },
    { key: "arcminute", label: "Arcminutes", symbol: "'", unit: "'", precision: 1 },
    { key: "arcsecond", label: "Arcseconds", symbol: '"', unit: '"', precision: 0 },
    { key: "turn", label: "Turns", symbol: "rev", unit: "rev", precision: 4 }
  ],
  calculate: calculateAngleUnits,
  formula: {
    primary: "1\xB0 = \u03C0/180 rad = 10/9 grad",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["encoder-resolution", "gear-ratio", "antenna-beamwidth"]
};

// src/lib/calculators/unit-conversion/energy-units.ts
function calculateEnergyUnits(inputs) {
  const { joule } = inputs;
  return {
    values: {
      millijoule: joule * 1e3,
      microjoule: joule * 1e6,
      electronvolt: joule / 1602e-22,
      kwh: joule / 36e5,
      calorie: joule / 4.184,
      btu: joule / 1055.06
    }
  };
}
var energyUnits = {
  slug: "energy-units",
  title: "Energy Unit Converter",
  shortTitle: "Energy Converter",
  category: "unit-conversion",
  description: "Convert energy between joules, millijoules, electron-volts, kilowatt-hours, calories, and BTU.",
  keywords: ["energy converter", "joule to kWh", "eV to joule", "energy unit conversion", "BTU to joule", "calorie converter"],
  inputs: [
    {
      key: "joule",
      label: "Energy",
      symbol: "E",
      unit: "J",
      defaultValue: 1,
      min: 0,
      presets: [
        { label: "1 eV (semiconductor)", values: { joule: 1602e-22 } },
        { label: "1 mJ (ESD pulse)", values: { joule: 1e-3 } },
        { label: "1 J (capacitor discharge)", values: { joule: 1 } },
        { label: "1 kWh (battery)", values: { joule: 36e5 } }
      ]
    }
  ],
  outputs: [
    { key: "millijoule", label: "Millijoules", symbol: "mJ", unit: "mJ", precision: 3 },
    { key: "microjoule", label: "Microjoules", symbol: "\u03BCJ", unit: "\u03BCJ", precision: 2 },
    { key: "electronvolt", label: "Electron-Volts", symbol: "eV", unit: "eV", precision: 3 },
    { key: "kwh", label: "Kilowatt-Hours", symbol: "kWh", unit: "kWh", precision: 8 },
    { key: "calorie", label: "Calories", symbol: "cal", unit: "cal", precision: 4 },
    { key: "btu", label: "BTU", symbol: "BTU", unit: "BTU", precision: 5 }
  ],
  calculate: calculateEnergyUnits,
  formula: {
    primary: "1 kWh = 3.6 MJ,  1 eV = 1.602 \xD7 10\u207B\xB9\u2079 J",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["capacitor-energy", "inductor-energy", "battery-life"]
};

// src/lib/calculators/unit-conversion/torque-units.ts
function calculateTorqueUnitsConv(inputs) {
  const { nm } = inputs;
  return {
    values: {
      lbFt: nm * 0.737562,
      lbIn: nm * 8.85075,
      ozIn: nm * 141.612,
      kgCm: nm * 10.1972,
      kgM: nm * 0.101972,
      dyneCm: nm * 1e7
    }
  };
}
var torqueUnitsConv = {
  slug: "torque-units",
  title: "Torque Unit Converter (N\xB7m/lb\xB7ft/oz\xB7in)",
  shortTitle: "Torque Converter",
  category: "unit-conversion",
  description: "Convert torque between Newton-metres, pound-feet, pound-inches, oz\xB7in, kg\xB7cm, kg\xB7m, and dyne\xB7cm.",
  keywords: ["torque unit converter", "N-m to lb-ft", "oz-in to N-m", "torque conversion", "kg-cm to N-m", "torque units"],
  inputs: [
    {
      key: "nm",
      label: "Torque",
      symbol: "T",
      unit: "N\xB7m",
      defaultValue: 1,
      min: 0,
      step: 1e-3,
      presets: [
        { label: "1 oz\xB7in = 0.00706 N\xB7m", values: { nm: 706e-5 } },
        { label: "1 kg\xB7cm = 0.0981 N\xB7m", values: { nm: 0.0981 } },
        { label: "1 lb\xB7ft = 1.356 N\xB7m", values: { nm: 1.356 } },
        { label: "10 N\xB7m", values: { nm: 10 } },
        { label: "100 N\xB7m (car engine)", values: { nm: 100 } }
      ]
    }
  ],
  outputs: [
    { key: "lbFt", label: "Pound-feet", symbol: "lb\xB7ft", unit: "lb\xB7ft", precision: 4 },
    { key: "lbIn", label: "Pound-inches", symbol: "lb\xB7in", unit: "lb\xB7in", precision: 3 },
    { key: "ozIn", label: "Oz-inches", symbol: "oz\xB7in", unit: "oz\xB7in", precision: 2 },
    { key: "kgCm", label: "Kg-centimetres", symbol: "kg\xB7cm", unit: "kg\xB7cm", precision: 3 },
    { key: "kgM", label: "Kg-metres", symbol: "kg\xB7m", unit: "kg\xB7m", precision: 4 },
    { key: "dyneCm", label: "Dyne\xB7cm", symbol: "dyn\xB7cm", unit: "dyn\xB7cm", precision: 0 }
  ],
  calculate: calculateTorqueUnitsConv,
  formula: {
    primary: "1 N\xB7m = 0.7376 lb\xB7ft = 141.6 oz\xB7in",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["torque-unit-converter", "gear-ratio", "dc-motor-speed"]
};

// src/lib/calculators/unit-conversion/illuminance-units.ts
function calculateIlluminanceUnits(inputs) {
  const { lux } = inputs;
  return {
    values: {
      footcandle: lux / 10.7639,
      millilux: lux * 1e3,
      kilolux: lux / 1e3,
      phot: lux / 1e4
    }
  };
}
var illuminanceUnits = {
  slug: "illuminance-units",
  title: "Illuminance Unit Converter",
  shortTitle: "Illuminance Converter",
  category: "unit-conversion",
  description: "Convert illuminance between lux, foot-candles, millilux, kilolux, and phot for ambient light sensor and LED design.",
  keywords: ["lux converter", "lux to foot-candle", "illuminance converter", "foot-candle to lux", "light level converter", "ambient light units"],
  inputs: [
    {
      key: "lux",
      label: "Illuminance",
      symbol: "E",
      unit: "lux",
      defaultValue: 500,
      min: 0,
      presets: [
        { label: "Moonlight (1 lux)", values: { lux: 1 } },
        { label: "Office lighting (500 lux)", values: { lux: 500 } },
        { label: "Bright outdoors (10,000 lux)", values: { lux: 1e4 } },
        { label: "Direct sunlight (100,000 lux)", values: { lux: 1e5 } }
      ]
    }
  ],
  outputs: [
    { key: "footcandle", label: "Foot-candles", symbol: "fc", unit: "fc", precision: 3 },
    { key: "millilux", label: "Millilux", symbol: "mlux", unit: "mlux", precision: 0 },
    { key: "kilolux", label: "Kilolux", symbol: "klux", unit: "klux", precision: 3 },
    { key: "phot", label: "Phot", symbol: "ph", unit: "ph", precision: 5 }
  ],
  calculate: calculateIlluminanceUnits,
  formula: {
    primary: "1 lux = 0.0929 fc = 1 lm/m\xB2",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["photodiode-transimpedance", "optical-sensor-range", "energy-units"]
};

// src/lib/calculators/thermal/junction-temperature.ts
function calculateJunctionTemperature(inputs) {
  const { pd, ta, thetaJC, thetaCS, thetaSA } = inputs;
  if (pd < 0) {
    return { values: { thetaJA: 0, tj: 0, tc: 0, ts: 0, margin: 0 }, errors: ["Power dissipation must be non-negative"] };
  }
  const thetaJA = thetaJC + thetaCS + thetaSA;
  const tj = ta + pd * thetaJA;
  const tc = ta + pd * (thetaCS + thetaSA);
  const ts = ta + pd * thetaSA;
  const tjMax = 125;
  const margin = tjMax - tj;
  return {
    values: {
      thetaJA,
      tj,
      tc,
      ts,
      margin
    }
  };
}
var junctionTemperature = {
  slug: "junction-temperature",
  title: "Junction Temperature Calculator",
  shortTitle: "Junction Temperature",
  category: "thermal",
  description: "Calculate semiconductor junction temperature from power dissipation and thermal resistance chain (\u03B8JC + \u03B8CS + \u03B8SA). Essential for transistor, MOSFET, and IC thermal design.",
  keywords: [
    "junction temperature",
    "thermal resistance",
    "theta JA",
    "heatsink design",
    "power dissipation",
    "thermal management",
    "MOSFET junction temperature"
  ],
  inputs: [
    {
      key: "pd",
      label: "Power Dissipation",
      symbol: "P_D",
      unit: "W",
      defaultValue: 1,
      min: 0,
      tooltip: "Power dissipated in the device (Watts)"
    },
    {
      key: "ta",
      label: "Ambient Temperature",
      symbol: "T_A",
      unit: "\xB0C",
      defaultValue: 25,
      min: -55,
      max: 125,
      tooltip: "Ambient (surrounding air) temperature",
      presets: [
        { label: "25\xB0C (standard)", values: { ta: 25 } },
        { label: "40\xB0C (industrial)", values: { ta: 40 } },
        { label: "70\xB0C (harsh)", values: { ta: 70 } },
        { label: "85\xB0C (max industrial)", values: { ta: 85 } }
      ]
    },
    {
      key: "thetaJC",
      label: "\u03B8_JC (Junction-to-Case)",
      symbol: "\u03B8_JC",
      unit: "\xB0C/W",
      defaultValue: 5,
      min: 0,
      tooltip: "Junction-to-case thermal resistance from device datasheet"
    },
    {
      key: "thetaCS",
      label: "\u03B8_CS (Case-to-Heatsink)",
      symbol: "\u03B8_CS",
      unit: "\xB0C/W",
      defaultValue: 0.5,
      min: 0,
      tooltip: "Case-to-heatsink thermal resistance (thermal pad/paste). ~0.1\u20131.0 \xB0C/W typical.",
      presets: [
        { label: "Dry contact (~1.0)", values: { thetaCS: 1 } },
        { label: "Thermal paste (~0.5)", values: { thetaCS: 0.5 } },
        { label: "Thermal pad (~0.3)", values: { thetaCS: 0.3 } },
        { label: "Solder mount (~0.1)", values: { thetaCS: 0.1 } }
      ]
    },
    {
      key: "thetaSA",
      label: "\u03B8_SA (Heatsink-to-Ambient)",
      symbol: "\u03B8_SA",
      unit: "\xB0C/W",
      defaultValue: 10,
      min: 0,
      tooltip: "Heatsink-to-ambient thermal resistance. Lower = better heatsink. ~1\u201350 \xB0C/W typical.",
      presets: [
        { label: "No heatsink (~50)", values: { thetaSA: 50 } },
        { label: "Small heatsink (~20)", values: { thetaSA: 20 } },
        { label: "Medium heatsink (~10)", values: { thetaSA: 10 } },
        { label: "Large heatsink (~5)", values: { thetaSA: 5 } },
        { label: "Forced air (~2)", values: { thetaSA: 2 } }
      ]
    }
  ],
  outputs: [
    {
      key: "thetaJA",
      label: "\u03B8_JA (Total)",
      symbol: "\u03B8_JA",
      unit: "\xB0C/W",
      precision: 2,
      tooltip: "Total junction-to-ambient thermal resistance: \u03B8JA = \u03B8JC + \u03B8CS + \u03B8SA"
    },
    {
      key: "tj",
      label: "Junction Temperature",
      symbol: "T_J",
      unit: "\xB0C",
      precision: 1,
      tooltip: "Device junction temperature: TJ = TA + PD \xD7 \u03B8JA",
      thresholds: {
        good: { max: 100 },
        warning: { min: 100, max: 120 },
        danger: { max: 120 }
      }
    },
    {
      key: "tc",
      label: "Case Temperature",
      symbol: "T_C",
      unit: "\xB0C",
      precision: 1,
      tooltip: "Device case/package temperature"
    },
    {
      key: "ts",
      label: "Heatsink Temperature",
      symbol: "T_S",
      unit: "\xB0C",
      precision: 1,
      tooltip: "Heatsink temperature"
    },
    {
      key: "margin",
      label: "Thermal Margin",
      symbol: "\u0394T",
      unit: "\xB0C",
      precision: 1,
      tooltip: "Temperature margin below 125\xB0C maximum junction temperature. Positive = safe.",
      thresholds: {
        good: { min: 25 },
        warning: { min: 5, max: 25 },
        danger: { min: 5 }
      }
    }
  ],
  calculate: calculateJunctionTemperature,
  formula: {
    primary: "T_J = T_A + P_D \xD7 (\u03B8_JC + \u03B8_CS + \u03B8_SA)",
    latex: "T_J = T_A + P_D \\cdot (\\theta_{JC} + \\theta_{CS} + \\theta_{SA})",
    variables: [
      { symbol: "T_J", description: "Junction temperature", unit: "\xB0C" },
      { symbol: "T_A", description: "Ambient temperature", unit: "\xB0C" },
      { symbol: "P_D", description: "Power dissipation", unit: "W" },
      { symbol: "\u03B8_JC", description: "Junction-to-case thermal resistance", unit: "\xB0C/W" },
      { symbol: "\u03B8_CS", description: "Case-to-heatsink thermal resistance", unit: "\xB0C/W" },
      { symbol: "\u03B8_SA", description: "Heatsink-to-ambient thermal resistance", unit: "\xB0C/W" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["heatsink-selection", "heatsink-calculator", "thermal-resistance-network"]
};

// src/lib/calculators/thermal/heatsink-selection.ts
function calculateHeatsinkSelection(inputs) {
  const { pd, ta, tjMax, thetaJC, thetaCS } = inputs;
  if (pd <= 0) {
    return { values: { thetaSARequired: 0, tjActual: 0, deltaTJ: 0 }, errors: ["Power dissipation must be positive"] };
  }
  const thetaSARequired = (tjMax - ta) / pd - thetaJC - thetaCS;
  const thetaJA = thetaJC + thetaCS + Math.max(thetaSARequired, 0);
  const tjActual = ta + pd * thetaJA;
  const deltaTJ = tjMax - tjActual;
  return {
    values: {
      thetaSARequired,
      tjActual,
      deltaTJ
    },
    warnings: thetaSARequired <= 0 ? ["Required \u03B8SA is negative \u2014 this device cannot be cooled sufficiently by a heatsink with these parameters."] : void 0
  };
}
var heatsinkSelection = {
  slug: "heatsink-selection",
  title: "Heatsink Selection Calculator",
  shortTitle: "Heatsink Selection",
  category: "thermal",
  description: "Calculate the required heatsink thermal resistance (\u03B8SA) to keep a device junction below its maximum temperature. Use this to select an appropriate heatsink.",
  keywords: [
    "heatsink selection",
    "required thermal resistance",
    "theta SA",
    "heatsink design",
    "thermal resistance",
    "junction temperature",
    "thermal management"
  ],
  inputs: [
    {
      key: "pd",
      label: "Power Dissipation",
      symbol: "P_D",
      unit: "W",
      defaultValue: 5,
      min: 1e-3,
      tooltip: "Power dissipated in the device that must be removed"
    },
    {
      key: "ta",
      label: "Ambient Temperature",
      symbol: "T_A",
      unit: "\xB0C",
      defaultValue: 40,
      min: -55,
      max: 125,
      tooltip: "Maximum ambient (surrounding air) temperature"
    },
    {
      key: "tjMax",
      label: "Max Junction Temperature",
      symbol: "T_J(max)",
      unit: "\xB0C",
      defaultValue: 125,
      min: 50,
      max: 200,
      tooltip: "Maximum allowable junction temperature from device datasheet",
      presets: [
        { label: "125\xB0C (standard)", values: { tjMax: 125 } },
        { label: "150\xB0C (high-temp)", values: { tjMax: 150 } },
        { label: "100\xB0C (derated)", values: { tjMax: 100 } }
      ]
    },
    {
      key: "thetaJC",
      label: "\u03B8_JC (Junction-to-Case)",
      symbol: "\u03B8_JC",
      unit: "\xB0C/W",
      defaultValue: 3,
      min: 0,
      tooltip: "Junction-to-case thermal resistance from device datasheet"
    },
    {
      key: "thetaCS",
      label: "\u03B8_CS (Case-to-Heatsink)",
      symbol: "\u03B8_CS",
      unit: "\xB0C/W",
      defaultValue: 0.5,
      min: 0,
      tooltip: "Case-to-heatsink thermal resistance (thermal interface material)"
    }
  ],
  outputs: [
    {
      key: "thetaSARequired",
      label: "Required \u03B8_SA",
      symbol: "\u03B8_SA",
      unit: "\xB0C/W",
      precision: 2,
      tooltip: "Maximum heatsink-to-ambient thermal resistance required. Select a heatsink with \u03B8SA \u2264 this value.",
      thresholds: {
        good: { min: 5 },
        warning: { min: 1, max: 5 },
        danger: { min: 1 }
      }
    },
    {
      key: "tjActual",
      label: "Actual Junction Temp",
      symbol: "T_J",
      unit: "\xB0C",
      precision: 1,
      tooltip: "Junction temperature achieved with the exactly required heatsink"
    },
    {
      key: "deltaTJ",
      label: "Thermal Margin",
      symbol: "\u0394T_J",
      unit: "\xB0C",
      precision: 1,
      tooltip: "Temperature margin below maximum junction temperature"
    }
  ],
  calculate: calculateHeatsinkSelection,
  formula: {
    primary: "\u03B8_SA = (T_J(max) \u2212 T_A) / P_D \u2212 \u03B8_JC \u2212 \u03B8_CS",
    latex: "\\theta_{SA} = \\frac{T_{J(max)} - T_A}{P_D} - \\theta_{JC} - \\theta_{CS}",
    variables: [
      { symbol: "\u03B8_SA", description: "Required heatsink thermal resistance", unit: "\xB0C/W" },
      { symbol: "T_J(max)", description: "Maximum junction temperature", unit: "\xB0C" },
      { symbol: "T_A", description: "Ambient temperature", unit: "\xB0C" },
      { symbol: "P_D", description: "Power dissipation", unit: "W" },
      { symbol: "\u03B8_JC", description: "Junction-to-case thermal resistance", unit: "\xB0C/W" },
      { symbol: "\u03B8_CS", description: "Case-to-heatsink thermal resistance", unit: "\xB0C/W" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["junction-temperature", "heatsink-calculator", "thermal-resistance-network"]
};

// src/lib/calculators/thermal/thermal-via-array.ts
function calculateThermalViaArray(inputs) {
  const { numVias, viaDiameter, platingThickness, pcbThickness, copperThermal, drillFill } = inputs;
  if (numVias <= 0 || viaDiameter <= 0 || pcbThickness <= 0 || copperThermal <= 0) {
    return { values: { thetaPerVia: 0, thetaArray: 0, effectiveConductance: 0 }, errors: ["All dimensions must be positive"] };
  }
  const d_m = viaDiameter * 1e-3;
  const t_m = platingThickness * 1e-6;
  const L_m = pcbThickness * 1e-3;
  let A_m2;
  if (drillFill >= 0.999) {
    A_m2 = Math.PI * Math.pow(d_m / 2, 2);
  } else if (t_m > 0 && d_m / 2 > t_m) {
    const r_outer = d_m / 2;
    const r_inner = r_outer - t_m;
    const hollowArea = Math.PI * (r_outer * r_outer - r_inner * r_inner);
    const solidArea = Math.PI * Math.pow(d_m / 2, 2);
    A_m2 = hollowArea * (1 - drillFill) + solidArea * drillFill;
  } else {
    A_m2 = Math.PI * Math.pow(d_m / 2, 2);
  }
  const thetaPerVia = L_m / (copperThermal * A_m2);
  const thetaArray = thetaPerVia / numVias;
  const effectiveConductance = 1 / thetaArray;
  return {
    values: {
      thetaPerVia,
      thetaArray,
      effectiveConductance
    }
  };
}
var thermalViaArray = {
  slug: "thermal-via-array",
  title: "Thermal Via Array Calculator",
  shortTitle: "Thermal Via Array",
  category: "thermal",
  description: "Calculate thermal resistance of a PCB thermal via array for heat spreading from SMD packages to inner copper planes or heatsinks.",
  keywords: [
    "thermal via",
    "via array",
    "PCB thermal",
    "thermal resistance",
    "via thermal resistance",
    "heat spreading",
    "SMD thermal",
    "PCB heatsink"
  ],
  inputs: [
    {
      key: "numVias",
      label: "Number of Vias",
      symbol: "N",
      unit: "vias",
      defaultValue: 9,
      min: 1,
      max: 1e4,
      step: 1,
      tooltip: "Total number of thermal vias in the array",
      presets: [
        { label: "4 vias (2\xD72)", values: { numVias: 4 } },
        { label: "9 vias (3\xD73)", values: { numVias: 9 } },
        { label: "16 vias (4\xD74)", values: { numVias: 16 } },
        { label: "25 vias (5\xD75)", values: { numVias: 25 } }
      ]
    },
    {
      key: "viaDiameter",
      label: "Via Drill Diameter",
      symbol: "d",
      unit: "mm",
      defaultValue: 0.3,
      min: 0.05,
      max: 5,
      tooltip: "Via drill hole diameter. IPC-7093 recommends 0.2\u20130.4mm for thermal vias.",
      presets: [
        { label: "0.2mm (micro)", values: { viaDiameter: 0.2 } },
        { label: "0.3mm (small)", values: { viaDiameter: 0.3 } },
        { label: "0.5mm (standard)", values: { viaDiameter: 0.5 } }
      ]
    },
    {
      key: "platingThickness",
      label: "Copper Plating",
      symbol: "t",
      unit: "\u03BCm",
      defaultValue: 25,
      min: 1,
      max: 200,
      tooltip: "Via barrel copper plating thickness. Typical PCB: 18\u201335\u03BCm. Ignored if filled."
    },
    {
      key: "pcbThickness",
      label: "PCB Thickness",
      symbol: "L",
      unit: "mm",
      defaultValue: 1.6,
      min: 0.1,
      max: 10,
      tooltip: "PCB thickness (length of the via thermal path)",
      presets: [
        { label: "0.8mm", values: { pcbThickness: 0.8 } },
        { label: "1.6mm (standard)", values: { pcbThickness: 1.6 } },
        { label: "2.4mm", values: { pcbThickness: 2.4 } }
      ]
    },
    {
      key: "copperThermal",
      label: "Thermal Conductivity",
      symbol: "k",
      unit: "W/m\xB7K",
      defaultValue: 385,
      min: 1,
      tooltip: "Thermal conductivity of via fill material. Copper: 385, silver: 430, thermal epoxy: 1\u20135.",
      presets: [
        { label: "Copper (385 W/m\xB7K)", values: { copperThermal: 385 } },
        { label: "Silver (430 W/m\xB7K)", values: { copperThermal: 430 } },
        { label: "Thermal epoxy (4 W/m\xB7K)", values: { copperThermal: 4 } }
      ]
    },
    {
      key: "drillFill",
      label: "Fill Fraction",
      symbol: "f",
      unit: "",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 0.1,
      tooltip: "0 = hollow plated via, 1 = fully filled with copper. Filled vias offer best thermal performance.",
      presets: [
        { label: "Hollow plated (0)", values: { drillFill: 0 } },
        { label: "Solid copper fill (1)", values: { drillFill: 1 } }
      ]
    }
  ],
  outputs: [
    {
      key: "thetaPerVia",
      label: "Resistance Per Via",
      symbol: "\u03B8_via",
      unit: "\xB0C/W",
      precision: 2,
      tooltip: "Thermal resistance of a single via"
    },
    {
      key: "thetaArray",
      label: "Array Thermal Resistance",
      symbol: "\u03B8_array",
      unit: "\xB0C/W",
      precision: 3,
      tooltip: "Total thermal resistance of all vias in parallel: \u03B8_array = \u03B8_via / N"
    },
    {
      key: "effectiveConductance",
      label: "Effective Conductance",
      symbol: "G",
      unit: "W/\xB0C",
      precision: 3,
      tooltip: "Thermal conductance of the array (reciprocal of \u03B8_array)"
    }
  ],
  calculate: calculateThermalViaArray,
  formula: {
    primary: "\u03B8_via = L / (k \xB7 A),  \u03B8_array = \u03B8_via / N",
    latex: "\\theta_{via} = \\frac{L}{k \\cdot A}, \\quad \\theta_{array} = \\frac{\\theta_{via}}{N}",
    variables: [
      { symbol: "\u03B8", description: "Thermal resistance", unit: "\xB0C/W" },
      { symbol: "L", description: "PCB thickness (via length)", unit: "m" },
      { symbol: "k", description: "Thermal conductivity", unit: "W/m\xB7K" },
      { symbol: "A", description: "Via cross-sectional area", unit: "m\xB2" },
      { symbol: "N", description: "Number of vias", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["junction-temperature", "heatsink-selection", "via-thermal-resistance"]
};

// src/lib/calculators/signal/pll-loop-filter.ts
function calculatePllLoopFilter(inputs) {
  const { fRef, loopBW, phaseMargin, kvco, n, icp } = inputs;
  if (loopBW <= 0 || phaseMargin <= 0 || phaseMargin >= 90 || kvco <= 0 || n < 1 || icp <= 0) {
    return {
      values: { c1: 0, c2: 0, r1: 0, pmActual: 0, bwRatio: 0 },
      errors: ["All parameters must be positive; phase margin must be 0\u201390\xB0"]
    };
  }
  const wc = 2 * Math.PI * loopBW * 1e3;
  const phi = phaseMargin * Math.PI / 180;
  const Kvco_rads = kvco * 2 * Math.PI * 1e6;
  const Icp_A = icp * 1e-6;
  const tanPhi = Math.tan(phi);
  const bCoeff = 2 + 4 * tanPhi * tanPhi;
  const gDisc = bCoeff * bCoeff - 4;
  const gMax = gDisc > 0 ? (bCoeff - Math.sqrt(gDisc)) / 2 : 0.01;
  const gamma = Math.min(0.1, gMax * 0.8);
  const qa = gamma * tanPhi;
  const qb = -(1 - gamma);
  const qc = tanPhi;
  const qDisc = qb * qb - 4 * qa * qc;
  const x = qDisc >= 0 ? (-qb + Math.sqrt(qDisc)) / (2 * qa) : tanPhi;
  const T1 = x / wc;
  const T3 = gamma * T1;
  const magNum = Math.sqrt(1 + (wc * T1) ** 2);
  const magDen = Math.sqrt(1 + (wc * T3) ** 2);
  const C1_F = Icp_A * Kvco_rads / (2 * Math.PI * n * wc * wc) * (magNum / magDen);
  const R_Ohm = T1 / C1_F;
  const C2_F = gamma * C1_F;
  const c1 = C1_F * 1e9;
  const c2 = C2_F * 1e12;
  const r1 = R_Ohm / 1e3;
  const pmActual = (Math.atan(wc * T1) - Math.atan(wc * T3)) * 180 / Math.PI;
  const bwRatio = loopBW / fRef;
  return {
    values: { c1, c2, r1, pmActual, bwRatio },
    ...bwRatio > 0.1 ? { warnings: ["Loop BW > 1/10 of reference frequency \u2014 may cause excessive reference spurs"] } : {}
  };
}
var pllLoopFilter = {
  slug: "pll-loop-filter",
  title: "PLL Loop Filter Designer",
  shortTitle: "PLL Loop Filter",
  category: "signal",
  description: "Design a type-2 second-order PLL passive loop filter. Calculates time constants, capacitor and resistor values for target loop bandwidth and phase margin.",
  keywords: [
    "PLL loop filter",
    "phase locked loop",
    "loop filter design",
    "PLL bandwidth",
    "phase margin",
    "VCO filter",
    "PLL component values"
  ],
  inputs: [
    {
      key: "fRef",
      label: "Reference Frequency",
      symbol: "f_ref",
      unit: "kHz",
      defaultValue: 100,
      min: 1e-3,
      tooltip: "Reference (comparison) frequency at phase detector input"
    },
    {
      key: "loopBW",
      label: "Loop Bandwidth",
      symbol: "f_c",
      unit: "kHz",
      defaultValue: 5,
      min: 1e-3,
      tooltip: "Desired closed-loop bandwidth (crossover frequency). Typically 1/10 to 1/100 of reference frequency."
    },
    {
      key: "phaseMargin",
      label: "Phase Margin",
      symbol: "\u03C6",
      unit: "deg",
      defaultValue: 45,
      min: 10,
      max: 89,
      tooltip: "Desired phase margin for loop stability. 45\xB0 provides good transient response.",
      presets: [
        { label: "45\xB0 (standard)", values: { phaseMargin: 45 } },
        { label: "52\xB0 (optimal transient)", values: { phaseMargin: 52 } },
        { label: "60\xB0 (conservative)", values: { phaseMargin: 60 } }
      ]
    },
    {
      key: "kvco",
      label: "VCO Gain",
      symbol: "K_vco",
      unit: "MHz/V",
      defaultValue: 20,
      min: 1e-3,
      tooltip: "VCO frequency tuning gain (sensitivity). From VCO datasheet."
    },
    {
      key: "n",
      label: "Divider Ratio",
      symbol: "N",
      unit: "",
      defaultValue: 100,
      min: 1,
      tooltip: "Feedback divider ratio N. f_out = N \xD7 f_ref."
    },
    {
      key: "icp",
      label: "Charge Pump Current",
      symbol: "I_cp",
      unit: "\u03BCA",
      defaultValue: 500,
      min: 1,
      max: 1e4,
      tooltip: "Charge pump output current. From PLL IC datasheet.",
      presets: [
        { label: "100 \u03BCA", values: { icp: 100 } },
        { label: "500 \u03BCA", values: { icp: 500 } },
        { label: "5 mA", values: { icp: 5e3 } }
      ]
    }
  ],
  outputs: [
    {
      key: "c1",
      label: "C1 (primary capacitor)",
      symbol: "C\u2081",
      unit: "nF",
      precision: 3,
      tooltip: "Primary integrating capacitor. Determines loop gain."
    },
    {
      key: "r1",
      label: "R1 (zero resistor)",
      symbol: "R\u2081",
      unit: "k\u03A9",
      precision: 2,
      tooltip: "Resistor in series with C1. Sets the stabilizing zero."
    },
    {
      key: "c2",
      label: "C2 (pole capacitor)",
      symbol: "C\u2082",
      unit: "pF",
      precision: 1,
      tooltip: "Secondary capacitor (C2 = C1/10). Provides high-frequency spur filtering."
    },
    {
      key: "pmActual",
      label: "Actual Phase Margin",
      symbol: "PM",
      unit: "\xB0",
      precision: 1,
      tooltip: "Computed phase margin at the crossover frequency.",
      thresholds: {
        good: { min: 40 },
        warning: { min: 25 },
        danger: { min: 25 }
      }
    },
    {
      key: "bwRatio",
      label: "BW / f_ref Ratio",
      symbol: "f_c/f_ref",
      unit: "",
      precision: 3,
      tooltip: "Loop bandwidth to reference frequency ratio. Should be < 0.1 for low spurs.",
      thresholds: {
        good: { max: 0.1 },
        warning: { max: 0.2 },
        danger: { min: 0.2 }
      }
    }
  ],
  calculate: calculatePllLoopFilter,
  formula: {
    primary: "C\u2081 = (Icp\xB7Kvco)/(N\xB7\u03C9c\xB2) \xB7 |Z(j\u03C9c)|, R\u2081 = T\u2081/C\u2081, C\u2082 = C\u2081/10",
    latex: "C_1 = \\frac{I_{cp} K_{vco}}{N \\omega_c^2} \\cdot \\frac{\\sqrt{1+(\\omega_c T_1)^2}}{\\sqrt{1+(\\omega_c T_3)^2}}",
    variables: [
      { symbol: "\u03C9c", description: "Loop crossover frequency (2\u03C0 \xD7 f_BW)", unit: "rad/s" },
      { symbol: "T\u2081", description: "Zero time constant: tan(\u03C6)/\u03C9c", unit: "s" },
      { symbol: "Icp", description: "Charge pump current", unit: "A" },
      { symbol: "Kvco", description: "VCO gain", unit: "rad/s/V" },
      { symbol: "N", description: "Feedback divider ratio", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["filter-designer", "phase-noise-to-jitter", "snr-calculator"],
  exportComponents: (_inputs, outputs) => {
    const r1_ohm = (outputs?.r1 ?? 0) * 1e3;
    const c1_uf = (outputs?.c1 ?? 0) / 1e3;
    const c2_uf = (outputs?.c2 ?? 0) / 1e6;
    const fmtR = (ohm) => ohm >= 1e3 ? `${+(ohm / 1e3).toPrecision(3)} k\u03A9` : `${+ohm.toPrecision(3)} \u03A9`;
    const fmtC = (uf) => uf >= 1 ? `${+uf.toPrecision(3)} \u03BCF` : uf >= 1e-3 ? `${+(uf * 1e3).toPrecision(3)} nF` : `${+(uf * 1e6).toPrecision(3)} pF`;
    return [
      { qty: 1, description: "R1 (zero resistor)", value: fmtR(r1_ohm), package: "0402", componentType: "R", placement: "series" },
      { qty: 1, description: "C1 (integrator)", value: fmtC(c1_uf), package: "0402", componentType: "C", placement: "shunt" },
      { qty: 1, description: "C2 (pole)", value: fmtC(c2_uf), package: "0402", componentType: "C", placement: "shunt" }
    ];
  }
};

// src/lib/calculators/signal/ber-snr.ts
function erfc(x) {
  if (x < 0) return 2 - erfc(-x);
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * Math.exp(-x * x);
}
function calculateBerSnr(inputs) {
  const { ebN0dB, modulation } = inputs;
  const ebN0 = Math.pow(10, ebN0dB / 10);
  const modCode = Math.round(modulation);
  let ber;
  let bitsPerSymbol;
  switch (modCode) {
    case 1:
      ber = 0.5 * erfc(Math.sqrt(ebN0));
      bitsPerSymbol = 1;
      break;
    case 2:
      ber = 0.5 * erfc(Math.sqrt(ebN0));
      bitsPerSymbol = 2;
      break;
    case 3:
      {
        const sinPi8 = Math.sin(Math.PI / 8);
        ber = 1 / 3 * erfc(Math.sqrt(ebN0 * 3 * sinPi8 * sinPi8));
        bitsPerSymbol = 3;
      }
      break;
    case 4:
      ber = 0.375 * erfc(Math.sqrt(ebN0 * 2 / 5));
      bitsPerSymbol = 4;
      break;
    default:
      ber = 0.5 * erfc(Math.sqrt(ebN0));
      bitsPerSymbol = 1;
  }
  const berClamped = Math.max(ber, 1e-12);
  const berLog10 = Math.log10(berClamped);
  return {
    values: {
      ber: berClamped,
      berLog10,
      bitsPerSymbol
    }
  };
}
var berSnr = {
  slug: "ber-snr",
  title: "Bit Error Rate (BER) Calculator",
  shortTitle: "BER vs Eb/N0",
  category: "signal",
  description: "Calculate bit error rate (BER) from Eb/N0 for BPSK, QPSK, 8PSK, and 16QAM digital modulations. Essential for digital communications system design.",
  keywords: [
    "bit error rate",
    "BER calculator",
    "Eb/N0",
    "BPSK BER",
    "QPSK BER",
    "16QAM BER",
    "digital modulation",
    "SNR BER",
    "communications performance"
  ],
  inputs: [
    {
      key: "ebN0dB",
      label: "Eb/N0",
      symbol: "Eb/N0",
      unit: "dB",
      defaultValue: 10,
      min: -5,
      max: 30,
      tooltip: "Energy per bit to noise density ratio. The fundamental SNR metric for digital communications.",
      presets: [
        { label: "0 dB", values: { ebN0dB: 0 } },
        { label: "5 dB", values: { ebN0dB: 5 } },
        { label: "10 dB", values: { ebN0dB: 10 } },
        { label: "15 dB", values: { ebN0dB: 15 } },
        { label: "20 dB", values: { ebN0dB: 20 } }
      ]
    },
    {
      key: "modulation",
      label: "Modulation",
      symbol: "mod",
      unit: "",
      defaultValue: 1,
      min: 1,
      max: 4,
      step: 1,
      tooltip: "Modulation type: 1=BPSK, 2=QPSK, 3=8PSK, 4=16QAM",
      presets: [
        { label: "BPSK (1)", values: { modulation: 1 } },
        { label: "QPSK (2)", values: { modulation: 2 } },
        { label: "8PSK (3)", values: { modulation: 3 } },
        { label: "16QAM (4)", values: { modulation: 4 } }
      ]
    }
  ],
  outputs: [
    {
      key: "ber",
      label: "Bit Error Rate",
      symbol: "BER",
      unit: "",
      precision: 3,
      format: "scientific",
      tooltip: "Bit error rate (probability of bit error)",
      thresholds: {
        good: { max: 1e-6 },
        warning: { min: 1e-6, max: 1e-3 },
        danger: { min: 1e-3 }
      }
    },
    {
      key: "berLog10",
      label: "BER (log\u2081\u2080)",
      symbol: "log\u2081\u2080(BER)",
      unit: "",
      precision: 2,
      tooltip: "Log base-10 of BER. e.g. \u22126 means BER = 10\u207B\u2076"
    },
    {
      key: "bitsPerSymbol",
      label: "Bits per Symbol",
      symbol: "k",
      unit: "bits/symbol",
      precision: 0,
      tooltip: "Number of bits per modulation symbol"
    }
  ],
  calculate: calculateBerSnr,
  formula: {
    primary: "BER = \xBD \xB7 erfc(\u221A(Eb/N0))  [BPSK/QPSK]",
    latex: "BER = \\frac{1}{2} \\text{erfc}\\left(\\sqrt{E_b/N_0}\\right)",
    variables: [
      { symbol: "BER", description: "Bit error rate", unit: "" },
      { symbol: "Eb/N0", description: "Energy per bit to noise density", unit: "dB" },
      { symbol: "erfc", description: "Complementary error function", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["snr-calculator", "quantization-noise", "adc-snr"]
};

// src/lib/calculators/signal/quantization-noise.ts
function calculateQuantizationNoise(inputs) {
  const { bits, vref, sampleRate } = inputs;
  if (bits < 1 || vref <= 0 || sampleRate <= 0) {
    return {
      values: { lsb: 0, sqnr: 0, enob: 0, dynamicRange: 0, noiseDensity: 0 },
      errors: ["Bits must be \u22651, Vref and sample rate must be positive"]
    };
  }
  const lsb_V = vref / Math.pow(2, bits);
  const lsb = lsb_V * 1e3;
  const sqnr = 6.02 * bits + 1.76;
  const enob = bits;
  const dynamicRange = 20 * Math.log10(Math.pow(2, bits));
  const qNoise_V = lsb_V / Math.sqrt(12);
  const bw_Hz = sampleRate * 1e3 / 2;
  const noiseDensity = qNoise_V / Math.sqrt(bw_Hz) * 1e9;
  return {
    values: {
      lsb,
      sqnr,
      enob,
      dynamicRange,
      noiseDensity
    }
  };
}
var quantizationNoise = {
  slug: "quantization-noise",
  title: "ADC Quantization Noise Calculator",
  shortTitle: "Quantization Noise",
  category: "signal",
  description: "Calculate ADC quantization noise, theoretical SQNR, ENOB, dynamic range, and noise spectral density for analog-to-digital converter design.",
  keywords: [
    "quantization noise",
    "ADC SNR",
    "SQNR",
    "ENOB",
    "dynamic range",
    "ADC resolution",
    "LSB size",
    "noise density"
  ],
  inputs: [
    {
      key: "bits",
      label: "ADC Resolution",
      symbol: "N",
      unit: "bits",
      defaultValue: 12,
      min: 1,
      max: 24,
      step: 1,
      tooltip: "ADC resolution in bits",
      presets: [
        { label: "8-bit", values: { bits: 8 } },
        { label: "10-bit", values: { bits: 10 } },
        { label: "12-bit", values: { bits: 12 } },
        { label: "16-bit", values: { bits: 16 } },
        { label: "24-bit", values: { bits: 24 } }
      ]
    },
    {
      key: "vref",
      label: "Reference Voltage",
      symbol: "V_ref",
      unit: "V",
      defaultValue: 3.3,
      min: 1e-3,
      tooltip: "ADC full-scale reference voltage",
      presets: [
        { label: "1.8V", values: { vref: 1.8 } },
        { label: "2.5V", values: { vref: 2.5 } },
        { label: "3.3V", values: { vref: 3.3 } },
        { label: "5.0V", values: { vref: 5 } }
      ]
    },
    {
      key: "frequency",
      label: "Input Frequency",
      symbol: "f_in",
      unit: "kHz",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Input signal frequency (used for reference only)"
    },
    {
      key: "sampleRate",
      label: "Sample Rate",
      symbol: "f_s",
      unit: "kHz",
      defaultValue: 100,
      min: 1e-3,
      tooltip: "ADC sample rate. Nyquist bandwidth = sample rate / 2.",
      presets: [
        { label: "8 kSPS (audio)", values: { sampleRate: 8 } },
        { label: "44.1 kSPS (CD audio)", values: { sampleRate: 44.1 } },
        { label: "100 kSPS", values: { sampleRate: 100 } },
        { label: "1 MSPS", values: { sampleRate: 1e3 } }
      ]
    }
  ],
  outputs: [
    {
      key: "lsb",
      label: "LSB Size",
      symbol: "LSB",
      unit: "mV",
      precision: 4,
      tooltip: "Least significant bit voltage: Vref / 2^N"
    },
    {
      key: "sqnr",
      label: "Theoretical SQNR",
      symbol: "SQNR",
      unit: "dB",
      precision: 2,
      tooltip: "Signal-to-quantization-noise ratio: 6.02N + 1.76 dB"
    },
    {
      key: "enob",
      label: "ENOB (theoretical)",
      symbol: "ENOB",
      unit: "bits",
      precision: 1,
      tooltip: "Effective number of bits (equals N for ideal ADC)"
    },
    {
      key: "dynamicRange",
      label: "Dynamic Range",
      symbol: "DR",
      unit: "dB",
      precision: 2,
      tooltip: "Ideal dynamic range: 20\xB7log\u2081\u2080(2^N)"
    },
    {
      key: "noiseDensity",
      label: "Noise Density",
      symbol: "e_n",
      unit: "nV/\u221AHz",
      precision: 2,
      tooltip: "Quantization noise spectral density referred to ADC input"
    }
  ],
  calculate: calculateQuantizationNoise,
  formula: {
    primary: "SQNR = 6.02\xB7N + 1.76 dB,  LSB = Vref / 2^N",
    latex: "SQNR = 6.02N + 1.76 \\text{ dB}, \\quad LSB = \\frac{V_{ref}}{2^N}",
    variables: [
      { symbol: "N", description: "ADC resolution", unit: "bits" },
      { symbol: "SQNR", description: "Signal-to-quantization-noise ratio", unit: "dB" },
      { symbol: "LSB", description: "Least significant bit voltage", unit: "V" },
      { symbol: "V_ref", description: "ADC reference voltage", unit: "V" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["adc-snr", "ber-snr", "snr-calculator"]
};

// src/lib/calculators/rf/fresnel-zone.ts
function calculateFresnelZone(inputs) {
  const { frequency, distance, n } = inputs;
  if (frequency <= 0 || distance <= 0 || n < 1) {
    return { values: { radiusM: 0, clearanceM: 0, wavelengthM: 0 }, errors: ["Frequency, distance, and zone number must be positive"] };
  }
  const c = 3e8;
  const f_Hz = frequency * 1e9;
  const d_m = distance * 1e3;
  const wavelengthM = c / f_Hz;
  const d1 = d_m / 2;
  const d2 = d_m / 2;
  const radiusM = Math.sqrt(n * wavelengthM * d1 * d2 / (d1 + d2));
  const r1 = Math.sqrt(wavelengthM * d1 * d2 / (d1 + d2));
  const clearanceM = 0.6 * r1;
  return {
    values: {
      radiusM,
      clearanceM,
      wavelengthM
    }
  };
}
var fresnelZone = {
  slug: "fresnel-zone",
  title: "Fresnel Zone Calculator",
  shortTitle: "Fresnel Zone",
  category: "rf",
  description: "Calculate Fresnel zone radius at the midpoint of an RF line-of-sight link. Determine required clearance above obstructions for reliable microwave and WiFi links.",
  keywords: [
    "Fresnel zone",
    "line of sight",
    "RF link clearance",
    "microwave link",
    "path clearance",
    "Fresnel radius",
    "LOS link",
    "point to point link"
  ],
  inputs: [
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "GHz",
      defaultValue: 5.8,
      min: 1e-3,
      tooltip: "Link operating frequency in GHz",
      presets: [
        { label: "900 MHz", values: { frequency: 0.9 } },
        { label: "2.4 GHz", values: { frequency: 2.4 } },
        { label: "5.8 GHz", values: { frequency: 5.8 } },
        { label: "24 GHz", values: { frequency: 24 } },
        { label: "60 GHz", values: { frequency: 60 } }
      ]
    },
    {
      key: "distance",
      label: "Link Distance",
      symbol: "d",
      unit: "km",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Total distance between the two endpoints of the link"
    },
    {
      key: "n",
      label: "Fresnel Zone Number",
      symbol: "n",
      unit: "",
      defaultValue: 1,
      min: 1,
      max: 5,
      step: 1,
      tooltip: "Fresnel zone number (1 = first Fresnel zone, most important for link design)"
    }
  ],
  outputs: [
    {
      key: "radiusM",
      label: "Zone Radius at Midpoint",
      symbol: "r_n",
      unit: "m",
      precision: 2,
      tooltip: "Radius of the nth Fresnel zone at the link midpoint"
    },
    {
      key: "clearanceM",
      label: "Recommended Clearance",
      symbol: "h_min",
      unit: "m",
      precision: 2,
      tooltip: "Minimum clearance above obstructions (60% of first Fresnel zone) for reliable link"
    },
    {
      key: "wavelengthM",
      label: "Wavelength",
      symbol: "\u03BB",
      unit: "m",
      precision: 4,
      tooltip: "Free-space wavelength at the operating frequency"
    }
  ],
  calculate: calculateFresnelZone,
  formula: {
    primary: "r_n = \u221A(n\xB7\u03BB\xB7d\u2081\xB7d\u2082/(d\u2081+d\u2082))  at midpoint d\u2081=d\u2082=d/2",
    latex: "r_n = \\sqrt{\\frac{n \\lambda d_1 d_2}{d_1 + d_2}}",
    variables: [
      { symbol: "r_n", description: "nth Fresnel zone radius", unit: "m" },
      { symbol: "n", description: "Zone number", unit: "" },
      { symbol: "\u03BB", description: "Wavelength", unit: "m" },
      { symbol: "d1, d2", description: "Distances from endpoints to midpoint", unit: "m" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["free-space-path-loss", "rf-link-budget", "link-margin"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ]
};

// src/lib/calculators/rf/power-density.ts
function calculatePowerDensity(inputs) {
  const { eirp, distance } = inputs;
  if (distance <= 0) {
    return { values: { powerDensity: 0, efield: 0, hfield: 0, planeWaveImpedance: 0 }, errors: ["Distance must be positive"] };
  }
  const eirp_W = Math.pow(10, (eirp - 30) / 10);
  const S_Wm2 = eirp_W / (4 * Math.PI * distance * distance);
  const powerDensity2 = S_Wm2 * 1e3;
  const planeWaveImpedance = 120 * Math.PI;
  const efield = Math.sqrt(S_Wm2 * planeWaveImpedance);
  const hfield = efield / planeWaveImpedance * 1e3;
  return {
    values: {
      powerDensity: powerDensity2,
      efield,
      hfield,
      planeWaveImpedance
    }
  };
}
var powerDensity = {
  slug: "power-density",
  title: "RF Power Density Calculator",
  shortTitle: "RF Power Density",
  category: "rf",
  description: "Calculate RF power density (W/m\xB2), electric field strength (V/m), and magnetic field strength (A/m) from EIRP and distance. Useful for EMF exposure and safety analysis.",
  keywords: [
    "power density",
    "electric field strength",
    "RF exposure",
    "EIRP",
    "EMF safety",
    "SAR",
    "far field",
    "RF field strength"
  ],
  inputs: [
    {
      key: "eirp",
      label: "EIRP",
      symbol: "EIRP",
      unit: "dBm",
      defaultValue: 30,
      min: -30,
      max: 80,
      tooltip: "Equivalent Isotropically Radiated Power (transmitter power + antenna gain)",
      presets: [
        { label: "WiFi 100mW (20 dBm)", values: { eirp: 20 } },
        { label: "WiFi 1W (30 dBm)", values: { eirp: 30 } },
        { label: "LTE base station (46 dBm)", values: { eirp: 46 } },
        { label: "Radar (70 dBm)", values: { eirp: 70 } }
      ]
    },
    {
      key: "distance",
      label: "Distance",
      symbol: "d",
      unit: "m",
      defaultValue: 10,
      min: 0.01,
      tooltip: "Distance from the antenna to observation point (far field assumed)"
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "GHz",
      defaultValue: 2.4,
      min: 1e-3,
      tooltip: "Operating frequency (used for reference, does not affect far-field power density)"
    }
  ],
  outputs: [
    {
      key: "powerDensity",
      label: "Power Density",
      symbol: "S",
      unit: "mW/m\xB2",
      precision: 3,
      tooltip: "RF power density at given distance: S = EIRP / (4\u03C0\xB7d\xB2)",
      thresholds: {
        good: { max: 1e3 },
        warning: { min: 1e3, max: 1e4 },
        danger: { max: 1e4 }
      }
    },
    {
      key: "efield",
      label: "Electric Field Strength",
      symbol: "E",
      unit: "V/m",
      precision: 3,
      tooltip: "Far-field electric field strength: E = \u221A(S \xD7 120\u03C0)"
    },
    {
      key: "hfield",
      label: "Magnetic Field Strength",
      symbol: "H",
      unit: "mA/m",
      precision: 3,
      tooltip: "Far-field magnetic field strength: H = E / (120\u03C0)"
    },
    {
      key: "planeWaveImpedance",
      label: "Plane Wave Impedance",
      symbol: "\u03B7",
      unit: "\u03A9",
      precision: 1,
      tooltip: "Free-space plane wave impedance \u03B7 = 120\u03C0 \u2248 377\u03A9"
    }
  ],
  calculate: calculatePowerDensity,
  formula: {
    primary: "S = EIRP / (4\u03C0\xB7d\xB2),  E = \u221A(S\xB7\u03B7),  \u03B7 = 120\u03C0 \u2248 377\u03A9",
    latex: "S = \\frac{EIRP}{4\\pi d^2}, \\quad E = \\sqrt{S \\cdot \\eta}",
    variables: [
      { symbol: "S", description: "Power density", unit: "W/m\xB2" },
      { symbol: "EIRP", description: "Equivalent isotropically radiated power", unit: "W" },
      { symbol: "d", description: "Distance from antenna", unit: "m" },
      { symbol: "E", description: "Electric field strength", unit: "V/m" },
      { symbol: "\u03B7", description: "Free-space wave impedance (~377\u03A9)", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["free-space-path-loss", "eirp-calculator", "rf-link-budget"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ]
};

// src/lib/calculators/rf/balun-transformer.ts
function calculateBalunTransformer(inputs) {
  const { zSource, zLoad } = inputs;
  if (zSource <= 0 || zLoad <= 0) {
    return { values: { turnsRatio: 0, impedanceRatio: 0, insertionLoss: 0, vswr: 0 }, errors: ["Source and load impedances must be positive"] };
  }
  const turnsRatio = Math.sqrt(zLoad / zSource);
  const impedanceRatio = zLoad / zSource;
  const vswr = 1;
  const insertionLoss = 0.3;
  return {
    values: {
      turnsRatio,
      impedanceRatio,
      insertionLoss,
      vswr
    }
  };
}
var balunTransformer = {
  slug: "balun-transformer",
  title: "Balun & RF Transformer Calculator",
  shortTitle: "Balun Transformer",
  category: "rf",
  description: "Calculate balun and RF transformer turns ratio, impedance transformation ratio, and insertion loss for balanced/unbalanced feed line matching.",
  keywords: [
    "balun",
    "RF transformer",
    "impedance transformation",
    "turns ratio",
    "balanced unbalanced",
    "impedance matching",
    "transmission line transformer"
  ],
  inputs: [
    {
      key: "zSource",
      label: "Source Impedance",
      symbol: "Z_S",
      unit: "\u03A9",
      defaultValue: 50,
      min: 0.1,
      tooltip: "Source (transmitter/feedline) impedance",
      presets: [
        { label: "50\u03A9 (coax)", values: { zSource: 50 } },
        { label: "75\u03A9 (TV coax)", values: { zSource: 75 } },
        { label: "300\u03A9 (twin-lead)", values: { zSource: 300 } }
      ]
    },
    {
      key: "zLoad",
      label: "Load Impedance",
      symbol: "Z_L",
      unit: "\u03A9",
      defaultValue: 200,
      min: 0.1,
      tooltip: "Load (antenna/device) impedance to transform to",
      presets: [
        { label: "50\u03A9", values: { zLoad: 50 } },
        { label: "75\u03A9", values: { zLoad: 75 } },
        { label: "200\u03A9 (folded dipole)", values: { zLoad: 200 } },
        { label: "300\u03A9 (folded dipole)", values: { zLoad: 300 } },
        { label: "450\u03A9 (open-wire)", values: { zLoad: 450 } }
      ]
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 100,
      min: 1e-3,
      tooltip: "Operating frequency (for reference)"
    },
    {
      key: "bandwidth",
      label: "Bandwidth",
      symbol: "BW",
      unit: "MHz",
      defaultValue: 10,
      min: 1e-3,
      tooltip: "Operating bandwidth (for reference)"
    }
  ],
  outputs: [
    {
      key: "turnsRatio",
      label: "Turns Ratio (N)",
      symbol: "N",
      unit: ":1",
      precision: 3,
      tooltip: "Transformer turns ratio N = \u221A(ZL/ZS). Wind N turns on secondary for 1 turn on primary (or vice versa)."
    },
    {
      key: "impedanceRatio",
      label: "Impedance Ratio",
      symbol: "ZL/ZS",
      unit: ":1",
      precision: 2,
      tooltip: "Impedance transformation ratio ZL/ZS = N\xB2"
    },
    {
      key: "insertionLoss",
      label: "Typical Insertion Loss",
      symbol: "IL",
      unit: "dB",
      precision: 1,
      tooltip: "Typical insertion loss for ferrite core transformer (~0.3 dB). Ideal = 0 dB."
    },
    {
      key: "vswr",
      label: "VSWR (ideal)",
      symbol: "VSWR",
      unit: ":1",
      precision: 2,
      tooltip: "VSWR = 1:1 for ideal impedance-matched transformer"
    }
  ],
  calculate: calculateBalunTransformer,
  formula: {
    primary: "N = \u221A(Z_L / Z_S)",
    latex: "N = \\sqrt{\\frac{Z_L}{Z_S}}",
    variables: [
      { symbol: "N", description: "Turns ratio (secondary:primary)", unit: "" },
      { symbol: "Z_L", description: "Load impedance", unit: "\u03A9" },
      { symbol: "Z_S", description: "Source impedance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["vswr-return-loss", "rf-link-budget", "microstrip-impedance"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ]
};

// src/lib/calculators/rf/link-margin.ts
function calculateLinkMargin(inputs) {
  const { txPower, txGain, rxGain, distance, frequency, sensitivity, cableLoss } = inputs;
  if (distance <= 0 || frequency <= 0) {
    return { values: { fspl: 0, receivedPower: 0, linkMargin: 0, maxRange: 0 }, errors: ["Distance and frequency must be positive"] };
  }
  const c = 3e8;
  const d_m = distance * 1e3;
  const f_Hz = frequency * 1e9;
  const fspl = 20 * Math.log10(d_m) + 20 * Math.log10(f_Hz) + 20 * Math.log10(4 * Math.PI / c);
  const receivedPower = txPower + txGain + rxGain - fspl - cableLoss;
  const linkMargin2 = receivedPower - sensitivity;
  const maxRange = distance * Math.pow(10, linkMargin2 / 20);
  return {
    values: {
      fspl,
      receivedPower,
      linkMargin: linkMargin2,
      maxRange
    }
  };
}
var linkMargin = {
  slug: "link-margin",
  title: "RF Link Margin Calculator",
  shortTitle: "Link Margin",
  category: "rf",
  description: "Calculate RF link margin from TX power, antenna gains, free-space path loss, and receiver sensitivity. Determines maximum range and fade margin for wireless links.",
  keywords: [
    "link margin",
    "RF link budget",
    "free space path loss",
    "fade margin",
    "receiver sensitivity",
    "wireless range",
    "link budget"
  ],
  inputs: [
    {
      key: "txPower",
      label: "TX Power",
      symbol: "P_TX",
      unit: "dBm",
      defaultValue: 20,
      min: -30,
      max: 60,
      tooltip: "Transmitter output power",
      presets: [
        { label: "0 dBm (1mW)", values: { txPower: 0 } },
        { label: "10 dBm (10mW)", values: { txPower: 10 } },
        { label: "20 dBm (100mW)", values: { txPower: 20 } },
        { label: "30 dBm (1W)", values: { txPower: 30 } },
        { label: "43 dBm (20W)", values: { txPower: 43 } }
      ]
    },
    {
      key: "txGain",
      label: "TX Antenna Gain",
      symbol: "G_TX",
      unit: "dBi",
      defaultValue: 3,
      min: -10,
      max: 50,
      tooltip: "Transmit antenna gain in dBi"
    },
    {
      key: "rxGain",
      label: "RX Antenna Gain",
      symbol: "G_RX",
      unit: "dBi",
      defaultValue: 3,
      min: -10,
      max: 50,
      tooltip: "Receive antenna gain in dBi"
    },
    {
      key: "distance",
      label: "Link Distance",
      symbol: "d",
      unit: "km",
      defaultValue: 1,
      min: 1e-3,
      tooltip: "Distance between transmitter and receiver"
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "GHz",
      defaultValue: 2.4,
      min: 1e-3,
      tooltip: "Operating frequency in GHz",
      presets: [
        { label: "433 MHz", values: { frequency: 0.433 } },
        { label: "915 MHz", values: { frequency: 0.915 } },
        { label: "2.4 GHz", values: { frequency: 2.4 } },
        { label: "5.8 GHz", values: { frequency: 5.8 } }
      ]
    },
    {
      key: "sensitivity",
      label: "RX Sensitivity",
      symbol: "P_sens",
      unit: "dBm",
      defaultValue: -90,
      min: -150,
      max: 0,
      tooltip: "Receiver minimum sensitivity from datasheet"
    },
    {
      key: "cableLoss",
      label: "Cable/Connector Loss",
      symbol: "L_cable",
      unit: "dB",
      defaultValue: 1,
      min: 0,
      tooltip: "Total cable and connector losses on TX and RX sides combined"
    }
  ],
  outputs: [
    {
      key: "fspl",
      label: "Free-Space Path Loss",
      symbol: "FSPL",
      unit: "dB",
      precision: 2,
      tooltip: "Free-space path loss at specified frequency and distance"
    },
    {
      key: "receivedPower",
      label: "Received Power",
      symbol: "P_RX",
      unit: "dBm",
      precision: 2,
      tooltip: "Received signal power level at receiver input"
    },
    {
      key: "linkMargin",
      label: "Link Margin",
      symbol: "M",
      unit: "dB",
      precision: 2,
      tooltip: "Margin above receiver sensitivity. Positive = link will work. >10 dB recommended.",
      thresholds: {
        good: { min: 10 },
        warning: { min: 0, max: 10 },
        danger: { min: 0 }
      }
    },
    {
      key: "maxRange",
      label: "Maximum Range",
      symbol: "d_max",
      unit: "km",
      precision: 3,
      tooltip: "Maximum range where link still has positive margin"
    }
  ],
  calculate: calculateLinkMargin,
  formula: {
    primary: "M = P_TX + G_TX + G_RX \u2212 FSPL \u2212 L_cable \u2212 P_sens",
    latex: "M = P_{TX} + G_{TX} + G_{RX} - FSPL - L_{cable} - P_{sens}",
    variables: [
      { symbol: "M", description: "Link margin", unit: "dB" },
      { symbol: "FSPL", description: "20\xB7log\u2081\u2080(4\u03C0df/c)", unit: "dB" },
      { symbol: "P_TX", description: "Transmit power", unit: "dBm" },
      { symbol: "G_TX, G_RX", description: "Antenna gains", unit: "dBi" },
      { symbol: "P_sens", description: "Receiver sensitivity", unit: "dBm" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["free-space-path-loss", "rf-link-budget", "fresnel-zone"],
  liveWidgets: [
    { type: "space-weather", position: "above-outputs" },
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ]
};

// src/lib/calculators/rf/mixer-spur-calculator.ts
function calculateMixerSpurs(inputs) {
  const { rfFreq, loFreq, maxOrder } = inputs;
  const ifLow = Math.abs(loFreq - rfFreq);
  const ifHigh = loFreq + rfFreq;
  const im3Low = Math.abs(2 * loFreq - rfFreq);
  const im3High = 2 * loFreq + rfFreq;
  const im3RfLow = Math.abs(loFreq - 2 * rfFreq);
  const im3RfHigh = loFreq + 2 * rfFreq;
  const ifCenter = ifLow;
  let totalSpurs = 0;
  let spursNearIf = 0;
  const nearThreshold = 0.1 * ifCenter;
  for (let m = 0; m <= maxOrder; m++) {
    for (let n = 0; n <= maxOrder - m; n++) {
      if (m === 0 && n === 0) continue;
      const fPlus = m * loFreq + n * rfFreq;
      if (fPlus > 0) {
        totalSpurs++;
        if (Math.abs(fPlus - ifCenter) <= nearThreshold) {
          spursNearIf++;
        }
      }
      if (n > 0) {
        const fMinus = Math.abs(m * loFreq - n * rfFreq);
        if (fMinus > 0) {
          totalSpurs++;
          if (Math.abs(fMinus - ifCenter) <= nearThreshold) {
            if (!(m === 1 && n === 1)) {
              spursNearIf++;
            }
          }
        }
      }
    }
  }
  return {
    values: {
      ifLow,
      ifHigh,
      im3Low,
      im3High,
      im3RfLow,
      im3RfHigh,
      totalSpurs,
      spursNearIf
    }
  };
}
var mixerSpurCalculator = {
  slug: "mixer-spur-calculator",
  title: "Mixer Spur Calculator",
  shortTitle: "Mixer Spurs",
  category: "rf",
  description: "Calculate mixer spurious products (m\xD7fLO \xB1 n\xD7fRF) for superheterodyne receiver design. Identify problematic spurs near the IF passband and optimize LO/IF frequency planning.",
  keywords: [
    "mixer spur",
    "spurious products",
    "superheterodyne",
    "image frequency",
    "spur chart",
    "IF planning",
    "LO harmonics",
    "intermodulation",
    "receiver design",
    "frequency planning"
  ],
  inputs: [
    {
      key: "rfFreq",
      label: "RF Frequency",
      symbol: "fRF",
      unit: "MHz",
      defaultValue: 915,
      tooltip: "Input RF signal frequency in MHz",
      presets: [
        { label: "433 MHz ISM", values: { rfFreq: 433, loFreq: 443.95 } },
        { label: "915 MHz ISM", values: { rfFreq: 915, loFreq: 1e3 } },
        { label: "2.4 GHz ISM", values: { rfFreq: 2400, loFreq: 2870 } },
        { label: "5.8 GHz ISM", values: { rfFreq: 5800, loFreq: 6270 } }
      ]
    },
    {
      key: "loFreq",
      label: "LO Frequency",
      symbol: "fLO",
      unit: "MHz",
      defaultValue: 1e3,
      tooltip: "Local oscillator frequency in MHz"
    },
    {
      key: "maxOrder",
      label: "Maximum Spur Order",
      symbol: "N",
      unit: "",
      defaultValue: 5,
      tooltip: "Maximum harmonic order (m+n) to analyze (2-7)"
    }
  ],
  outputs: [
    {
      key: "ifLow",
      label: "IF Low (|fLO \u2212 fRF|)",
      symbol: "fIF",
      unit: "MHz",
      precision: 3
    },
    {
      key: "ifHigh",
      label: "IF High (fLO + fRF)",
      symbol: "fIF+",
      unit: "MHz",
      precision: 3
    },
    {
      key: "im3Low",
      label: "2\xD7LO \u2212 RF",
      symbol: "f3a",
      unit: "MHz",
      precision: 3
    },
    {
      key: "im3High",
      label: "2\xD7LO + RF",
      symbol: "f3b",
      unit: "MHz",
      precision: 3
    },
    {
      key: "im3RfLow",
      label: "LO \u2212 2\xD7RF",
      symbol: "f3c",
      unit: "MHz",
      precision: 3
    },
    {
      key: "im3RfHigh",
      label: "LO + 2\xD7RF",
      symbol: "f3d",
      unit: "MHz",
      precision: 3
    },
    {
      key: "totalSpurs",
      label: "Total Spur Products",
      symbol: "Ntot",
      unit: "",
      precision: 0
    },
    {
      key: "spursNearIf",
      label: "Spurs Near IF (\xB110%)",
      symbol: "Nnear",
      unit: "",
      precision: 0,
      thresholds: {
        good: { max: 1 },
        warning: { min: 1, max: 4 },
        danger: { max: 4 }
      }
    }
  ],
  calculate: calculateMixerSpurs,
  formula: {
    primary: "f_spur = m\xB7fLO \xB1 n\xB7fRF, m+n \u2264 N",
    latex: "f_{spur} = m \\cdot f_{LO} \\pm n \\cdot f_{RF}, \\quad m+n \\leq N",
    variables: [
      { symbol: "fRF", description: "RF input frequency", unit: "MHz" },
      { symbol: "fLO", description: "Local oscillator frequency", unit: "MHz" },
      { symbol: "m", description: "LO harmonic order", unit: "" },
      { symbol: "n", description: "RF harmonic order", unit: "" },
      { symbol: "N", description: "Maximum spur order (m+n)", unit: "" },
      { symbol: "fIF", description: "Intermediate frequency", unit: "MHz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["intermodulation-distortion", "noise-figure-cascade", "rf-link-budget"],
  liveWidgets: [
    { type: "spur-chart", position: "below-outputs", props: {} },
    { type: "space-weather", position: "below-outputs" }
  ]
};

// src/lib/calculators/general/schmitt-trigger.ts
function calculateSchmittTrigger(inputs) {
  const { vcc, r1, r2, r3 } = inputs;
  if (vcc <= 0) {
    return { values: {}, errors: ["Vcc must be positive"] };
  }
  if (r1 <= 0 || r2 <= 0 || r3 <= 0) {
    return { values: {}, errors: ["All resistor values must be positive"] };
  }
  const vref = vcc * r1 / (r1 + r2);
  const vhyst = vcc * r2 / (r2 + r3);
  const vth_high = vref + vhyst / 2;
  const vth_low = vref - vhyst / 2;
  const hysteresis = vhyst;
  const centerVoltage = vref;
  return {
    values: {
      vth_high,
      vth_low,
      hysteresis,
      centerVoltage
    }
  };
}
var schmittTrigger = {
  slug: "schmitt-trigger",
  title: "Schmitt Trigger Calculator",
  shortTitle: "Schmitt Trigger",
  category: "general",
  description: "Calculate non-inverting Schmitt trigger threshold voltages and hysteresis band for comparator circuits with positive feedback.",
  keywords: ["schmitt trigger calculator", "hysteresis comparator", "threshold voltage", "positive feedback comparator", "noise immunity trigger"],
  inputs: [
    {
      key: "vcc",
      label: "Supply Voltage",
      symbol: "Vcc",
      unit: "V",
      defaultValue: 5,
      min: 0.1,
      max: 36,
      tooltip: "Supply voltage for the comparator/op-amp"
    },
    {
      key: "r1",
      label: "R1 (Lower)",
      symbol: "R1",
      unit: "k\u03A9",
      defaultValue: 10,
      min: 1e-3,
      max: 1e4,
      tooltip: "Lower resistor to ground in the voltage divider network"
    },
    {
      key: "r2",
      label: "R2 (Upper)",
      symbol: "R2",
      unit: "k\u03A9",
      defaultValue: 10,
      min: 1e-3,
      max: 1e4,
      tooltip: "Upper resistor from output to the voltage divider node"
    },
    {
      key: "r3",
      label: "R3 (Feedback)",
      symbol: "R3",
      unit: "k\u03A9",
      defaultValue: 100,
      min: 1e-3,
      max: 1e4,
      tooltip: "Feedback resistor from output to non-inverting input"
    }
  ],
  outputs: [
    {
      key: "vth_high",
      label: "Upper Threshold",
      symbol: "V_TH+",
      unit: "V",
      precision: 4,
      tooltip: "High threshold voltage \u2014 input must exceed this to trigger high-to-low transition"
    },
    {
      key: "vth_low",
      label: "Lower Threshold",
      symbol: "V_TH-",
      unit: "V",
      precision: 4,
      tooltip: "Low threshold voltage \u2014 input must fall below this to trigger low-to-high transition"
    },
    {
      key: "hysteresis",
      label: "Hysteresis",
      symbol: "V_hyst",
      unit: "V",
      precision: 4,
      tooltip: "Total hysteresis window (Vth_high - Vth_low)"
    },
    {
      key: "centerVoltage",
      label: "Center Voltage",
      symbol: "V_ref",
      unit: "V",
      precision: 4,
      tooltip: "Center (reference) voltage of the hysteresis window"
    }
  ],
  calculate: calculateSchmittTrigger,
  formula: {
    primary: "V_{ref} = V_{cc}\\frac{R_1}{R_1+R_2},\\quad V_{hyst} = V_{cc}\\frac{R_2}{R_2+R_3}",
    latex: "V_{TH\\pm} = V_{ref} \\pm \\frac{V_{hyst}}{2}",
    variables: [
      { symbol: "Vcc", description: "Supply voltage", unit: "V" },
      { symbol: "R1", description: "Lower voltage divider resistor", unit: "k\u03A9" },
      { symbol: "R2", description: "Upper voltage divider resistor", unit: "k\u03A9" },
      { symbol: "R3", description: "Feedback resistor", unit: "k\u03A9" }
    ],
    reference: 'Horowitz & Hill, "The Art of Electronics" 3rd ed.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["comparator-hysteresis", "opamp-gain", "opamp-bandwidth"],
  verificationData: [
    {
      inputs: { vcc: 5, r1: 10, r2: 10, r3: 100 },
      expectedOutputs: { vth_high: 2.727, vth_low: 2.273, hysteresis: 0.4545, centerVoltage: 2.5 },
      tolerance: 0.01,
      source: "Analytical derivation"
    }
  ]
};

// src/lib/calculators/general/crystal-load-capacitance.ts
function calculateCrystalLoadCapacitance(inputs) {
  const { cl, cstray, c1, c2 } = inputs;
  if (c1 <= 0 || c2 <= 0) {
    return { values: {}, errors: ["External capacitor values must be positive"] };
  }
  if (cl <= 0) {
    return { values: {}, errors: ["Crystal load capacitance must be positive"] };
  }
  const clActual = c1 * c2 / (c1 + c2) + cstray;
  const clError = clActual - cl;
  const freqError = clError / (2 * cl) * 1e3;
  const c_recommended = 2 * (cl - cstray);
  return {
    values: {
      clActual,
      clError,
      freqError,
      c_recommended: c_recommended > 0 ? c_recommended : 0
    }
  };
}
var crystalLoadCapacitance = {
  slug: "crystal-load-capacitance",
  title: "Crystal Load Capacitance Calculator",
  shortTitle: "Crystal Load Cap",
  category: "general",
  description: "Calculate actual load capacitance seen by a crystal oscillator, estimate frequency error from spec, and find recommended external capacitor values.",
  keywords: ["crystal load capacitance", "crystal oscillator design", "frequency accuracy ppm", "xtal capacitor", "oscillator stray capacitance"],
  inputs: [
    {
      key: "cl",
      label: "Crystal Load Capacitance (spec)",
      symbol: "CL",
      unit: "pF",
      defaultValue: 18,
      min: 1,
      max: 100,
      tooltip: "Crystal specified load capacitance from datasheet"
    },
    {
      key: "cstray",
      label: "Stray / Parasitic Capacitance",
      symbol: "C_stray",
      unit: "pF",
      defaultValue: 3,
      min: 0,
      max: 50,
      tooltip: "PCB stray/parasitic capacitance including IC input capacitance"
    },
    {
      key: "c1",
      label: "External Cap C1",
      symbol: "C1",
      unit: "pF",
      defaultValue: 22,
      min: 0.1,
      max: 1e3,
      tooltip: "External capacitor 1 (C1 = C2 is typical for symmetric layout)"
    },
    {
      key: "c2",
      label: "External Cap C2",
      symbol: "C2",
      unit: "pF",
      defaultValue: 22,
      min: 0.1,
      max: 1e3,
      tooltip: "External capacitor 2"
    }
  ],
  outputs: [
    {
      key: "clActual",
      label: "Actual Load Capacitance",
      symbol: "CL_actual",
      unit: "pF",
      precision: 2,
      tooltip: "Actual load capacitance presented to the crystal: (C1||C2) + Cstray"
    },
    {
      key: "clError",
      label: "Load Capacitance Error",
      symbol: "\u0394CL",
      unit: "pF",
      precision: 2,
      tooltip: "Difference between actual and specified load capacitance"
    },
    {
      key: "freqError",
      label: "Estimated Frequency Error",
      symbol: "\u0394f",
      unit: "ppm",
      precision: 1,
      tooltip: "Approximate frequency error due to load capacitance mismatch"
    },
    {
      key: "c_recommended",
      label: "Recommended External Cap (each)",
      symbol: "C_rec",
      unit: "pF",
      precision: 1,
      tooltip: "Recommended value for each external capacitor (C1 = C2) to hit the specified load capacitance"
    }
  ],
  calculate: calculateCrystalLoadCapacitance,
  formula: {
    primary: "C_{L,actual} = \\frac{C_1 C_2}{C_1+C_2} + C_{stray}",
    latex: "C_{rec} = 2(C_L - C_{stray})",
    variables: [
      { symbol: "CL", description: "Specified crystal load capacitance", unit: "pF" },
      { symbol: "C1, C2", description: "External load capacitors", unit: "pF" },
      { symbol: "Cstray", description: "PCB stray capacitance", unit: "pF" }
    ],
    reference: "IEC 60444 / Crystal manufacturer application notes"
  },
  visualization: { type: "none" },
  relatedCalculators: ["rc-time-constant", "lc-resonance", "schmitt-trigger"],
  liveWidgets: [
    { type: "ism-coexistence", position: "below-outputs", props: { bandMhz: 2400 } }
  ]
};

// src/lib/calculators/general/opamp-bandwidth.ts
function calculateOpampBandwidth(inputs) {
  const { gbw, gain, phase_margin } = inputs;
  if (gbw <= 0) {
    return { values: {}, errors: ["GBW must be positive"] };
  }
  if (gain < 1) {
    return { values: {}, errors: ["Closed-loop gain must be >= 1"] };
  }
  const bandwidth = gbw * 1e6 / gain / 1e3;
  const riseTime = 0.35 / (bandwidth * 1e3) * 1e6;
  const gainDb = 20 * Math.log10(gain);
  const slewLimited = 0;
  void phase_margin;
  return {
    values: {
      bandwidth,
      riseTime,
      slewLimited,
      gainDb
    }
  };
}
var opampBandwidth = {
  slug: "opamp-bandwidth",
  title: "Op-Amp Closed-Loop Bandwidth Calculator",
  shortTitle: "Op-Amp Bandwidth",
  category: "general",
  description: "Calculate op-amp closed-loop -3dB bandwidth from the gain-bandwidth product (GBW), determine rise time, and verify phase margin.",
  keywords: ["op amp bandwidth calculator", "gain bandwidth product", "closed loop bandwidth", "opamp rise time", "unity gain bandwidth"],
  inputs: [
    {
      key: "gbw",
      label: "Gain-Bandwidth Product",
      symbol: "GBW",
      unit: "MHz",
      defaultValue: 1,
      min: 1e-3,
      max: 1e4,
      tooltip: "Unity gain bandwidth product from datasheet (GBW or ft)"
    },
    {
      key: "gain",
      label: "Closed-Loop Gain",
      symbol: "A_CL",
      unit: "V/V",
      defaultValue: 10,
      min: 1,
      max: 1e5,
      tooltip: "Closed-loop voltage gain (non-inverting: 1 + Rf/Rg)"
    },
    {
      key: "phase_margin",
      label: "Phase Margin",
      symbol: "PM",
      unit: "\xB0",
      defaultValue: 45,
      min: 1,
      max: 90,
      tooltip: "Phase margin for stability assessment (typically 45-60\xB0)"
    }
  ],
  outputs: [
    {
      key: "bandwidth",
      label: "-3dB Bandwidth",
      symbol: "BW",
      unit: "kHz",
      precision: 3,
      tooltip: "Closed-loop -3dB bandwidth: BW = GBW / A_CL"
    },
    {
      key: "riseTime",
      label: "Rise Time (10-90%)",
      symbol: "t_r",
      unit: "\u03BCs",
      precision: 3,
      tooltip: "Approximate 10-90% rise time: t_r = 0.35 / BW"
    },
    {
      key: "slewLimited",
      label: "Slew Rate Limited",
      symbol: "SR_lim",
      unit: "",
      precision: 0,
      tooltip: "Whether output is slew-rate limited (1=yes, 0=no). Requires slew rate input to evaluate."
    },
    {
      key: "gainDb",
      label: "Gain",
      symbol: "A_CL",
      unit: "dB",
      precision: 2,
      tooltip: "Closed-loop gain in decibels"
    }
  ],
  calculate: calculateOpampBandwidth,
  formula: {
    primary: "BW = \\frac{GBW}{A_{CL}},\\quad t_r = \\frac{0.35}{BW}",
    variables: [
      { symbol: "GBW", description: "Gain-bandwidth product", unit: "Hz" },
      { symbol: "A_CL", description: "Closed-loop gain", unit: "V/V" },
      { symbol: "BW", description: "-3dB bandwidth", unit: "Hz" },
      { symbol: "t_r", description: "10-90% rise time", unit: "s" }
    ],
    reference: 'Texas Instruments, "Op Amp Applications Handbook"'
  },
  visualization: { type: "none" },
  relatedCalculators: ["opamp-gain", "comparator-hysteresis", "schmitt-trigger"]
};

// src/lib/calculators/general/lm317-resistors.ts
function calculateLm317Resistors(inputs) {
  const { vout, r1, iadj } = inputs;
  const VREF = 1.25;
  if (vout < VREF) {
    return { values: {}, errors: [`Output voltage must be >= ${VREF}V (Vref)`] };
  }
  if (r1 <= 0) {
    return { values: {}, errors: ["R1 must be positive"] };
  }
  const iadj_A = iadj * 1e-6;
  const r2 = (vout - VREF) / (VREF / r1 + iadj_A);
  const voutActual = VREF * (1 + r2 / r1) + iadj_A * r2;
  const ir1 = VREF / r1;
  const powerR1 = ir1 * ir1 * r1 * 1e3;
  const ir2 = VREF / r1 + iadj_A;
  const powerR2 = ir2 * ir2 * r2 * 1e3;
  return {
    values: {
      r2,
      voutActual,
      powerR1,
      powerR2
    }
  };
}
var lm317Resistors = {
  slug: "lm317-resistors",
  title: "LM317 Resistor Calculator",
  shortTitle: "LM317 Resistors",
  category: "general",
  description: "Calculate R2 resistor value for LM317/LM338 adjustable voltage regulator output voltage, with actual Vout and resistor power dissipation.",
  keywords: ["lm317 resistor calculator", "lm317 output voltage", "adjustable voltage regulator", "lm338 design", "linear regulator resistors"],
  inputs: [
    {
      key: "vout",
      label: "Desired Output Voltage",
      symbol: "Vout",
      unit: "V",
      defaultValue: 5,
      min: 1.25,
      max: 37,
      tooltip: "Desired output voltage (minimum 1.25V = Vref)"
    },
    {
      key: "r1",
      label: "R1",
      symbol: "R1",
      unit: "\u03A9",
      defaultValue: 240,
      min: 1,
      max: 1e4,
      tooltip: "R1 from output pin to ADJ pin \u2014 typically 240\u03A9 per LM317 datasheet"
    },
    {
      key: "iadj",
      label: "ADJ Pin Current",
      symbol: "I_adj",
      unit: "\u03BCA",
      defaultValue: 50,
      min: 0,
      max: 500,
      tooltip: "ADJ pin current \u2014 typically 50\u03BCA for LM317, 65\u03BCA for LM317A"
    }
  ],
  outputs: [
    {
      key: "r2",
      label: "Required R2",
      symbol: "R2",
      unit: "\u03A9",
      precision: 1,
      tooltip: "Calculated R2 value from ADJ pin to ground"
    },
    {
      key: "voutActual",
      label: "Actual Output Voltage",
      symbol: "Vout_actual",
      unit: "V",
      precision: 4,
      tooltip: "Actual output voltage including ADJ pin current effect"
    },
    {
      key: "powerR1",
      label: "Power in R1",
      symbol: "P_R1",
      unit: "mW",
      precision: 2,
      tooltip: "Power dissipated in R1"
    },
    {
      key: "powerR2",
      label: "Power in R2",
      symbol: "P_R2",
      unit: "mW",
      precision: 2,
      tooltip: "Power dissipated in R2"
    }
  ],
  calculate: calculateLm317Resistors,
  formula: {
    primary: "V_{out} = V_{ref}\\left(1+\\frac{R_2}{R_1}\\right) + I_{adj}R_2",
    latex: "R_2 = \\frac{V_{out}-V_{ref}}{V_{ref}/R_1 + I_{adj}}",
    variables: [
      { symbol: "Vref", description: "LM317 reference voltage (1.25V)", unit: "V" },
      { symbol: "R1", description: "Output to ADJ resistor", unit: "\u03A9" },
      { symbol: "R2", description: "ADJ to GND resistor", unit: "\u03A9" },
      { symbol: "Iadj", description: "ADJ pin current", unit: "A" }
    ],
    reference: "Texas Instruments LM317 Datasheet (SNVS774)"
  },
  visualization: { type: "none" },
  relatedCalculators: ["voltage-regulator-dropout", "zener-diode", "ldo-thermal"],
  exportComponents: (inputs, outputs) => {
    const fmtR = (ohm) => ohm >= 1e6 ? `${+(ohm / 1e6).toPrecision(3)} M\u03A9` : ohm >= 1e3 ? `${+(ohm / 1e3).toPrecision(3)} k\u03A9` : `${+ohm.toPrecision(3)} \u03A9`;
    return [
      { qty: 1, description: "R1 (output to ADJ)", value: fmtR(inputs.r1), package: "0402", componentType: "R", placement: "series" },
      { qty: 1, description: "R2 (ADJ to GND)", value: fmtR(outputs?.r2 ?? 0), package: "0402", componentType: "R", placement: "shunt" }
    ];
  },
  verificationData: [
    {
      inputs: { vout: 5, r1: 240, iadj: 50 },
      expectedOutputs: { r2: 720, voutActual: 5.036 },
      tolerance: 0.01,
      source: "LM317 datasheet example"
    }
  ]
};

// src/lib/calculators/general/voltage-regulator-dropout.ts
function calculateVoltageRegulatorDropout(inputs) {
  const { vout, iload, vdropout, rds_on, vin } = inputs;
  if (vout <= 0) {
    return { values: {}, errors: ["Output voltage must be positive"] };
  }
  if (vin <= 0) {
    return { values: {}, errors: ["Input voltage must be positive"] };
  }
  const iload_A = iload * 1e-3;
  const vdropout_V = vdropout * 1e-3;
  const rds_on_Ohm = rds_on * 1e-3;
  const vinMin = vout + vdropout_V + iload_A * rds_on_Ohm;
  const vinRec = vinMin * 1.1;
  const powerDiss = (vin - vout) * iload_A * 1e3;
  const efficiency = vout / vin * 100;
  return {
    values: {
      vinMin,
      vinRec,
      powerDiss,
      efficiency
    }
  };
}
var voltageRegulatorDropout = {
  slug: "voltage-regulator-dropout",
  title: "LDO Dropout Voltage Calculator",
  shortTitle: "LDO Dropout",
  category: "general",
  description: "Calculate LDO minimum input voltage from dropout specification, determine power dissipation, and estimate efficiency at a given supply voltage.",
  keywords: ["ldo dropout voltage", "minimum input voltage ldo", "linear regulator efficiency", "voltage regulator power dissipation", "ldo headroom"],
  inputs: [
    {
      key: "vout",
      label: "Output Voltage",
      symbol: "Vout",
      unit: "V",
      defaultValue: 3.3,
      min: 0.1,
      max: 36,
      tooltip: "Regulated output voltage"
    },
    {
      key: "iload",
      label: "Load Current",
      symbol: "I_load",
      unit: "mA",
      defaultValue: 500,
      min: 0.1,
      max: 1e4,
      tooltip: "Maximum load current drawn from the regulator"
    },
    {
      key: "vdropout",
      label: "Dropout Voltage",
      symbol: "V_do",
      unit: "mV",
      defaultValue: 300,
      min: 1,
      max: 5e3,
      tooltip: "Typical LDO dropout voltage from datasheet at rated current"
    },
    {
      key: "rds_on",
      label: "MOSFET Rds(on)",
      symbol: "Rds(on)",
      unit: "m\u03A9",
      defaultValue: 0,
      min: 0,
      max: 1e4,
      tooltip: "MOSFET Rds(on) for LDO pass device \u2014 enter 0 if not applicable or unknown"
    },
    {
      key: "vin",
      label: "Actual Supply Voltage",
      symbol: "Vin",
      unit: "V",
      defaultValue: 5,
      min: 0.1,
      max: 60,
      tooltip: "Actual input supply voltage for power and efficiency calculations"
    }
  ],
  outputs: [
    {
      key: "vinMin",
      label: "Minimum Input Voltage",
      symbol: "Vin_min",
      unit: "V",
      precision: 3,
      tooltip: "Minimum input voltage to maintain regulation: Vout + Vdropout + Iload*Rds"
    },
    {
      key: "vinRec",
      label: "Recommended Input Voltage",
      symbol: "Vin_rec",
      unit: "V",
      precision: 3,
      tooltip: "Recommended input voltage with 10% margin above minimum"
    },
    {
      key: "powerDiss",
      label: "Power Dissipation",
      symbol: "P_diss",
      unit: "mW",
      precision: 1,
      tooltip: "Power dissipated in the regulator at the given Vin"
    },
    {
      key: "efficiency",
      label: "Efficiency",
      symbol: "\u03B7",
      unit: "%",
      precision: 1,
      tooltip: "Regulator efficiency: Vout/Vin \xD7 100%",
      thresholds: {
        good: { min: 80 },
        warning: { min: 60, max: 80 },
        danger: { min: 60 }
      }
    }
  ],
  calculate: calculateVoltageRegulatorDropout,
  formula: {
    primary: "V_{in,min} = V_{out} + V_{dropout} + I_{load} \\cdot R_{ds(on)}",
    latex: "\\eta = \\frac{V_{out}}{V_{in}} \\times 100\\%",
    variables: [
      { symbol: "Vout", description: "Regulated output voltage", unit: "V" },
      { symbol: "Vdropout", description: "LDO dropout voltage", unit: "V" },
      { symbol: "Iload", description: "Load current", unit: "A" },
      { symbol: "Rds(on)", description: "Pass MOSFET on-resistance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["ldo-thermal", "lm317-resistors", "linear-regulator-dropout"]
};

// src/lib/calculators/power/transformer-turns-ratio.ts
function calculateTransformerTurnsRatio(inputs) {
  const { vPrimary, vSecondary, iPrimary, efficiency } = inputs;
  if (vPrimary <= 0 || vSecondary <= 0) {
    return { values: {}, errors: ["Voltages must be positive"] };
  }
  if (iPrimary <= 0) {
    return { values: {}, errors: ["Primary current must be positive"] };
  }
  const eta = efficiency / 100;
  const turnsRatio = vPrimary / vSecondary;
  const iSecondary = iPrimary * turnsRatio * eta;
  const apparentPower = vPrimary * iPrimary;
  const realPower = apparentPower * eta;
  const couplingFactor = eta;
  return {
    values: {
      turnsRatio,
      iSecondary,
      apparentPower,
      realPower,
      couplingFactor
    }
  };
}
var transformerTurnsRatio = {
  slug: "transformer-turns-ratio",
  title: "Transformer Turns Ratio Calculator",
  shortTitle: "Transformer Turns Ratio",
  category: "power",
  description: "Calculate transformer turns ratio, secondary current, apparent power, and real power delivered. Accounts for transformer efficiency.",
  keywords: ["transformer turns ratio", "transformer design calculator", "step down transformer", "secondary current transformer", "transformer efficiency"],
  inputs: [
    {
      key: "vPrimary",
      label: "Primary Voltage",
      symbol: "Vp",
      unit: "V",
      defaultValue: 120,
      min: 0.1,
      max: 1e5,
      tooltip: "Primary (input) winding voltage"
    },
    {
      key: "vSecondary",
      label: "Secondary Voltage",
      symbol: "Vs",
      unit: "V",
      defaultValue: 12,
      min: 0.1,
      max: 1e5,
      tooltip: "Secondary (output) winding voltage"
    },
    {
      key: "iPrimary",
      label: "Primary Current",
      symbol: "Ip",
      unit: "A",
      defaultValue: 0.1,
      min: 1e-4,
      max: 1e4,
      tooltip: "Primary winding current"
    },
    {
      key: "efficiency",
      label: "Transformer Efficiency",
      symbol: "\u03B7",
      unit: "%",
      defaultValue: 95,
      min: 1,
      max: 100,
      tooltip: "Transformer efficiency (typical: 90-99% for power transformers)"
    }
  ],
  outputs: [
    {
      key: "turnsRatio",
      label: "Turns Ratio (Np/Ns)",
      symbol: "N",
      unit: "",
      precision: 4,
      tooltip: "Transformer turns ratio Np/Ns = Vp/Vs"
    },
    {
      key: "iSecondary",
      label: "Secondary Current",
      symbol: "Is",
      unit: "A",
      precision: 4,
      tooltip: "Secondary winding current accounting for efficiency"
    },
    {
      key: "apparentPower",
      label: "Apparent Power",
      symbol: "S",
      unit: "VA",
      precision: 3,
      tooltip: "Apparent power on primary side: Vp \xD7 Ip"
    },
    {
      key: "realPower",
      label: "Real Power Delivered",
      symbol: "P",
      unit: "W",
      precision: 3,
      tooltip: "Real power delivered to secondary: VA \xD7 efficiency"
    },
    {
      key: "couplingFactor",
      label: "Coupling Factor",
      symbol: "k",
      unit: "",
      precision: 3,
      tooltip: "Magnetic coupling factor (approximated from efficiency)"
    }
  ],
  calculate: calculateTransformerTurnsRatio,
  formula: {
    primary: "N = \\frac{N_p}{N_s} = \\frac{V_p}{V_s},\\quad I_s = I_p \\cdot N \\cdot \\eta",
    variables: [
      { symbol: "N", description: "Turns ratio Np/Ns", unit: "" },
      { symbol: "Vp, Vs", description: "Primary/secondary voltages", unit: "V" },
      { symbol: "Ip, Is", description: "Primary/secondary currents", unit: "A" },
      { symbol: "\u03B7", description: "Transformer efficiency", unit: "" }
    ],
    reference: "Faraday's Law of Electromagnetic Induction"
  },
  visualization: { type: "none" },
  relatedCalculators: ["flyback-converter", "buck-converter", "three-phase-power"]
};

// src/lib/calculators/power/flyback-converter.ts
function calculateFlybackConverter(inputs) {
  const { vin, vout, iout, efficiency, fsw, dutyCycle } = inputs;
  if (vin <= 0 || vout <= 0) {
    return { values: {}, errors: ["Voltages must be positive"] };
  }
  if (iout <= 0) {
    return { values: {}, errors: ["Output current must be positive"] };
  }
  if (dutyCycle <= 0 || dutyCycle >= 100) {
    return { values: {}, errors: ["Duty cycle must be between 0 and 100%"] };
  }
  const D = dutyCycle / 100;
  const eta = efficiency / 100;
  const outputPower = vout * iout;
  const inputPower = outputPower / eta;
  const iinAvg = inputPower / vin;
  const turnsRatio = vin * D / (vout * (1 - D));
  const ipPeak = 2 * iinAvg / D;
  const isecPeak = ipPeak * turnsRatio;
  void fsw;
  return {
    values: {
      turnsRatio,
      iinAvg,
      ipPeak,
      isecPeak,
      outputPower
    }
  };
}
var flybackConverter = {
  slug: "flyback-converter",
  title: "Flyback Converter Calculator",
  shortTitle: "Flyback Converter",
  category: "power",
  description: "Calculate flyback converter turns ratio, peak primary and secondary currents, and power levels for isolated DC-DC converter design.",
  keywords: ["flyback converter design", "flyback turns ratio", "isolated dc dc converter", "flyback peak current", "switching power supply"],
  inputs: [
    {
      key: "vin",
      label: "Input Voltage",
      symbol: "Vin",
      unit: "V",
      defaultValue: 48,
      min: 1,
      max: 1e3,
      tooltip: "DC input voltage"
    },
    {
      key: "vout",
      label: "Output Voltage",
      symbol: "Vout",
      unit: "V",
      defaultValue: 12,
      min: 0.5,
      max: 500,
      tooltip: "Desired output voltage"
    },
    {
      key: "iout",
      label: "Output Current",
      symbol: "Iout",
      unit: "A",
      defaultValue: 1,
      min: 0.01,
      max: 100,
      tooltip: "Maximum output current"
    },
    {
      key: "efficiency",
      label: "Efficiency",
      symbol: "\u03B7",
      unit: "%",
      defaultValue: 85,
      min: 10,
      max: 99,
      tooltip: "Expected converter efficiency (typical: 80-90%)"
    },
    {
      key: "fsw",
      label: "Switching Frequency",
      symbol: "fsw",
      unit: "kHz",
      defaultValue: 100,
      min: 10,
      max: 5e3,
      tooltip: "Switching frequency"
    },
    {
      key: "dutyCycle",
      label: "Duty Cycle",
      symbol: "D",
      unit: "%",
      defaultValue: 40,
      min: 5,
      max: 90,
      tooltip: "Primary switch duty cycle (typical: 30-50% for flyback)"
    }
  ],
  outputs: [
    {
      key: "turnsRatio",
      label: "Turns Ratio (Np/Ns)",
      symbol: "N",
      unit: "",
      precision: 3,
      tooltip: "Primary-to-secondary turns ratio"
    },
    {
      key: "iinAvg",
      label: "Average Input Current",
      symbol: "Iin_avg",
      unit: "A",
      precision: 3,
      tooltip: "Average DC input current"
    },
    {
      key: "ipPeak",
      label: "Peak Primary Current",
      symbol: "Ip_peak",
      unit: "A",
      precision: 3,
      tooltip: "Peak current in primary MOSFET switch"
    },
    {
      key: "isecPeak",
      label: "Peak Secondary Current",
      symbol: "Is_peak",
      unit: "A",
      precision: 3,
      tooltip: "Peak current in secondary diode/rectifier"
    },
    {
      key: "outputPower",
      label: "Output Power",
      symbol: "Pout",
      unit: "W",
      precision: 2,
      tooltip: "Total output power: Vout \xD7 Iout"
    }
  ],
  calculate: calculateFlybackConverter,
  formula: {
    primary: "N = \\frac{V_{in} \\cdot D}{V_{out}(1-D)},\\quad I_{p,peak} = \\frac{2 I_{in}}{D}",
    variables: [
      { symbol: "N", description: "Turns ratio Np/Ns", unit: "" },
      { symbol: "D", description: "Duty cycle", unit: "" },
      { symbol: "Vin", description: "Input voltage", unit: "V" },
      { symbol: "Vout", description: "Output voltage", unit: "V" }
    ],
    reference: "Unitrode Power Supply Design Seminar SEM600"
  },
  visualization: { type: "none" },
  relatedCalculators: ["transformer-turns-ratio", "buck-converter", "mosfet-power-dissipation"]
};

// src/lib/calculators/power/supercapacitor-backup.ts
function calculateSupercapacitorBackup(inputs) {
  const { capacitance, vMax, vMin, iLoad } = inputs;
  if (capacitance <= 0) {
    return { values: {}, errors: ["Capacitance must be positive"] };
  }
  if (vMax <= vMin) {
    return { values: {}, errors: ["Maximum voltage must be greater than minimum voltage"] };
  }
  if (iLoad <= 0) {
    return { values: {}, errors: ["Load current must be positive"] };
  }
  const iLoad_A = iLoad * 1e-3;
  const energy = 0.5 * capacitance * (vMax * vMax - vMin * vMin);
  const vAvg = (vMax + vMin) / 2;
  const backupTime = energy / (vAvg * iLoad_A);
  const backupTimeMin = backupTime / 60;
  const chargeTime = capacitance * vMax / (5 * iLoad_A);
  const selfDischargeCurrentA = capacitance * 1e-6;
  const selfDischargeEnergyPerDay = selfDischargeCurrentA * vAvg * 86400;
  const selfDischarge = selfDischargeEnergyPerDay / energy * 100;
  return {
    values: {
      energy,
      backupTime,
      backupTimeMin,
      chargeTime,
      selfDischarge
    }
  };
}
var supercapacitorBackup = {
  slug: "supercapacitor-backup",
  title: "Supercapacitor Backup Time Calculator",
  shortTitle: "Supercap Backup",
  category: "power",
  description: "Calculate supercapacitor backup time, stored energy, and charge time for power backup applications using ultracapacitors.",
  keywords: ["supercapacitor backup time", "ultracapacitor sizing", "supercap energy storage", "edlc backup calculator", "capacitor backup power"],
  inputs: [
    {
      key: "capacitance",
      label: "Capacitance",
      symbol: "C",
      unit: "F",
      defaultValue: 10,
      min: 1e-3,
      max: 1e4,
      tooltip: "Supercapacitor capacitance in Farads"
    },
    {
      key: "vMax",
      label: "Maximum Voltage",
      symbol: "Vmax",
      unit: "V",
      defaultValue: 5.5,
      min: 0.1,
      max: 100,
      tooltip: "Maximum (fully charged) voltage \u2014 must not exceed rated voltage"
    },
    {
      key: "vMin",
      label: "Minimum Operating Voltage",
      symbol: "Vmin",
      unit: "V",
      defaultValue: 3,
      min: 0.1,
      max: 99,
      tooltip: "Minimum voltage at which load circuit still operates"
    },
    {
      key: "iLoad",
      label: "Load Current",
      symbol: "I_load",
      unit: "mA",
      defaultValue: 100,
      min: 0.01,
      max: 1e5,
      tooltip: "Load current drawn during backup operation"
    }
  ],
  outputs: [
    {
      key: "energy",
      label: "Usable Energy",
      symbol: "E",
      unit: "J",
      precision: 3,
      tooltip: "Energy available between Vmax and Vmin: E = 0.5\xD7C\xD7(Vmax\xB2\u2212Vmin\xB2)"
    },
    {
      key: "backupTime",
      label: "Backup Time",
      symbol: "t_backup",
      unit: "s",
      precision: 1,
      tooltip: "Estimated backup time at constant load current"
    },
    {
      key: "backupTimeMin",
      label: "Backup Time",
      symbol: "t_backup",
      unit: "min",
      precision: 2,
      tooltip: "Estimated backup time in minutes"
    },
    {
      key: "chargeTime",
      label: "Approximate Charge Time",
      symbol: "t_charge",
      unit: "s",
      precision: 1,
      tooltip: "Approximate charge time assuming 5\xD7 load current charge rate"
    },
    {
      key: "selfDischarge",
      label: "Daily Self-Discharge",
      symbol: "SD",
      unit: "%",
      precision: 2,
      tooltip: "Estimated self-discharge per day (assumes ~1\u03BCA/F leakage current)"
    }
  ],
  calculate: calculateSupercapacitorBackup,
  formula: {
    primary: "E = \\frac{1}{2}C(V_{max}^2 - V_{min}^2),\\quad t = \\frac{E}{V_{avg} \\cdot I_{load}}",
    variables: [
      { symbol: "C", description: "Capacitance", unit: "F" },
      { symbol: "Vmax, Vmin", description: "Max/min operating voltages", unit: "V" },
      { symbol: "Vavg", description: "Average discharge voltage", unit: "V" },
      { symbol: "Iload", description: "Load current", unit: "A" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["battery-life", "battery-internal-resistance", "capacitor-energy"]
};

// src/lib/calculators/power/battery-internal-resistance.ts
function calculateBatteryInternalResistance(inputs) {
  const { vocv, vLoad, iLoad, temperature } = inputs;
  if (vocv <= 0) {
    return { values: {}, errors: ["Open circuit voltage must be positive"] };
  }
  if (vLoad <= 0) {
    return { values: {}, errors: ["Loaded voltage must be positive"] };
  }
  if (vLoad >= vocv) {
    return { values: {}, errors: ["Loaded voltage must be less than open circuit voltage"] };
  }
  if (iLoad <= 0) {
    return { values: {}, errors: ["Load current must be positive"] };
  }
  const rinternal = (vocv - vLoad) / iLoad * 1e3;
  const powerLoss = rinternal / 1e3 * iLoad * iLoad;
  const efficiency = vLoad * iLoad / (vocv * iLoad) * 100;
  const maxCurrentShort = vocv / (rinternal / 1e3);
  void temperature;
  return {
    values: {
      rinternal,
      powerLoss,
      efficiency,
      maxCurrentShort
    }
  };
}
var batteryInternalResistance = {
  slug: "battery-internal-resistance",
  title: "Battery Internal Resistance Calculator",
  shortTitle: "Battery Internal Resistance",
  category: "power",
  description: "Calculate battery internal resistance from open-circuit and loaded voltage measurements, determine power loss and maximum short-circuit current.",
  keywords: ["battery internal resistance", "battery impedance", "voltage sag under load", "battery health calculator", "discharge resistance"],
  inputs: [
    {
      key: "vocv",
      label: "Open Circuit Voltage",
      symbol: "Vocv",
      unit: "V",
      defaultValue: 12.6,
      min: 0.1,
      max: 1e3,
      tooltip: "Battery open circuit voltage with no load applied"
    },
    {
      key: "vLoad",
      label: "Loaded Voltage",
      symbol: "Vload",
      unit: "V",
      defaultValue: 11.8,
      min: 0.1,
      max: 1e3,
      tooltip: "Battery terminal voltage under load current"
    },
    {
      key: "iLoad",
      label: "Load Current",
      symbol: "I_load",
      unit: "A",
      defaultValue: 4,
      min: 1e-3,
      max: 1e4,
      tooltip: "Load current applied during the voltage measurement"
    },
    {
      key: "temperature",
      label: "Temperature",
      symbol: "T",
      unit: "\xB0C",
      defaultValue: 25,
      min: -40,
      max: 85,
      tooltip: "Battery temperature (affects internal resistance \u2014 informational)"
    }
  ],
  outputs: [
    {
      key: "rinternal",
      label: "Internal Resistance",
      symbol: "Rint",
      unit: "m\u03A9",
      precision: 2,
      tooltip: "Battery internal resistance: R = (Vocv \u2212 Vload) / Iload",
      thresholds: {
        good: { max: 50 },
        warning: { min: 50, max: 200 },
        danger: { max: 200 }
      }
    },
    {
      key: "powerLoss",
      label: "Internal Power Loss",
      symbol: "P_loss",
      unit: "W",
      precision: 3,
      tooltip: "Power dissipated inside the battery: P = Rint \xD7 Iload\xB2"
    },
    {
      key: "efficiency",
      label: "Efficiency",
      symbol: "\u03B7",
      unit: "%",
      precision: 2,
      tooltip: "Energy delivery efficiency: Vload/Vocv \xD7 100%"
    },
    {
      key: "maxCurrentShort",
      label: "Theoretical Short-Circuit Current",
      symbol: "Isc",
      unit: "A",
      precision: 1,
      tooltip: "Theoretical maximum short-circuit current: Isc = Vocv / Rint"
    }
  ],
  calculate: calculateBatteryInternalResistance,
  formula: {
    primary: "R_{int} = \\frac{V_{ocv} - V_{load}}{I_{load}}",
    variables: [
      { symbol: "Vocv", description: "Open circuit voltage", unit: "V" },
      { symbol: "Vload", description: "Loaded terminal voltage", unit: "V" },
      { symbol: "Iload", description: "Load current", unit: "A" },
      { symbol: "Rint", description: "Internal resistance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["battery-life", "supercapacitor-backup", "battery-charge-time"]
};

// src/lib/calculators/protocol/i2s-timing.ts
function calculateI2sTiming(inputs) {
  const { sampleRate, bitDepth, channels } = inputs;
  if (sampleRate <= 0) {
    return { values: {}, errors: ["Sample rate must be positive"] };
  }
  if (bitDepth <= 0) {
    return { values: {}, errors: ["Bit depth must be positive"] };
  }
  if (channels <= 0) {
    return { values: {}, errors: ["Channel count must be positive"] };
  }
  const bclk = sampleRate * bitDepth * channels / 1e3;
  const wclk = sampleRate;
  const bclkPeriod = 1 / (bclk * 1e6) * 1e9;
  const dataRate = sampleRate * bitDepth * channels / 1e3;
  return {
    values: {
      bclk,
      wclk,
      bclkPeriod,
      dataRate
    }
  };
}
var i2sTiming = {
  slug: "i2s-timing",
  title: "I2S Audio Interface Timing Calculator",
  shortTitle: "I2S Timing",
  category: "protocol",
  description: "Calculate I2S bit clock (BCLK), word clock (LRCLK/WCLK), and data rate for audio interfaces at any sample rate, bit depth, and channel count.",
  keywords: ["i2s timing calculator", "i2s bclk frequency", "i2s word clock", "audio interface bit clock", "i2s data rate"],
  inputs: [
    {
      key: "sampleRate",
      label: "Sample Rate",
      symbol: "Fs",
      unit: "kHz",
      defaultValue: 44.1,
      min: 0.1,
      max: 768,
      tooltip: "Audio sample rate (e.g., 44.1, 48, 96, 192 kHz)",
      presets: [
        { label: "44.1 kHz (CD)", values: { sampleRate: 44.1 } },
        { label: "48 kHz (Pro)", values: { sampleRate: 48 } },
        { label: "96 kHz (HD)", values: { sampleRate: 96 } },
        { label: "192 kHz", values: { sampleRate: 192 } }
      ]
    },
    {
      key: "bitDepth",
      label: "Bit Depth",
      symbol: "N",
      unit: "bits",
      defaultValue: 24,
      min: 8,
      max: 64,
      tooltip: "Bits per sample (common: 16, 24, 32 bits)",
      presets: [
        { label: "16-bit", values: { bitDepth: 16 } },
        { label: "24-bit", values: { bitDepth: 24 } },
        { label: "32-bit", values: { bitDepth: 32 } }
      ]
    },
    {
      key: "channels",
      label: "Channels",
      symbol: "Ch",
      unit: "",
      defaultValue: 2,
      min: 1,
      max: 32,
      tooltip: "Number of audio channels (1=mono, 2=stereo)"
    }
  ],
  outputs: [
    {
      key: "bclk",
      label: "Bit Clock (BCLK)",
      symbol: "BCLK",
      unit: "MHz",
      precision: 4,
      tooltip: "Bit clock frequency: BCLK = Fs \xD7 bit_depth \xD7 channels"
    },
    {
      key: "wclk",
      label: "Word Clock (LRCLK)",
      symbol: "WCLK",
      unit: "kHz",
      precision: 2,
      tooltip: "Word/frame clock frequency = sample rate"
    },
    {
      key: "bclkPeriod",
      label: "BCLK Period",
      symbol: "T_BCLK",
      unit: "ns",
      precision: 2,
      tooltip: "Period of one BCLK cycle"
    },
    {
      key: "dataRate",
      label: "Data Rate",
      symbol: "DR",
      unit: "Mbps",
      precision: 4,
      tooltip: "Raw audio data rate on the I2S bus"
    }
  ],
  calculate: calculateI2sTiming,
  formula: {
    primary: "BCLK = F_s \\times N_{bits} \\times N_{ch}",
    variables: [
      { symbol: "Fs", description: "Sample rate", unit: "kHz" },
      { symbol: "Nbits", description: "Bit depth per sample", unit: "bits" },
      { symbol: "Nch", description: "Number of channels", unit: "" },
      { symbol: "BCLK", description: "Bit clock frequency", unit: "Hz" }
    ],
    reference: "Philips I2S Bus Specification, 1996"
  },
  visualization: { type: "none" },
  relatedCalculators: ["spi-timing", "uart-baud-rate", "adc-snr"]
};

// src/lib/calculators/protocol/lin-bus-timing.ts
function calculateLinBusTiming(inputs) {
  const { baudRate, dataBytes } = inputs;
  if (baudRate <= 0) {
    return { values: {}, errors: ["Baud rate must be positive"] };
  }
  if (dataBytes <= 0 || dataBytes > 8) {
    return { values: {}, errors: ["Data bytes must be 1 to 8"] };
  }
  const bitTime = 1 / (baudRate * 1e3) * 1e6;
  const breakLength = 13 * bitTime;
  const totalBits = 13 + 1 + 10 + 10 + 10 * dataBytes + 10;
  const frameTime = totalBits * bitTime;
  const framesPerSec = 1e6 / frameTime;
  const interFrameGap = 4 * bitTime;
  const busLoad = frameTime / (frameTime + interFrameGap) * 100;
  return {
    values: {
      bitTime,
      breakLength,
      frameTime,
      framesPerSec,
      busLoad
    }
  };
}
var linBusTiming = {
  slug: "lin-bus-timing",
  title: "LIN Bus Timing Calculator",
  shortTitle: "LIN Bus Timing",
  category: "protocol",
  description: "Calculate LIN bus bit time, break field length, frame time, and maximum frame rate for automotive LIN network design.",
  keywords: ["lin bus timing", "lin frame time", "lin baud rate calculator", "automotive lin bus", "lin bus frame structure"],
  inputs: [
    {
      key: "baudRate",
      label: "Baud Rate",
      symbol: "BR",
      unit: "kbps",
      defaultValue: 19.2,
      min: 0.1,
      max: 20,
      tooltip: "LIN baud rate (typical: 2.4, 9.6, 10.4, 19.2 kbps)",
      presets: [
        { label: "2.4 kbps", values: { baudRate: 2.4 } },
        { label: "9.6 kbps", values: { baudRate: 9.6 } },
        { label: "10.4 kbps", values: { baudRate: 10.4 } },
        { label: "19.2 kbps", values: { baudRate: 19.2 } }
      ]
    },
    {
      key: "dataBytes",
      label: "Data Bytes",
      symbol: "N",
      unit: "bytes",
      defaultValue: 8,
      min: 1,
      max: 8,
      step: 1,
      tooltip: "Number of data bytes in the response field (1-8 per LIN spec)"
    }
  ],
  outputs: [
    {
      key: "bitTime",
      label: "Bit Time",
      symbol: "T_bit",
      unit: "\u03BCs",
      precision: 3,
      tooltip: "Duration of one bit: T_bit = 1 / baud_rate"
    },
    {
      key: "breakLength",
      label: "Break Field Length",
      symbol: "T_break",
      unit: "\u03BCs",
      precision: 2,
      tooltip: "Minimum break field duration (13 bit times)"
    },
    {
      key: "frameTime",
      label: "Frame Time",
      symbol: "T_frame",
      unit: "\u03BCs",
      precision: 1,
      tooltip: "Total LIN frame duration including header and response"
    },
    {
      key: "framesPerSec",
      label: "Max Frame Rate",
      symbol: "FPS",
      unit: "frames/s",
      precision: 1,
      tooltip: "Maximum frames per second at this baud rate and data length"
    },
    {
      key: "busLoad",
      label: "Bus Load",
      symbol: "BL",
      unit: "%",
      precision: 1,
      tooltip: "Approximate bus utilization percentage"
    }
  ],
  calculate: calculateLinBusTiming,
  formula: {
    primary: "T_{bit} = \\frac{1}{baud\\_rate},\\quad T_{frame} = (13+1+10+10+10N+10) \\cdot T_{bit}",
    variables: [
      { symbol: "T_bit", description: "Bit time", unit: "\u03BCs" },
      { symbol: "N", description: "Number of data bytes", unit: "" },
      { symbol: "T_frame", description: "Total frame time", unit: "\u03BCs" }
    ],
    reference: "LIN Specification Package Revision 2.2A"
  },
  visualization: { type: "none" },
  relatedCalculators: ["can-bus-timing", "uart-baud-rate", "modbus-frame-timing"]
};

// src/lib/calculators/protocol/modbus-frame-timing.ts
function calculateModbusFrameTiming(inputs) {
  const { baudRate, dataBytes, parityBits, stopBits } = inputs;
  if (baudRate <= 0) {
    return { values: {}, errors: ["Baud rate must be positive"] };
  }
  if (dataBytes <= 0) {
    return { values: {}, errors: ["Data bytes must be positive"] };
  }
  const bitsPerChar = 1 + 8 + parityBits + stopBits;
  const charTime = bitsPerChar / baudRate * 1e3;
  const t35 = 3.5 * charTime;
  const frameTime = (dataBytes + 4) * charTime;
  const maxFrameRate = 1 / ((frameTime + t35) / 1e3);
  return {
    values: {
      charTime,
      t35,
      frameTime,
      maxFrameRate
    }
  };
}
var modbusFrameTiming = {
  slug: "modbus-frame-timing",
  title: "Modbus RTU Frame Timing Calculator",
  shortTitle: "Modbus Timing",
  category: "protocol",
  description: "Calculate Modbus RTU character time, 3.5-character inter-frame gap, total frame duration, and maximum frame rate.",
  keywords: ["modbus rtu timing", "modbus frame time", "modbus inter frame gap", "t35 modbus", "modbus baud rate calculator"],
  inputs: [
    {
      key: "baudRate",
      label: "Baud Rate",
      symbol: "BR",
      unit: "bps",
      defaultValue: 9600,
      min: 300,
      max: 115200,
      tooltip: "Modbus RTU baud rate",
      presets: [
        { label: "9600 bps", values: { baudRate: 9600 } },
        { label: "19200 bps", values: { baudRate: 19200 } },
        { label: "38400 bps", values: { baudRate: 38400 } },
        { label: "115200 bps", values: { baudRate: 115200 } }
      ]
    },
    {
      key: "dataBytes",
      label: "Data Bytes",
      symbol: "N",
      unit: "bytes",
      defaultValue: 8,
      min: 1,
      max: 252,
      step: 1,
      tooltip: "Number of data bytes in PDU including function code"
    },
    {
      key: "parityBits",
      label: "Parity Bits",
      symbol: "P",
      unit: "bits",
      defaultValue: 1,
      min: 0,
      max: 1,
      step: 1,
      tooltip: "Parity bits: 0=None, 1=Even or Odd"
    },
    {
      key: "stopBits",
      label: "Stop Bits",
      symbol: "SB",
      unit: "bits",
      defaultValue: 1,
      min: 1,
      max: 2,
      step: 1,
      tooltip: "Stop bits (1 or 2 \u2014 use 2 stop bits when parity=none)"
    }
  ],
  outputs: [
    {
      key: "charTime",
      label: "Character Time",
      symbol: "T_char",
      unit: "ms",
      precision: 4,
      tooltip: "Time to transmit one character: (1+8+parity+stop) / baud_rate"
    },
    {
      key: "t35",
      label: "Inter-Frame Gap (3.5T)",
      symbol: "T_3.5",
      unit: "ms",
      precision: 4,
      tooltip: "Modbus RTU inter-frame silence: 3.5 \xD7 character time"
    },
    {
      key: "frameTime",
      label: "Frame Time",
      symbol: "T_frame",
      unit: "ms",
      precision: 3,
      tooltip: "Total frame transmission time (address + function + data + CRC)"
    },
    {
      key: "maxFrameRate",
      label: "Max Frame Rate",
      symbol: "FPS",
      unit: "frames/s",
      precision: 1,
      tooltip: "Maximum frames per second including inter-frame gap"
    }
  ],
  calculate: calculateModbusFrameTiming,
  formula: {
    primary: "T_{char} = \\frac{1+8+P+S}{baud\\_rate},\\quad T_{3.5} = 3.5 \\times T_{char}",
    variables: [
      { symbol: "T_char", description: "Character time", unit: "ms" },
      { symbol: "T_3.5", description: "Inter-frame gap", unit: "ms" },
      { symbol: "P", description: "Parity bits", unit: "bits" },
      { symbol: "S", description: "Stop bits", unit: "bits" }
    ],
    reference: "Modbus Application Protocol V1.1b3, Modbus.org"
  },
  visualization: { type: "none" },
  relatedCalculators: ["uart-baud-rate", "lin-bus-timing", "rs485-termination"]
};

// src/lib/calculators/protocol/ethernet-cable.ts
function calculateEthernetCable(inputs) {
  const { cableType, length, speed } = inputs;
  const attTable = {
    1: { 1: 22, 2: 36, 3: 60 },
    // Cat5e
    2: { 1: 20, 2: 33, 3: 45 },
    // Cat6
    3: { 1: 18, 2: 30, 3: 32 },
    // Cat6a
    4: { 1: 15, 2: 25, 3: 40 }
    // Cat8
  };
  const maxLenTable = {
    1: { 1: 100, 2: 100, 3: 100 },
    // Cat5e: 10G technically unsupported but 100m is reference
    2: { 1: 100, 2: 100, 3: 55 },
    // Cat6: 55m at 10G
    3: { 1: 100, 2: 100, 3: 100 },
    // Cat6a: 100m at 10G
    4: { 1: 100, 2: 100, 3: 30 }
    // Cat8: 30m at 10G (data center use)
  };
  const ct = Math.round(cableType);
  const sp = Math.round(speed);
  if (!attTable[ct] || !attTable[ct][sp]) {
    return { values: {}, errors: ["Invalid cable type or speed selection"] };
  }
  const attPerHundredM = attTable[ct][sp];
  const attenuation = length / 100 * attPerHundredM;
  const maxLength = maxLenTable[ct][sp];
  const headroom = maxLength - length;
  const passOrFail = length <= maxLength ? 1 : 0;
  return {
    values: {
      attenuation,
      maxLength,
      headroom,
      passOrFail
    }
  };
}
var ethernetCable = {
  slug: "ethernet-cable",
  title: "Ethernet Cable Length & Attenuation Calculator",
  shortTitle: "Ethernet Cable",
  category: "protocol",
  description: "Calculate Ethernet cable attenuation, maximum cable length, and pass/fail for Cat5e, Cat6, Cat6a, and Cat8 at 100Mbps, 1Gbps, and 10Gbps.",
  keywords: ["ethernet cable length", "cat6 maximum length", "ethernet attenuation", "cat5e 10 gigabit", "cable run calculator"],
  inputs: [
    {
      key: "cableType",
      label: "Cable Category",
      symbol: "Cat",
      unit: "",
      defaultValue: 2,
      min: 1,
      max: 4,
      step: 1,
      tooltip: "1=Cat5e, 2=Cat6, 3=Cat6a, 4=Cat8",
      presets: [
        { label: "Cat5e", values: { cableType: 1 } },
        { label: "Cat6", values: { cableType: 2 } },
        { label: "Cat6a", values: { cableType: 3 } },
        { label: "Cat8", values: { cableType: 4 } }
      ]
    },
    {
      key: "length",
      label: "Cable Length",
      symbol: "L",
      unit: "m",
      defaultValue: 50,
      min: 1,
      max: 500,
      tooltip: "Total cable run length in meters"
    },
    {
      key: "speed",
      label: "Network Speed",
      symbol: "Speed",
      unit: "",
      defaultValue: 2,
      min: 1,
      max: 3,
      step: 1,
      tooltip: "1=100Mbps (100BASE-TX), 2=1Gbps (1000BASE-T), 3=10Gbps (10GBASE-T)",
      presets: [
        { label: "100 Mbps", values: { speed: 1 } },
        { label: "1 Gbps", values: { speed: 2 } },
        { label: "10 Gbps", values: { speed: 3 } }
      ]
    }
  ],
  outputs: [
    {
      key: "attenuation",
      label: "Cable Attenuation",
      symbol: "Att",
      unit: "dB",
      precision: 1,
      tooltip: "Estimated signal attenuation at given length"
    },
    {
      key: "maxLength",
      label: "Maximum Length",
      symbol: "L_max",
      unit: "m",
      precision: 0,
      tooltip: "IEEE/TIA maximum cable length for this category and speed"
    },
    {
      key: "headroom",
      label: "Length Headroom",
      symbol: "Margin",
      unit: "m",
      precision: 0,
      tooltip: "Remaining length margin before limit (negative = over limit)"
    },
    {
      key: "passOrFail",
      label: "Pass / Fail",
      symbol: "Pass",
      unit: "",
      precision: 0,
      tooltip: "1 = within spec (PASS), 0 = exceeds maximum length (FAIL)",
      thresholds: {
        good: { min: 1 },
        danger: { max: 0.5 }
      }
    }
  ],
  calculate: calculateEthernetCable,
  formula: {
    primary: "Att = \\frac{L}{100} \\times Att_{100m}",
    variables: [
      { symbol: "L", description: "Cable length", unit: "m" },
      { symbol: "Att_100m", description: "Attenuation per 100 m at given speed", unit: "dB" }
    ],
    reference: "IEEE 802.3 / TIA-568 cabling standards"
  },
  visualization: { type: "none" },
  relatedCalculators: ["rs485-termination", "usb-termination", "can-bus-timing"]
};

// src/lib/calculators/pcb/power-plane-impedance.ts
function calculatePowerPlaneImpedance(inputs) {
  const { length, width, dielectric, er, frequency } = inputs;
  if (length <= 0 || width <= 0) {
    return { values: {}, errors: ["Plane dimensions must be positive"] };
  }
  if (dielectric <= 0) {
    return { values: {}, errors: ["Dielectric thickness must be positive"] };
  }
  if (er <= 0) {
    return { values: {}, errors: ["Dielectric constant must be positive"] };
  }
  const areaM2 = length * 1e-3 * (width * 1e-3);
  const dM = dielectric * 1e-3;
  const capacitance = er * 8854e-15 * areaM2 / dM * 1e9;
  const inductance = 0.3 * dielectric * (length / width);
  const omega_res_sq = 1 / (inductance * 1e-9 * capacitance * 1e-9);
  const resonantFrequency = Math.sqrt(omega_res_sq) / (2 * Math.PI) / 1e6;
  const omega = 2 * Math.PI * frequency * 1e6;
  const impedance = omega * inductance * 1e-9 * 1e3;
  return {
    values: {
      capacitance,
      impedance,
      resonantFrequency,
      inductance
    }
  };
}
var powerPlaneImpedance = {
  slug: "power-plane-impedance",
  title: "PCB Power Plane Impedance Calculator",
  shortTitle: "Power Plane Impedance",
  category: "pcb",
  description: "Calculate PCB power plane spreading impedance, plane capacitance, inductance, and self-resonant frequency for PDN (power delivery network) design.",
  keywords: ["pcb power plane impedance", "pdn impedance", "power plane capacitance", "pcb plane resonance", "power distribution network"],
  inputs: [
    {
      key: "length",
      label: "Plane Length",
      symbol: "L",
      unit: "mm",
      defaultValue: 100,
      min: 1,
      max: 1e3,
      tooltip: "Length of the power plane area"
    },
    {
      key: "width",
      label: "Plane Width",
      symbol: "W",
      unit: "mm",
      defaultValue: 80,
      min: 1,
      max: 1e3,
      tooltip: "Width of the power plane area"
    },
    {
      key: "dielectric",
      label: "Dielectric Thickness",
      symbol: "d",
      unit: "mm",
      defaultValue: 0.1,
      min: 0.01,
      max: 5,
      tooltip: "Distance between power and ground planes (core/prepreg thickness)"
    },
    {
      key: "er",
      label: "Dielectric Constant",
      symbol: "\u03B5r",
      unit: "",
      defaultValue: 4.4,
      min: 1,
      max: 20,
      tooltip: "PCB dielectric constant (FR4 = 4.3\u20134.8 at 1 MHz)"
    },
    {
      key: "frequency",
      label: "Frequency",
      symbol: "f",
      unit: "MHz",
      defaultValue: 100,
      min: 1e-3,
      max: 1e4,
      tooltip: "Frequency at which to evaluate plane impedance"
    }
  ],
  outputs: [
    {
      key: "capacitance",
      label: "Plane Capacitance",
      symbol: "C",
      unit: "nF",
      precision: 3,
      tooltip: "Distributed capacitance of the power-ground plane pair"
    },
    {
      key: "impedance",
      label: "Impedance at Frequency",
      symbol: "Z",
      unit: "m\u03A9",
      precision: 2,
      tooltip: "Inductive reactance of the plane at the given frequency"
    },
    {
      key: "resonantFrequency",
      label: "Self-Resonant Frequency",
      symbol: "f_res",
      unit: "MHz",
      precision: 1,
      tooltip: "Frequency at which plane capacitance resonates with plane inductance"
    },
    {
      key: "inductance",
      label: "Plane Inductance",
      symbol: "L_plane",
      unit: "nH",
      precision: 3,
      tooltip: "Approximate spreading inductance of the plane"
    }
  ],
  calculate: calculatePowerPlaneImpedance,
  formula: {
    primary: "C = \\frac{\\varepsilon_r \\varepsilon_0 A}{d},\\quad f_{res} = \\frac{1}{2\\pi\\sqrt{LC}}",
    variables: [
      { symbol: "\u03B5r", description: "Dielectric constant", unit: "" },
      { symbol: "A", description: "Plane area", unit: "m\xB2" },
      { symbol: "d", description: "Dielectric thickness", unit: "m" },
      { symbol: "f_res", description: "Self-resonant frequency", unit: "Hz" }
    ],
    reference: "IPC-2141A / Larry Smith PDN analysis techniques"
  },
  visualization: { type: "none" },
  relatedCalculators: ["decoupling-capacitor", "via-stub-resonance", "pcb-trace-inductance"]
};

// src/lib/calculators/pcb/via-stub-resonance.ts
function calculateViaStubResonance(inputs) {
  const { pcbThickness, layer, totalLayers, er } = inputs;
  if (pcbThickness <= 0) {
    return { values: {}, errors: ["PCB thickness must be positive"] };
  }
  if (layer <= 0 || layer > totalLayers) {
    return { values: {}, errors: ["Exit layer must be between 1 and total layers"] };
  }
  if (er <= 0) {
    return { values: {}, errors: ["Dielectric constant must be positive"] };
  }
  const stubLength = pcbThickness * (1 - layer / totalLayers);
  if (stubLength <= 0) {
    return {
      values: {
        stubLength: 0,
        resonantFreq: 0,
        notchDepth: 0,
        backdrillBenefit: 0
      }
    };
  }
  const c0 = 3e8;
  const vp = c0 / Math.sqrt(er);
  const resonantFreq = vp / (4 * stubLength * 1e-3) / 1e9;
  const notchDepth = -20;
  const backdrillBenefit = resonantFreq * 3;
  return {
    values: {
      stubLength,
      resonantFreq,
      notchDepth,
      backdrillBenefit
    }
  };
}
var viaStubResonance = {
  slug: "via-stub-resonance",
  title: "PCB Via Stub Resonance Calculator",
  shortTitle: "Via Stub Resonance",
  category: "pcb",
  description: "Calculate PCB via stub length, stub resonant frequency that causes signal notch, and frequency improvement from back-drilling.",
  keywords: ["via stub resonance", "pcb via backdrill", "via stub notch frequency", "high speed pcb via", "stub resonance signal integrity"],
  inputs: [
    {
      key: "pcbThickness",
      label: "PCB Thickness",
      symbol: "T_pcb",
      unit: "mm",
      defaultValue: 1.6,
      min: 0.1,
      max: 10,
      tooltip: "Total PCB board thickness"
    },
    {
      key: "layer",
      label: "Signal Exit Layer",
      symbol: "N_layer",
      unit: "",
      defaultValue: 4,
      min: 1,
      max: 32,
      step: 1,
      tooltip: "Layer number where the signal exits the via (counting from top, layer 1)"
    },
    {
      key: "totalLayers",
      label: "Total PCB Layers",
      symbol: "N_total",
      unit: "",
      defaultValue: 8,
      min: 2,
      max: 40,
      step: 2,
      tooltip: "Total number of PCB copper layers"
    },
    {
      key: "er",
      label: "Dielectric Constant",
      symbol: "\u03B5r",
      unit: "",
      defaultValue: 4.3,
      min: 1,
      max: 20,
      tooltip: "PCB dielectric constant (FR4 = 4.3\u20134.8)"
    }
  ],
  outputs: [
    {
      key: "stubLength",
      label: "Via Stub Length",
      symbol: "L_stub",
      unit: "mm",
      precision: 3,
      tooltip: "Length of the unused via stub below the signal exit layer"
    },
    {
      key: "resonantFreq",
      label: "Stub Resonant Frequency",
      symbol: "f_res",
      unit: "GHz",
      precision: 2,
      tooltip: "Quarter-wave resonant frequency of the via stub \u2014 causes signal notch",
      thresholds: {
        good: { min: 10 },
        warning: { min: 5, max: 10 },
        danger: { max: 5 }
      }
    },
    {
      key: "notchDepth",
      label: "Notch Depth (approx)",
      symbol: "Notch",
      unit: "dB",
      precision: 0,
      tooltip: "Approximate signal attenuation notch depth at resonance (~\u221220 dB)"
    },
    {
      key: "backdrillBenefit",
      label: "Post-Backdrill Frequency",
      symbol: "f_bd",
      unit: "GHz",
      precision: 2,
      tooltip: "Approximate resonance frequency improvement after back-drilling the stub"
    }
  ],
  calculate: calculateViaStubResonance,
  formula: {
    primary: "L_{stub} = T_{pcb}\\left(1-\\frac{N_{layer}}{N_{total}}\\right),\\quad f_{res} = \\frac{v_p}{4 L_{stub}}",
    variables: [
      { symbol: "L_stub", description: "Via stub length", unit: "mm" },
      { symbol: "vp", description: "Propagation velocity in dielectric", unit: "m/s" },
      { symbol: "\u03B5r", description: "Dielectric constant", unit: "" },
      { symbol: "f_res", description: "Quarter-wave resonant frequency", unit: "Hz" }
    ],
    reference: 'Eric Bogatin, "Signal and Power Integrity Simplified" 3rd ed.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["via-calculator", "power-plane-impedance", "controlled-impedance"]
};

// src/lib/calculators/pcb/solder-paste-volume.ts
function calculateSolderPasteVolume(inputs) {
  const { padLength, padWidth, stencilThickness, apertureReduction } = inputs;
  if (padLength <= 0 || padWidth <= 0) {
    return { values: {}, errors: ["Pad dimensions must be positive"] };
  }
  if (stencilThickness <= 0) {
    return { values: {}, errors: ["Stencil thickness must be positive"] };
  }
  if (apertureReduction < 0 || apertureReduction >= 100) {
    return { values: {}, errors: ["Aperture reduction must be 0-99%"] };
  }
  const reductionFactor = 1 - apertureReduction / 100;
  const apertureL = padLength * reductionFactor;
  const apertureW = padWidth * reductionFactor;
  const apertureArea = apertureL * apertureW;
  const pasteVolume = apertureArea * stencilThickness;
  const pasteVolumeMl = pasteVolume;
  const perimeter = 2 * (apertureL + apertureW);
  const areaRatio = apertureArea / (perimeter * stencilThickness);
  return {
    values: {
      apertureArea,
      pasteVolume,
      pasteVolumeMl,
      areaRatio
    }
  };
}
var solderPasteVolume = {
  slug: "solder-paste-volume",
  title: "Solder Paste Volume Calculator",
  shortTitle: "Solder Paste Volume",
  category: "pcb",
  description: "Calculate SMD solder paste volume, stencil aperture area, and IPC-7525A area ratio for stencil printing and reflow soldering process.",
  keywords: ["solder paste volume", "stencil aperture design", "solder paste calculator", "ipc-7525 area ratio", "smt stencil thickness"],
  inputs: [
    {
      key: "padLength",
      label: "Pad Length",
      symbol: "Lp",
      unit: "mm",
      defaultValue: 1.5,
      min: 0.05,
      max: 50,
      tooltip: "PCB pad length (in the direction of component lead)"
    },
    {
      key: "padWidth",
      label: "Pad Width",
      symbol: "Wp",
      unit: "mm",
      defaultValue: 0.8,
      min: 0.05,
      max: 50,
      tooltip: "PCB pad width"
    },
    {
      key: "stencilThickness",
      label: "Stencil Thickness",
      symbol: "t_stencil",
      unit: "mm",
      defaultValue: 0.12,
      min: 0.05,
      max: 1,
      tooltip: "Stencil foil thickness (typical: 0.10, 0.12, 0.15 mm)",
      presets: [
        { label: "0.10 mm (thin)", values: { stencilThickness: 0.1 } },
        { label: "0.12 mm (std)", values: { stencilThickness: 0.12 } },
        { label: "0.15 mm (thick)", values: { stencilThickness: 0.15 } }
      ]
    },
    {
      key: "apertureReduction",
      label: "Aperture Reduction",
      symbol: "AR%",
      unit: "%",
      defaultValue: 10,
      min: 0,
      max: 50,
      tooltip: "Aperture reduction from pad size per IPC-7525A (typically 10-20%)"
    }
  ],
  outputs: [
    {
      key: "apertureArea",
      label: "Aperture Area",
      symbol: "A_ap",
      unit: "mm\xB2",
      precision: 4,
      tooltip: "Stencil aperture area after reduction"
    },
    {
      key: "pasteVolume",
      label: "Paste Volume",
      symbol: "V_paste",
      unit: "mm\xB3",
      precision: 4,
      tooltip: "Volume of solder paste deposited per pad"
    },
    {
      key: "pasteVolumeMl",
      label: "Paste Volume",
      symbol: "V_paste",
      unit: "\u03BCL",
      precision: 4,
      tooltip: "Volume in microliters (1 mm\xB3 = 1 \u03BCL)"
    },
    {
      key: "areaRatio",
      label: "Area Ratio",
      symbol: "AR",
      unit: "",
      precision: 3,
      tooltip: "IPC-7525A area ratio \u2014 must be > 0.66 for acceptable paste release",
      thresholds: {
        good: { min: 0.66 },
        warning: { min: 0.5, max: 0.66 },
        danger: { max: 0.5 }
      }
    }
  ],
  calculate: calculateSolderPasteVolume,
  formula: {
    primary: "V = L_{ap} \\times W_{ap} \\times t_{stencil}",
    latex: "AR = \\frac{L_{ap} \\times W_{ap}}{2 \\times t_{stencil} \\times (L_{ap} + W_{ap})}",
    variables: [
      { symbol: "Lap, Wap", description: "Aperture length and width", unit: "mm" },
      { symbol: "t_stencil", description: "Stencil thickness", unit: "mm" },
      { symbol: "AR", description: "Area ratio (must be > 0.66)", unit: "" }
    ],
    reference: "IPC-7525A Stencil Design Guidelines"
  },
  visualization: { type: "none" },
  relatedCalculators: ["via-calculator", "trace-width-current", "via-stub-resonance"]
};

// src/lib/calculators/emc/emi-filter-lc.ts
function calculateEmiFilterLc(inputs) {
  const { fc, attenuationNeeded, zSource, zLoad } = inputs;
  if (fc <= 0) {
    return { values: {}, errors: ["Cutoff frequency must be positive"] };
  }
  if (zSource <= 0 || zLoad <= 0) {
    return { values: {}, errors: ["Source and load impedances must be positive"] };
  }
  const wc = 2 * Math.PI * fc * 1e3;
  const n = Math.ceil(attenuationNeeded / 20);
  const filterOrder = Math.max(2, n);
  const z0 = Math.sqrt(zSource * zLoad);
  const impedanceMatching = z0;
  const inductance = z0 / wc * 1e6;
  const capacitance = 1 / (z0 * wc) * 1e6;
  const actualAttenuation = filterOrder * 20 * Math.log10(10);
  return {
    values: {
      inductance,
      capacitance,
      filterOrder,
      actualAttenuation,
      impedanceMatching
    }
  };
}
var emiFilterLc = {
  slug: "emi-filter-lc",
  title: "LC EMI Filter Design Calculator",
  shortTitle: "LC EMI Filter",
  category: "emc",
  description: "Design an LC low-pass EMI filter for conducted emissions suppression \u2014 calculate inductance, capacitance, filter order, and attenuation at the stop band.",
  keywords: ["emi filter design", "lc filter emc", "conducted emissions filter", "cispr 22 filter", "emc low pass filter calculator"],
  inputs: [
    {
      key: "fc",
      label: "Cutoff Frequency",
      symbol: "fc",
      unit: "kHz",
      defaultValue: 150,
      min: 0.1,
      max: 1e5,
      tooltip: "Filter -3dB cutoff frequency (150 kHz = CISPR conducted emissions limit start)"
    },
    {
      key: "attenuationNeeded",
      label: "Required Attenuation",
      symbol: "A",
      unit: "dB",
      defaultValue: 40,
      min: 6,
      max: 120,
      tooltip: "Required attenuation at the cutoff frequency to meet EMC limits"
    },
    {
      key: "zSource",
      label: "Source Impedance",
      symbol: "Z_s",
      unit: "\u03A9",
      defaultValue: 50,
      min: 0.1,
      max: 1e4,
      tooltip: "Source impedance (50\u03A9 for LISN test environments)"
    },
    {
      key: "zLoad",
      label: "Load Impedance",
      symbol: "Z_L",
      unit: "\u03A9",
      defaultValue: 50,
      min: 0.1,
      max: 1e4,
      tooltip: "Load impedance"
    }
  ],
  outputs: [
    {
      key: "inductance",
      label: "Inductance",
      symbol: "L",
      unit: "\u03BCH",
      precision: 3,
      tooltip: "Filter inductor value per stage"
    },
    {
      key: "capacitance",
      label: "Capacitance",
      symbol: "C",
      unit: "\u03BCF",
      precision: 4,
      tooltip: "Filter capacitor value per stage"
    },
    {
      key: "filterOrder",
      label: "Filter Order",
      symbol: "n",
      unit: "",
      precision: 0,
      tooltip: "Number of LC stages required to achieve the specified attenuation"
    },
    {
      key: "actualAttenuation",
      label: "Attenuation at 10\xD7 fc",
      symbol: "A_actual",
      unit: "dB",
      precision: 1,
      tooltip: "Actual attenuation at 10\xD7 the cutoff frequency (one decade into stop band)"
    },
    {
      key: "impedanceMatching",
      label: "Matching Impedance",
      symbol: "Z0",
      unit: "\u03A9",
      precision: 2,
      tooltip: "Geometric mean impedance for filter matching"
    }
  ],
  calculate: calculateEmiFilterLc,
  exportComponents: (_inputs, outputs) => {
    const fmtC = (uf) => uf >= 1 ? `${+uf.toPrecision(3)} \u03BCF` : uf >= 1e-3 ? `${+(uf * 1e3).toPrecision(3)} nF` : `${+(uf * 1e6).toPrecision(3)} pF`;
    const fmtL = (uh) => uh >= 1 ? `${+uh.toPrecision(3)} \u03BCH` : `${+(uh * 1e3).toPrecision(3)} nH`;
    return [
      { qty: 2, description: "C (shunt)", value: fmtC(outputs.capacitance), package: "0402", componentType: "C", placement: "shunt" },
      { qty: 1, description: "L (series)", value: fmtL(outputs.inductance), package: "0402", componentType: "L", placement: "series" }
    ];
  },
  schematicSections: (_inputs, outputs) => {
    if (!outputs) return [];
    const fmtC = (uf) => uf >= 1 ? `${+uf.toPrecision(3)}\u03BCF` : uf >= 1e-3 ? `${+(uf * 1e3).toPrecision(3)}nF` : `${+(uf * 1e6).toPrecision(3)}pF`;
    const fmtL = (uh) => uh >= 1 ? `${+uh.toPrecision(3)}\u03BCH` : `${+(uh * 1e3).toPrecision(3)}nH`;
    const L = fmtL(outputs.inductance);
    const C = fmtC(outputs.capacitance);
    return [{
      label: "Pi LC EMI Filter",
      elements: [
        { type: "C", placement: "shunt", label: `C1 ${C}` },
        { type: "L", placement: "series", label: `L ${L}` },
        { type: "C", placement: "shunt", label: `C2 ${C}` }
      ]
    }];
  },
  formula: {
    primary: "L = \\frac{Z_0}{\\omega_c},\\quad C = \\frac{1}{Z_0 \\omega_c}",
    latex: "n = \\left\\lceil\\frac{A_{dB}}{20}\\right\\rceil",
    variables: [
      { symbol: "Z0", description: "Characteristic impedance", unit: "\u03A9" },
      { symbol: "\u03C9c", description: "Angular cutoff frequency", unit: "rad/s" },
      { symbol: "n", description: "Filter order", unit: "" }
    ],
    reference: 'Williams & Taylor, "Electronic Filter Design Handbook" 4th ed.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["ferrite-bead", "shielding-effectiveness", "esd-tvs-diode"]
};

// src/lib/calculators/emc/esd-tvs-diode.ts
function calculateEsdTvsDiode(inputs) {
  const { vwm, esd_level, clampMultiplier } = inputs;
  if (vwm <= 0) {
    return { values: {}, errors: ["Working voltage must be positive"] };
  }
  if (clampMultiplier < 1) {
    return { values: {}, errors: ["Clamp multiplier must be >= 1"] };
  }
  const level = Math.round(esd_level);
  if (level < 1 || level > 4) {
    return { values: {}, errors: ["ESD level must be 1-4"] };
  }
  const vBR = vwm * 1.1;
  const vclamp = vBR * clampMultiplier;
  const vpeakByLevel = {
    1: 2e3,
    // 2kV HBM
    2: 4e3,
    // 4kV HBM
    3: 8e3,
    // 8kV HBM
    4: 15e3
    // 15kV IEC 61000-4-2
  };
  const energyByLevel = {
    1: 0.5 * 1e-10 * 2e3 * 2e3 * 1e3,
    // = 0.2 mJ
    2: 0.5 * 1e-10 * 4e3 * 4e3 * 1e3,
    // = 0.8 mJ
    3: 0.5 * 1e-10 * 8e3 * 8e3 * 1e3,
    // = 3.2 mJ
    4: 0.5 * 15e-11 * 15e3 * 15e3 * 1e3
    // = 16.875 mJ
  };
  const energy = energyByLevel[level];
  const vp = vpeakByLevel[level];
  const ipp = vp / 1500;
  const ppwr = vclamp * ipp;
  return {
    values: {
      vclamp,
      vBR,
      ipp,
      ppwr,
      energy
    }
  };
}
var esdTvsDiode = {
  slug: "esd-tvs-diode",
  title: "ESD TVS Diode Selection Calculator",
  shortTitle: "ESD TVS Diode",
  category: "emc",
  description: "Calculate TVS diode clamping voltage, breakdown voltage, peak pulse current, and power rating for ESD protection circuit design.",
  keywords: ["tvs diode selection", "esd protection calculator", "transient voltage suppressor", "esd tvs diode rating", "iec 61000-4-2 esd"],
  inputs: [
    {
      key: "vwm",
      label: "Working Voltage",
      symbol: "Vwm",
      unit: "V",
      defaultValue: 5,
      min: 0.1,
      max: 400,
      tooltip: "Maximum continuous working voltage on the protected line"
    },
    {
      key: "esd_level",
      label: "ESD Level",
      symbol: "ESD",
      unit: "",
      defaultValue: 2,
      min: 1,
      max: 4,
      step: 1,
      tooltip: "1=2kV HBM, 2=4kV HBM, 3=8kV HBM, 4=15kV IEC 61000-4-2",
      presets: [
        { label: "2kV HBM", values: { esd_level: 1 } },
        { label: "4kV HBM", values: { esd_level: 2 } },
        { label: "8kV HBM", values: { esd_level: 3 } },
        { label: "15kV IEC", values: { esd_level: 4 } }
      ]
    },
    {
      key: "clampMultiplier",
      label: "Clamp Voltage Multiplier",
      symbol: "k_clamp",
      unit: "",
      defaultValue: 1.3,
      min: 1,
      max: 3,
      tooltip: "Ratio of clamp voltage to breakdown voltage \u2014 typical datasheet ratio 1.2-1.5"
    }
  ],
  outputs: [
    {
      key: "vclamp",
      label: "Clamp Voltage",
      symbol: "Vc",
      unit: "V",
      precision: 2,
      tooltip: "Maximum TVS clamp voltage \u2014 must be below protected IC maximum rating"
    },
    {
      key: "vBR",
      label: "Breakdown Voltage",
      symbol: "VBR",
      unit: "V",
      precision: 2,
      tooltip: "TVS breakdown voltage \u2014 select nearest standard value above this"
    },
    {
      key: "ipp",
      label: "Peak Pulse Current",
      symbol: "Ipp",
      unit: "A",
      precision: 2,
      tooltip: "Peak pulse current from ESD event (HBM: Vpeak / 1500\u03A9)"
    },
    {
      key: "ppwr",
      label: "Peak Pulse Power",
      symbol: "Ppwr",
      unit: "W",
      precision: 1,
      tooltip: "Peak pulse power the TVS must handle: Vc \xD7 Ipp"
    },
    {
      key: "energy",
      label: "ESD Energy",
      symbol: "E_esd",
      unit: "mJ",
      precision: 3,
      tooltip: "ESD event energy: E = 0.5 \xD7 C \xD7 V\xB2 (HBM: 100pF, IEC: 150pF)"
    }
  ],
  calculate: calculateEsdTvsDiode,
  formula: {
    primary: "V_{BR} = 1.1 \\times V_{wm},\\quad V_{clamp} = k_{clamp} \\times V_{BR}",
    latex: "I_{pp} = \\frac{V_{ESD}}{R_{HBM}},\\quad P_{pk} = V_{clamp} \\times I_{pp}",
    variables: [
      { symbol: "Vwm", description: "Working voltage", unit: "V" },
      { symbol: "VBR", description: "Breakdown voltage", unit: "V" },
      { symbol: "Vclamp", description: "Clamp voltage", unit: "V" },
      { symbol: "R_HBM", description: "HBM discharge resistance 1500\u03A9", unit: "\u03A9" }
    ],
    reference: "JEDEC JESD22-A114 HBM / IEC 61000-4-2"
  },
  visualization: { type: "none" },
  relatedCalculators: ["emi-filter-lc", "shielding-effectiveness", "ferrite-bead"]
};

// src/lib/calculators/emc/common-mode-choke.ts
function calculateCommonModeChoke(inputs) {
  const { inductance, frequency, dcr } = inputs;
  const inductanceH = inductance * 1e-6;
  const impedance = 2 * Math.PI * frequency * inductanceH;
  const attenuation = 20 * Math.log10((impedance + 50) / 50);
  const qualityFactor = impedance / dcr;
  return { values: { impedance, attenuation, qualityFactor } };
}
var commonModeChoke = {
  slug: "common-mode-choke",
  title: "Common Mode Choke Impedance",
  shortTitle: "CMC Impedance",
  category: "emc",
  description: "Calculate common mode choke impedance, insertion loss, and Q factor at a given frequency for EMC filter design.",
  keywords: ["common mode choke", "CMC impedance", "common mode filter", "EMC choke", "differential mode", "choke impedance"],
  inputs: [
    { key: "inductance", label: "Inductance", symbol: "L", unit: "\u03BCH", defaultValue: 1e3, min: 0.1 },
    { key: "frequency", label: "Frequency", symbol: "f", unit: "Hz", defaultValue: 15e4, min: 1, tooltip: "CISPR 25 conducted emissions start at 150 kHz" },
    { key: "dcr", label: "DC Resistance (DCR)", symbol: "R_DC", unit: "\u03A9", defaultValue: 0.5, min: 1e-3 }
  ],
  outputs: [
    { key: "impedance", label: "Impedance |Z|", symbol: "Z", unit: "\u03A9", precision: 0 },
    { key: "attenuation", label: "Insertion Loss", symbol: "IL", unit: "dB", precision: 1 },
    { key: "qualityFactor", label: "Q Factor", symbol: "Q", unit: "", precision: 1 }
  ],
  calculate: calculateCommonModeChoke,
  formula: {
    primary: "Z = 2\u03C0 \xD7 f \xD7 L,  IL = 20\xB7log\u2081\u2080((Z+50)/50)",
    variables: [
      { symbol: "L", description: "Inductance", unit: "H" },
      { symbol: "f", description: "Frequency", unit: "Hz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["ferrite-bead", "emi-filter-lc", "differential-mode-filter"]
};

// src/lib/calculators/emc/decoupling-capacitor-emc.ts
var decouplingCapacitorEmc = {
  slug: "decoupling-capacitor-emc",
  title: "Decoupling Capacitor EMC Selection",
  shortTitle: "Decoupling Cap EMC",
  category: "emc",
  description: "Calculate decoupling capacitor impedance at frequency and self-resonant frequency for EMC power supply decoupling.",
  keywords: ["decoupling capacitor EMC", "bypass capacitor", "capacitor self resonant frequency", "ESR capacitor", "power supply decoupling EMC", "SRF capacitor"],
  inputs: [
    { key: "capacitance", label: "Capacitance", symbol: "C", unit: "nF", defaultValue: 100, min: 1e-3 },
    { key: "esr", label: "ESR", symbol: "R_ESR", unit: "\u03A9", defaultValue: 0.05, min: 1e-3, step: 1e-3, tooltip: "Equivalent series resistance from datasheet" },
    { key: "frequency", label: "Target Frequency", symbol: "f", unit: "kHz", defaultValue: 100, min: 1e-3 },
    {
      key: "packageInductance",
      label: "Package Inductance",
      symbol: "L_pkg",
      unit: "nH",
      defaultValue: 1,
      min: 0.1,
      max: 20,
      presets: [
        { label: "0402", values: { packageInductance: 0.4 } },
        { label: "0603", values: { packageInductance: 0.6 } },
        { label: "0805", values: { packageInductance: 0.8 } },
        { label: "1206", values: { packageInductance: 2 } }
      ]
    }
  ],
  outputs: [
    { key: "xc", label: "Capacitive Reactance", symbol: "Xc", unit: "\u03A9", precision: 3 },
    { key: "impedance", label: "Total Impedance |Z|", symbol: "|Z|", unit: "\u03A9", precision: 3 },
    { key: "srf", label: "Self-Resonant Freq.", symbol: "f_SRF", unit: "MHz", precision: 1 }
  ],
  calculate: (inputs) => {
    const { capacitance, esr, frequency, packageInductance } = inputs;
    const capF = capacitance * 1e-9;
    const freqHz = frequency * 1e3;
    const xc = 1 / (2 * Math.PI * freqHz * capF);
    const impedance = Math.sqrt(xc ** 2 + esr ** 2);
    const packageInductanceH = packageInductance / 1e9;
    const srf = 1 / (2 * Math.PI * Math.sqrt(capF * packageInductanceH)) / 1e6;
    return { values: { xc, impedance, srf } };
  },
  formula: {
    primary: "Xc = 1/(2\u03C0fC),  f_SRF = 1/(2\u03C0\u221ALC)",
    variables: [
      { symbol: "C", description: "Capacitance", unit: "F" },
      { symbol: "L", description: "Package inductance (varies by package)", unit: "H" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["emi-filter-lc", "common-mode-choke", "conducted-emissions-filter"]
};

// src/lib/calculators/emc/esd-clamp-selection.ts
function calculateEsdClampSelection(inputs) {
  const { esdVoltage, clampVoltage, lineImpedance } = inputs;
  if (lineImpedance <= 0) {
    return { values: {}, errors: ["Line impedance must be greater than 0"] };
  }
  if (clampVoltage >= esdVoltage) {
    return { values: {}, errors: ["Clamp voltage must be less than ESD voltage for clamping to occur"] };
  }
  const peakCurrent = (esdVoltage - clampVoltage) / lineImpedance;
  const clampPower = clampVoltage * peakCurrent;
  const voltageMargin = esdVoltage - clampVoltage;
  const clampingRatio = clampVoltage / esdVoltage;
  return { values: { peakCurrent, clampPower, voltageMargin, clampingRatio } };
}
var esdClampSelection = {
  slug: "esd-clamp-selection",
  title: "ESD Clamp Diode Selection",
  shortTitle: "ESD Clamp",
  category: "emc",
  description: "Calculate ESD clamp diode peak current, power dissipation, and clamping ratio to verify protection for IEC 61000-4-2 compliance.",
  keywords: ["ESD clamp", "TVS diode ESD", "ESD protection", "IEC 61000-4-2", "ESD clamp selection", "surge protection"],
  inputs: [
    { key: "esdVoltage", label: "ESD Strike Voltage", symbol: "V_ESD", unit: "V", defaultValue: 4e3, min: 100, tooltip: "IEC 61000-4-2 Level 4: \xB18 kV contact" },
    { key: "clampVoltage", label: "Clamp Voltage (V_cl)", symbol: "V_cl", unit: "V", defaultValue: 15, min: 1, tooltip: "TVS clamping voltage at peak current from datasheet" },
    { key: "lineImpedance", label: "Line Impedance", symbol: "Z", unit: "\u03A9", defaultValue: 330, min: 0.1, tooltip: "Series resistance in ESD discharge path" }
  ],
  outputs: [
    { key: "peakCurrent", label: "Peak Clamp Current", symbol: "I_pk", unit: "A", precision: 1 },
    { key: "clampPower", label: "Peak Power Dissipation", symbol: "P_pk", unit: "W", precision: 0 },
    { key: "voltageMargin", label: "Voltage Margin", symbol: "\u0394V", unit: "V", precision: 0 },
    { key: "clampingRatio", label: "Clamping Ratio", symbol: "V_cl/V_ESD", unit: "", precision: 3 }
  ],
  calculate: calculateEsdClampSelection,
  formula: {
    primary: "I_pk = (V_ESD \u2212 V_cl) / Z,  P_pk = V_cl \xD7 I_pk",
    variables: [
      { symbol: "V_cl", description: "Clamp voltage", unit: "V" },
      { symbol: "Z", description: "Discharge path impedance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["esd-tvs-diode", "shielding-effectiveness", "emi-margin-budget"]
};

// src/lib/calculators/emc/radiated-emission-estimate.ts
var radiatedEmissionEstimate = {
  slug: "radiated-emission-estimate",
  title: "Radiated Emission Estimate",
  shortTitle: "Radiated Emissions",
  category: "emc",
  description: "Estimate far-field radiated emissions from a PCB current loop using the small-loop antenna model. Compare against CISPR 22/FCC Class B limits.",
  keywords: ["radiated emissions", "EMC radiated", "CISPR 22", "FCC radiated emissions", "PCB emissions estimate", "loop antenna emissions"],
  inputs: [
    { key: "current", label: "Loop Current (peak)", symbol: "I", unit: "mA", defaultValue: 10, min: 1e-3 },
    { key: "loopArea", label: "Loop Area", symbol: "A", unit: "cm\xB2", defaultValue: 1, min: 1e-3, tooltip: "Area enclosed by the current loop on PCB" },
    { key: "frequency", label: "Frequency", symbol: "f", unit: "MHz", defaultValue: 100, min: 0.01 },
    { key: "distance", label: "Measurement Distance", symbol: "r", unit: "m", defaultValue: 3, min: 0.1, tooltip: "CISPR 22 standard: 3 m or 10 m" }
  ],
  outputs: [
    { key: "eFieldDbuvM", label: "E-Field", symbol: "E", unit: "dB\u03BCV/m", precision: 1 },
    { key: "margin", label: "Margin vs CISPR 22 Class B", symbol: "M", unit: "dB", precision: 1, thresholds: { good: { min: 6 }, warning: { min: 0 } } }
  ],
  calculate: (inputs) => {
    const { current, loopArea, frequency, distance } = inputs;
    const currentA = current / 1e3;
    const areaM2 = loopArea * 1e-4;
    const freqMhz = frequency;
    const eField = 263 * freqMhz ** 2 * areaM2 * currentA / distance;
    const eFieldDbuvM = eField > 0 ? 20 * Math.log10(eField * 1e6) : -200;
    const cispr22Limit = 40;
    const margin = cispr22Limit - eFieldDbuvM;
    const warnings = [];
    if (Math.abs(distance - 3) > 0.5) {
      warnings.push("CISPR 22 Class B limit of 40 dB\u03BCV/m applies at 3 m. Results at other distances require limit normalization.");
    }
    return { values: { eFieldDbuvM, margin }, ...warnings.length > 0 && { warnings } };
  },
  formula: {
    primary: "E \u2248 263 \xD7 f\xB2 \xD7 A \xD7 I / r  [V/m, f in MHz, A in m\xB2]",
    variables: [
      { symbol: "f", description: "Frequency", unit: "MHz" },
      { symbol: "A", description: "Loop area", unit: "m\xB2" },
      { symbol: "I", description: "Loop current (peak)", unit: "A" },
      { symbol: "r", description: "Distance", unit: "m" }
    ],
    reference: "Henry Ott, Electromagnetic Compatibility Engineering"
  },
  visualization: { type: "none" },
  relatedCalculators: ["shielding-effectiveness", "emi-margin-budget", "ground-plane-impedance"]
};

// src/lib/calculators/emc/ground-plane-impedance.ts
function calculateGroundPlaneImpedance(inputs) {
  const { length, width, thickness, frequency, conductivity } = inputs;
  const resistivity = 1 / (conductivity * 1e6);
  const dcResistance = resistivity * length * 1e-3 / (width * 1e-3 * thickness * 1e-6);
  const mu0 = 4 * Math.PI * 1e-7;
  const freqHz = frequency * 1e6;
  const skinDepth2 = 1 / Math.sqrt(Math.PI * freqHz * mu0 * conductivity * 1e6);
  const tOverDelta = thickness * 1e-6 / skinDepth2;
  const acResistance = dcResistance * Math.max(1, tOverDelta / 2);
  const inductance = mu0 * length * 1e-3 / (width * 1e-3) * 1e9;
  const inductiveReactance = 2 * Math.PI * freqHz * inductance * 1e-9;
  const totalImpedance = Math.sqrt(acResistance ** 2 + inductiveReactance ** 2);
  return {
    values: {
      dcResistance: dcResistance * 1e3,
      // mΩ
      skinDepth: skinDepth2 * 1e6,
      // μm
      acResistance: acResistance * 1e3,
      // mΩ
      inductance,
      // nH
      totalImpedance: totalImpedance * 1e3
      // mΩ
    }
  };
}
var groundPlaneImpedance = {
  slug: "ground-plane-impedance",
  title: "Ground Plane Impedance vs Frequency",
  shortTitle: "Ground Impedance",
  category: "emc",
  description: "Calculate PCB ground plane AC impedance, skin depth, and inductive reactance at high frequencies for EMC analysis.",
  keywords: ["ground plane impedance", "ground plane EMC", "skin depth PCB", "ground inductance", "AC ground resistance", "PCB ground return"],
  inputs: [
    { key: "length", label: "Plane Length", symbol: "L", unit: "mm", defaultValue: 100, min: 1 },
    { key: "width", label: "Plane Width", symbol: "W", unit: "mm", defaultValue: 50, min: 0.1 },
    {
      key: "thickness",
      label: "Copper Thickness",
      symbol: "t",
      unit: "\u03BCm",
      defaultValue: 35,
      min: 1,
      presets: [
        { label: "0.5 oz (17.5 \u03BCm)", values: { thickness: 17.5 } },
        { label: "1 oz (35 \u03BCm)", values: { thickness: 35 } }
      ]
    },
    { key: "frequency", label: "Frequency", symbol: "f", unit: "MHz", defaultValue: 10, min: 1e-3 },
    { key: "conductivity", label: "Conductivity", symbol: "\u03C3", unit: "MS/m", defaultValue: 58, min: 0.1, tooltip: "Copper: 58 MS/m, Aluminium: 37 MS/m" }
  ],
  outputs: [
    { key: "dcResistance", label: "DC Resistance", symbol: "R_DC", unit: "m\u03A9", precision: 2 },
    { key: "skinDepth", label: "Skin Depth", symbol: "\u03B4", unit: "\u03BCm", precision: 2 },
    { key: "acResistance", label: "AC Resistance", symbol: "R_AC", unit: "m\u03A9", precision: 2 },
    { key: "inductance", label: "Plane Inductance", symbol: "L", unit: "nH", precision: 2 },
    { key: "totalImpedance", label: "Total Impedance |Z|", symbol: "|Z|", unit: "m\u03A9", precision: 2 }
  ],
  calculate: calculateGroundPlaneImpedance,
  formula: {
    primary: "\u03B4 = 1/\u221A(\u03C0f\u03BC\u03C3),  R_AC = R_DC \xD7 t/(2\u03B4)",
    variables: [
      { symbol: "\u03B4", description: "Skin depth", unit: "m" },
      { symbol: "\u03C3", description: "Conductivity", unit: "S/m" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["radiated-emission-estimate", "shielding-effectiveness", "emi-margin-budget"]
};

// src/lib/calculators/emc/pcb-crosstalk-emc.ts
function calculatePcbCrosstalkEmc(inputs) {
  const { aggressorVoltage, mutualCapacitance, mutualInductance, frequency, lineImpedance } = inputs;
  const freqHz = frequency * 1e6;
  const capacitiveCoupling = aggressorVoltage * mutualCapacitance * 1e-12 * 2 * Math.PI * freqHz * lineImpedance;
  const inductiveCoupling = mutualInductance * 1e-9 * 2 * Math.PI * freqHz * (aggressorVoltage / lineImpedance);
  const totalCrosstalk = Math.sqrt(capacitiveCoupling ** 2 + inductiveCoupling ** 2);
  const crosstalkDb = totalCrosstalk > 0 ? 20 * Math.log10(totalCrosstalk / aggressorVoltage) : -100;
  return {
    values: {
      capacitiveCoupling: capacitiveCoupling * 1e3,
      inductiveCoupling: inductiveCoupling * 1e3,
      totalCrosstalk: totalCrosstalk * 1e3,
      crosstalkDb
    }
  };
}
var pcbCrosstalkEmc = {
  slug: "pcb-crosstalk-emc",
  title: "PCB Trace Crosstalk (EMC)",
  shortTitle: "PCB Crosstalk EMC",
  category: "emc",
  description: "Estimate PCB trace crosstalk (capacitive and inductive coupling) for EMC pre-compliance analysis.",
  keywords: ["PCB crosstalk EMC", "trace coupling", "capacitive coupling PCB", "inductive coupling PCB", "EMC crosstalk", "PCB EMC"],
  inputs: [
    { key: "aggressorVoltage", label: "Aggressor Voltage", symbol: "V_A", unit: "V", defaultValue: 3.3, min: 1e-3 },
    { key: "mutualCapacitance", label: "Mutual Capacitance", symbol: "C_m", unit: "pF", defaultValue: 20, min: 1e-3, tooltip: "Total mutual capacitance between traces (pF)" },
    { key: "mutualInductance", label: "Mutual Inductance", symbol: "L_m", unit: "nH", defaultValue: 10, min: 1e-3, tooltip: "Total mutual inductance between traces (nH)" },
    { key: "frequency", label: "Frequency", symbol: "f", unit: "MHz", defaultValue: 100, min: 1e-3 },
    { key: "lineImpedance", label: "Victim Line Impedance", symbol: "Z", unit: "\u03A9", defaultValue: 50, min: 1 }
  ],
  outputs: [
    { key: "capacitiveCoupling", label: "Capacitive Coupling", symbol: "V_cap", unit: "mV", precision: 2 },
    { key: "inductiveCoupling", label: "Inductive Coupling", symbol: "V_ind", unit: "mV", precision: 2 },
    { key: "totalCrosstalk", label: "Total Crosstalk", symbol: "V_xt", unit: "mV", precision: 2 },
    { key: "crosstalkDb", label: "Crosstalk Coupling", symbol: "XT", unit: "dB", precision: 1 }
  ],
  calculate: calculatePcbCrosstalkEmc,
  formula: {
    primary: "V_cap = V_A \xD7 C_m \xD7 2\u03C0f \xD7 Z,  V_ind = L_m \xD7 2\u03C0f \xD7 (V_A/Z)",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["ground-plane-impedance", "radiated-emission-estimate", "shielding-effectiveness"]
};

// src/lib/calculators/emc/power-supply-ripple-filter.ts
var powerSupplyRippleFilter = {
  slug: "power-supply-ripple-filter",
  title: "Power Supply Ripple Filter",
  shortTitle: "Ripple Filter",
  category: "emc",
  description: "Calculate LC filter attenuation and output ripple voltage for power supply EMC filtering. Find the resonant frequency and ripple rejection.",
  keywords: ["power supply ripple filter", "LC filter ripple", "ripple rejection", "power supply EMC", "LC EMI filter", "ripple voltage filter"],
  inputs: [
    { key: "inputRipple", label: "Input Ripple Voltage", symbol: "V_ripple", unit: "mV", defaultValue: 100, min: 1e-3 },
    { key: "frequency", label: "Ripple Frequency", symbol: "f", unit: "kHz", defaultValue: 100, min: 1e-3 },
    { key: "inductance", label: "Inductor Value", symbol: "L", unit: "\u03BCH", defaultValue: 10, min: 1e-3 },
    { key: "capacitance", label: "Capacitor Value", symbol: "C", unit: "\u03BCF", defaultValue: 10, min: 1e-3 }
  ],
  outputs: [
    { key: "resonantFreq", label: "Filter Resonant Frequency", symbol: "f\u2080", unit: "kHz", precision: 1 },
    { key: "attenuation", label: "Attenuation", symbol: "A", unit: "dB", precision: 1 },
    { key: "outputRipple", label: "Output Ripple", symbol: "V_out", unit: "mV", precision: 3 }
  ],
  calculate: (inputs) => {
    const { inputRipple, frequency, inductance, capacitance } = inputs;
    const lH = inductance * 1e-6;
    const cF = capacitance * 1e-6;
    const freqHz = frequency * 1e3;
    const resonantFreq = 1 / (2 * Math.PI * Math.sqrt(lH * cF)) / 1e3;
    const freqRatio = freqHz / (resonantFreq * 1e3);
    const attenuation = freqRatio > 1 ? -40 * Math.log10(freqRatio) : 0;
    const outputRipple = inputRipple * Math.pow(10, attenuation / 20);
    return { values: { resonantFreq, attenuation, outputRipple } };
  },
  formula: {
    primary: "f\u2080 = 1/(2\u03C0\u221ALC),  A = \u221240\xB7log\u2081\u2080(f/f\u2080) dB",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["emi-filter-lc", "conducted-emissions-filter", "common-mode-choke"]
};

// src/lib/calculators/emc/cable-shield-effectiveness.ts
var cableShieldEffectiveness = {
  slug: "cable-shield-effectiveness",
  title: "Cable Shield Effectiveness",
  shortTitle: "Cable Shield",
  category: "emc",
  description: "Calculate coaxial cable or shielded cable shield effectiveness (shielding factor) vs frequency using the transfer impedance model.",
  keywords: ["cable shield", "shielding effectiveness cable", "transfer impedance", "coaxial shield", "EMC cable shielding", "cable shield dB"],
  inputs: [
    { key: "shieldResistance", label: "Shield DC Resistance", symbol: "R_sh", unit: "m\u03A9/m", defaultValue: 10, min: 1e-3, tooltip: "Per metre, from cable datasheet" },
    { key: "cableLength", label: "Cable Length", symbol: "l", unit: "m", defaultValue: 2, min: 0.01 },
    { key: "frequency", label: "Frequency", symbol: "f", unit: "MHz", defaultValue: 10, min: 1e-3 }
  ],
  outputs: [
    { key: "shieldingEffectDb", label: "Shielding Effectiveness", symbol: "SE", unit: "dB", precision: 1, thresholds: { good: { min: 40 }, warning: { min: 20 } } },
    { key: "transferImpedance", label: "Transfer Impedance", symbol: "Z_t", unit: "m\u03A9", precision: 2 }
  ],
  calculate: (inputs) => {
    const { shieldResistance, cableLength, frequency } = inputs;
    const ztDcMohm = shieldResistance * cableLength;
    const freqMhz = frequency;
    const ztAc = ztDcMohm * Math.sqrt(1 + (freqMhz / 10) ** 2);
    const shieldingEffectDb = Math.max(0, 40 - 20 * Math.log10(ztAc / 10));
    return { values: { shieldingEffectDb, transferImpedance: ztAc } };
  },
  formula: {
    primary: "SE = 20\xB7log\u2081\u2080(V_no-shield / V_shield)",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["shielding-effectiveness", "radiated-emission-estimate", "emi-margin-budget"]
};

// src/lib/calculators/emc/chassis-resonance.ts
var chassisResonance = {
  slug: "chassis-resonance",
  title: "Chassis Resonant Frequency",
  shortTitle: "Chassis Resonance",
  category: "emc",
  description: "Calculate the lowest resonant frequency of a metallic enclosure (cavity resonator) to identify potential EMC problems.",
  keywords: ["chassis resonance", "enclosure resonance", "cavity resonator", "EMC chassis", "metal box resonance", "shielding resonance"],
  inputs: [
    { key: "length", label: "Length", symbol: "a", unit: "cm", defaultValue: 30, min: 0.1 },
    { key: "width", label: "Width", symbol: "b", unit: "cm", defaultValue: 20, min: 0.1 },
    { key: "height", label: "Height", symbol: "c", unit: "cm", defaultValue: 10, min: 0.1 }
  ],
  outputs: [
    { key: "fLowest", label: "Lowest Resonant Frequency", symbol: "f_min", unit: "MHz", precision: 0 },
    { key: "f101MHz", label: "TE\u2081\u2080\u2081 Mode", symbol: "f_TE101", unit: "MHz", precision: 0 },
    { key: "f110MHz", label: "TE\u2081\u2081\u2080 Mode", symbol: "f_TE110", unit: "MHz", precision: 0 },
    { key: "wavelengthAtResonance", label: "Wavelength at f_min", symbol: "\u03BB", unit: "cm", precision: 0 }
  ],
  calculate: (inputs) => {
    const { length, width, height } = inputs;
    const c = 3e10;
    const f101 = c / 2 * Math.sqrt((1 / length) ** 2 + (1 / height) ** 2);
    const f110 = c / 2 * Math.sqrt((1 / length) ** 2 + (1 / width) ** 2);
    const fLowest = Math.min(f101, f110) / 1e6;
    const wavelengthAtResonance = c / (fLowest * 1e6);
    return { values: { fLowest, f101MHz: f101 / 1e6, f110MHz: f110 / 1e6, wavelengthAtResonance } };
  },
  formula: {
    primary: "f_mnp = (c/2)\u221A((m/a)\xB2 + (n/b)\xB2 + (p/c)\xB2)",
    variables: [
      { symbol: "a,b,c", description: "Chassis dimensions", unit: "m" },
      { symbol: "m,n,p", description: "Mode indices", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["shielding-effectiveness", "radiated-emission-estimate", "ground-plane-impedance"]
};

// src/lib/calculators/emc/emi-margin-budget.ts
function calculateEmiMarginBudget(inputs) {
  const { measuredLevel, limitLevel, measurementUncertainty, safetyMargin } = inputs;
  const rawMargin = limitLevel - measuredLevel;
  const adjustedMargin = rawMargin - measurementUncertainty - safetyMargin;
  const requiredReduction = adjustedMargin < 0 ? Math.abs(adjustedMargin) : 0;
  return { values: { rawMargin, adjustedMargin, requiredReduction } };
}
var emiMarginBudget = {
  slug: "emi-margin-budget",
  title: "EMI Margin Budget",
  shortTitle: "EMI Margin",
  category: "emc",
  description: "Calculate EMI compliance margin accounting for measurement uncertainty and safety margin to predict pre-compliance test pass/fail.",
  keywords: ["EMI margin", "EMC compliance margin", "pre-compliance testing", "EMI budget", "CISPR margin", "EMC safety margin"],
  inputs: [
    { key: "measuredLevel", label: "Measured Emission Level", symbol: "E_meas", unit: "dB\u03BCV/m", defaultValue: 30, min: -100 },
    { key: "limitLevel", label: "Regulatory Limit", symbol: "E_limit", unit: "dB\u03BCV/m", defaultValue: 40, min: -100, tooltip: "CISPR 22 Class B radiated: 40 dB\u03BCV/m (30\u2013230 MHz) at 3m" },
    { key: "measurementUncertainty", label: "Measurement Uncertainty", symbol: "U", unit: "dB", defaultValue: 6, min: 0, tooltip: "Typically 6 dB for pre-compliance setups" },
    { key: "safetyMargin", label: "Design Safety Margin", symbol: "SM", unit: "dB", defaultValue: 6, min: 0 }
  ],
  outputs: [
    { key: "rawMargin", label: "Raw Margin", symbol: "M_raw", unit: "dB", precision: 1 },
    { key: "adjustedMargin", label: "Adjusted Margin", symbol: "M_adj", unit: "dB", precision: 1, thresholds: { good: { min: 0 } } },
    { key: "requiredReduction", label: "Reduction Required", symbol: "\u0394E", unit: "dB", precision: 1 }
  ],
  calculate: calculateEmiMarginBudget,
  formula: {
    primary: "M_adj = (E_limit \u2212 E_meas) \u2212 U \u2212 SM",
    variables: [
      { symbol: "U", description: "Measurement uncertainty", unit: "dB" },
      { symbol: "SM", description: "Safety margin", unit: "dB" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["radiated-emission-estimate", "shielding-effectiveness", "esd-clamp-selection"]
};

// src/lib/calculators/emc/conducted-emissions-filter.ts
function calculateConductedEmissionsFilter(inputs) {
  const { emissionLevel, frequency, targetAttenuation, loadImpedance } = inputs;
  if (targetAttenuation <= 0) {
    return { values: {}, errors: ["Target attenuation must be greater than 0 dB for meaningful filter design"] };
  }
  const freqHz = frequency * 1e3;
  const requiredF0 = freqHz / Math.pow(10, targetAttenuation / 40);
  const lcProduct = 1 / (2 * Math.PI * requiredF0) ** 2;
  const cValue = Math.sqrt(lcProduct / loadImpedance) * 1e6;
  const lValue = Math.sqrt(lcProduct * loadImpedance) * 1e6;
  const outputLevel = emissionLevel - targetAttenuation;
  return { values: { requiredF0: requiredF0 / 1e3, cValue, lValue, outputLevel } };
}
var conductedEmissionsFilter = {
  slug: "conducted-emissions-filter",
  title: "Conducted Emissions LC Filter",
  shortTitle: "Conducted EMI Filter",
  category: "emc",
  description: "Design an LC filter to meet CISPR 22/FCC conducted emissions limits by calculating required L and C values for a target attenuation.",
  keywords: ["conducted emissions filter", "EMI filter design", "CISPR conducted", "LC EMI filter", "line filter EMC", "conducted emissions SMPS"],
  inputs: [
    { key: "emissionLevel", label: "Measured Emission", symbol: "V_emi", unit: "dB\u03BCV", defaultValue: 80, min: 0, tooltip: "CISPR 22 Class B limit: 66 dB\u03BCV at 150 kHz" },
    { key: "frequency", label: "Problem Frequency", symbol: "f", unit: "kHz", defaultValue: 150, min: 0.1 },
    { key: "targetAttenuation", label: "Required Attenuation", symbol: "A", unit: "dB", defaultValue: 20, min: 0 },
    { key: "loadImpedance", label: "Load Impedance", symbol: "Z_L", unit: "\u03A9", defaultValue: 50, min: 0.1 }
  ],
  outputs: [
    { key: "requiredF0", label: "Filter Corner Frequency", symbol: "f\u2080", unit: "kHz", precision: 1 },
    { key: "cValue", label: "Capacitor Value", symbol: "C", unit: "\u03BCF", precision: 3 },
    { key: "lValue", label: "Inductor Value", symbol: "L", unit: "\u03BCH", precision: 2 },
    { key: "outputLevel", label: "Output Emission Level", symbol: "V_out", unit: "dB\u03BCV", precision: 1 }
  ],
  calculate: calculateConductedEmissionsFilter,
  formula: {
    primary: "f\u2080 = f / 10^(A/40),  L = Z\u221A(1/(2\u03C0f\u2080)\xB2/Z)",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["emi-filter-lc", "power-supply-ripple-filter", "common-mode-choke"],
  exportComponents: (_inputs, outputs) => {
    const l = outputs?.lValue ?? 0;
    const c = outputs?.cValue ?? 0;
    const fmtL = (uh) => uh >= 1e3 ? `${+(uh / 1e3).toPrecision(3)} mH` : `${+uh.toPrecision(3)} \u03BCH`;
    const fmtC = (uf) => uf >= 1 ? `${+uf.toPrecision(3)} \u03BCF` : `${+(uf * 1e3).toPrecision(3)} nF`;
    return [
      { qty: 1, description: "L (series filter)", value: fmtL(l), package: "0402", componentType: "L", placement: "series" },
      { qty: 1, description: "C (shunt filter)", value: fmtC(c), package: "0402", componentType: "C", placement: "shunt" }
    ];
  }
};

// src/lib/calculators/emc/differential-mode-filter.ts
function calculateDifferentialModeFilter(inputs) {
  const { inductance, capacitance, frequency } = inputs;
  const lH = inductance * 1e-6;
  const cF = capacitance * 1e-6;
  const cornerFreq = 1 / (2 * Math.PI * Math.sqrt(lH * cF));
  const freqHz = frequency * 1e3;
  const frequencyRatio = freqHz / cornerFreq;
  const attenuation = frequencyRatio > 1 ? -40 * Math.log10(frequencyRatio) : 0;
  const characteristicImpedance = Math.sqrt(lH / cF);
  return { values: { cornerFreq: cornerFreq / 1e3, attenuation, characteristicImpedance } };
}
var differentialModeFilter = {
  slug: "differential-mode-filter",
  title: "Differential Mode EMI Filter",
  shortTitle: "DM EMI Filter",
  category: "emc",
  description: "Design a differential mode LC EMI filter: calculate corner frequency, attenuation, and characteristic impedance for SMPS output filtering.",
  keywords: ["differential mode filter", "DM EMI filter", "differential mode noise", "SMPS EMI filter", "EMI filter differential", "power line filter"],
  inputs: [
    { key: "inductance", label: "Differential Mode Inductance", symbol: "L_DM", unit: "\u03BCH", defaultValue: 47, min: 1e-3 },
    { key: "capacitance", label: "Differential Mode Capacitance", symbol: "C_DM", unit: "\u03BCF", defaultValue: 0.47, min: 1e-3 },
    { key: "frequency", label: "Problem Frequency", symbol: "f", unit: "kHz", defaultValue: 150, min: 1e-3 }
  ],
  outputs: [
    { key: "cornerFreq", label: "Corner Frequency", symbol: "f\u2080", unit: "kHz", precision: 1 },
    { key: "attenuation", label: "Attenuation at f", symbol: "A", unit: "dB", precision: 1 },
    { key: "characteristicImpedance", label: "Characteristic Impedance", symbol: "Z\u2080", unit: "\u03A9", precision: 1 }
  ],
  calculate: calculateDifferentialModeFilter,
  formula: {
    primary: "f\u2080 = 1/(2\u03C0\u221AL_DM C_DM)",
    variables: []
  },
  visualization: { type: "none" },
  relatedCalculators: ["common-mode-choke", "conducted-emissions-filter", "emi-filter-lc"]
};

// src/lib/calculators/audio/audio-power-amplifier.ts
function calculateAudioPowerAmplifier(inputs) {
  const { vcc, rl, efficiency, gain } = inputs;
  if (vcc <= 0) {
    return { values: {}, errors: ["Supply voltage must be positive"] };
  }
  if (rl <= 0) {
    return { values: {}, errors: ["Speaker impedance must be positive"] };
  }
  if (efficiency <= 0 || efficiency > 100) {
    return { values: {}, errors: ["Efficiency must be between 0 and 100%"] };
  }
  const voutPeak = vcc * 0.9 / 2;
  const poutMax = voutPeak * voutPeak / (2 * rl);
  const poutRms = poutMax / 2;
  let thd;
  if (efficiency < 50) {
    thd = 1;
  } else if (efficiency < 80) {
    thd = 0.1;
  } else {
    thd = 0.01;
  }
  const snr = 96 + gain / 2;
  const gainLinear = Math.pow(10, gain / 20);
  const voutRms = voutPeak / Math.sqrt(2);
  const inputSensitivity = voutRms / gainLinear * 1e3;
  return {
    values: {
      poutMax,
      poutRMS: poutRms,
      thd_level: thd,
      snr,
      inputSensitivity
    }
  };
}
var audioPowerAmplifier = {
  slug: "audio-power-amplifier",
  title: "Audio Power Amplifier Calculator",
  shortTitle: "Audio Amplifier",
  category: "audio",
  description: "Calculate audio amplifier output power, efficiency, THD class estimate, SNR, and input sensitivity for Class A, AB, and D amplifiers.",
  keywords: ["audio amplifier power calculator", "class d amplifier", "speaker power output", "amplifier efficiency", "audio snr calculator"],
  inputs: [
    {
      key: "vcc",
      label: "Supply Voltage",
      symbol: "Vcc",
      unit: "V",
      defaultValue: 12,
      min: 1,
      max: 100,
      tooltip: "Single supply voltage powering the amplifier"
    },
    {
      key: "rl",
      label: "Speaker Impedance",
      symbol: "RL",
      unit: "\u03A9",
      defaultValue: 8,
      min: 1,
      max: 1e3,
      tooltip: "Speaker load impedance (common: 4\u03A9, 8\u03A9, 16\u03A9)",
      presets: [
        { label: "4\u03A9 speaker", values: { rl: 4 } },
        { label: "8\u03A9 speaker", values: { rl: 8 } },
        { label: "16\u03A9 speaker", values: { rl: 16 } }
      ]
    },
    {
      key: "efficiency",
      label: "Amplifier Efficiency",
      symbol: "\u03B7",
      unit: "%",
      defaultValue: 70,
      min: 1,
      max: 99,
      tooltip: "Amplifier efficiency: Class A \u2248 20%, Class AB \u2248 70%, Class D \u2248 90%",
      presets: [
        { label: "Class A (~20%)", values: { efficiency: 20 } },
        { label: "Class AB (~70%)", values: { efficiency: 70 } },
        { label: "Class D (~90%)", values: { efficiency: 90 } }
      ]
    },
    {
      key: "gain",
      label: "Voltage Gain",
      symbol: "Av",
      unit: "dB",
      defaultValue: 26,
      min: 0,
      max: 80,
      tooltip: "Amplifier voltage gain"
    }
  ],
  outputs: [
    {
      key: "poutMax",
      label: "Maximum Output Power",
      symbol: "Pout_max",
      unit: "W",
      precision: 2,
      tooltip: "Maximum output power at clipping (Vout_peak\xB2 / 2RL)"
    },
    {
      key: "poutRMS",
      label: "RMS Program Power",
      symbol: "Pout_RMS",
      unit: "W",
      precision: 2,
      tooltip: "Typical RMS power for program material (\u224850% of max)"
    },
    {
      key: "thd_level",
      label: "Typical THD",
      symbol: "THD",
      unit: "%",
      precision: 2,
      tooltip: "Typical total harmonic distortion estimate by amplifier class"
    },
    {
      key: "snr",
      label: "Approx. SNR",
      symbol: "SNR",
      unit: "dB",
      precision: 1,
      tooltip: "Approximate signal-to-noise ratio estimate"
    },
    {
      key: "inputSensitivity",
      label: "Input Sensitivity",
      symbol: "V_in_sens",
      unit: "mV",
      precision: 2,
      tooltip: "RMS input voltage required for full output power"
    }
  ],
  calculate: calculateAudioPowerAmplifier,
  formula: {
    primary: "P_{out} = \\frac{V_{out,peak}^2}{2 R_L},\\quad V_{out,peak} = \\frac{V_{cc} \\times 0.9}{2}",
    variables: [
      { symbol: "Vcc", description: "Supply voltage", unit: "V" },
      { symbol: "RL", description: "Speaker impedance", unit: "\u03A9" },
      { symbol: "Vout_peak", description: "Peak output voltage swing", unit: "V" },
      { symbol: "\u03B7", description: "Amplifier efficiency", unit: "%" }
    ],
    reference: 'Cordell, "Designing Audio Power Amplifiers" 2nd ed.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["speaker-crossover", "opamp-gain", "opamp-bandwidth"]
};

// src/lib/calculators/audio/speaker-crossover.ts
function calculateSpeakerCrossover(inputs) {
  const { crossoverFreq, wooferImpedance, tweeterImpedance, order } = inputs;
  if (crossoverFreq <= 0) {
    return { values: {}, errors: ["Crossover frequency must be positive"] };
  }
  if (wooferImpedance <= 0 || tweeterImpedance <= 0) {
    return { values: {}, errors: ["Speaker impedances must be positive"] };
  }
  const ord = Math.round(order);
  if (ord !== 1 && ord !== 2) {
    return { values: {}, errors: ["Order must be 1 (6dB/oct) or 2 (12dB/oct)"] };
  }
  const wc = 2 * Math.PI * crossoverFreq;
  const Zw = wooferImpedance;
  const Zt = tweeterImpedance;
  let wooferL;
  let wooferC;
  let tweeterC;
  let tweeterL;
  if (ord === 1) {
    wooferL = Zw / wc * 1e3;
    wooferC = 1 / (Zt * wc) * 1e6;
    tweeterC = wooferC;
    tweeterL = wooferL;
  } else {
    wooferL = Math.SQRT2 * Zw / (2 * wc) * 1e3;
    wooferC = 1 / (Math.SQRT2 * Zw * wc) * 1e6;
    tweeterC = Math.SQRT2 / (2 * Zt * wc) * 1e6;
    tweeterL = Zt / (Math.SQRT2 * wc) * 1e3;
  }
  const slopeDb = ord * 6;
  return {
    values: {
      wooferL,
      wooferC,
      tweeterC,
      tweeterL,
      slopeDb
    }
  };
}
var speakerCrossover = {
  slug: "speaker-crossover",
  title: "Passive Speaker Crossover Calculator",
  shortTitle: "Speaker Crossover",
  category: "audio",
  description: "Calculate passive 2-way speaker crossover component values for 1st order (6dB/oct) and 2nd order Butterworth (12dB/oct) networks.",
  keywords: ["speaker crossover calculator", "passive crossover design", "2 way crossover components", "butterworth crossover", "woofer tweeter crossover"],
  inputs: [
    {
      key: "crossoverFreq",
      label: "Crossover Frequency",
      symbol: "fc",
      unit: "Hz",
      defaultValue: 3e3,
      min: 100,
      max: 2e4,
      tooltip: "Crossover frequency between woofer and tweeter",
      presets: [
        { label: "1.5 kHz", values: { crossoverFreq: 1500 } },
        { label: "2 kHz", values: { crossoverFreq: 2e3 } },
        { label: "3 kHz", values: { crossoverFreq: 3e3 } },
        { label: "5 kHz", values: { crossoverFreq: 5e3 } }
      ]
    },
    {
      key: "wooferImpedance",
      label: "Woofer Impedance",
      symbol: "Zw",
      unit: "\u03A9",
      defaultValue: 8,
      min: 1,
      max: 32,
      tooltip: "Woofer nominal impedance"
    },
    {
      key: "tweeterImpedance",
      label: "Tweeter Impedance",
      symbol: "Zt",
      unit: "\u03A9",
      defaultValue: 8,
      min: 1,
      max: 32,
      tooltip: "Tweeter nominal impedance"
    },
    {
      key: "order",
      label: "Filter Order",
      symbol: "n",
      unit: "",
      defaultValue: 2,
      min: 1,
      max: 2,
      step: 1,
      tooltip: "1 = 1st order 6dB/octave, 2 = 2nd order Butterworth 12dB/octave",
      presets: [
        { label: "1st order (6dB/oct)", values: { order: 1 } },
        { label: "2nd order (12dB/oct)", values: { order: 2 } }
      ]
    }
  ],
  outputs: [
    {
      key: "wooferL",
      label: "Woofer Inductor",
      symbol: "Lw",
      unit: "mH",
      precision: 3,
      tooltip: "Inductor in series with woofer (low-pass filter)"
    },
    {
      key: "wooferC",
      label: "Woofer Capacitor",
      symbol: "Cw",
      unit: "\u03BCF",
      precision: 3,
      tooltip: "Capacitor in parallel with woofer (2nd order only; equals tweeter cap value for 1st order)"
    },
    {
      key: "tweeterC",
      label: "Tweeter Capacitor",
      symbol: "Ct",
      unit: "\u03BCF",
      precision: 3,
      tooltip: "Capacitor in series with tweeter (high-pass filter)"
    },
    {
      key: "tweeterL",
      label: "Tweeter Inductor",
      symbol: "Lt",
      unit: "mH",
      precision: 3,
      tooltip: "Inductor in parallel with tweeter (2nd order only)"
    },
    {
      key: "slopeDb",
      label: "Filter Slope",
      symbol: "Slope",
      unit: "dB/oct",
      precision: 0,
      tooltip: "Crossover rolloff slope"
    }
  ],
  calculate: calculateSpeakerCrossover,
  formula: {
    primary: "L_w = \\frac{Z_w}{\\omega_c},\\quad C_t = \\frac{1}{Z_t \\omega_c} \\quad (1^{st}\\text{ order})",
    latex: "L_w = \\frac{\\sqrt{2}Z_w}{2\\omega_c},\\quad C_t = \\frac{\\sqrt{2}}{2Z_t\\omega_c} \\quad (2^{nd}\\text{ order})",
    variables: [
      { symbol: "fc", description: "Crossover frequency", unit: "Hz" },
      { symbol: "Zw", description: "Woofer impedance", unit: "\u03A9" },
      { symbol: "Zt", description: "Tweeter impedance", unit: "\u03A9" },
      { symbol: "\u03C9c", description: "Angular crossover frequency", unit: "rad/s" }
    ],
    reference: 'Dickason, "The Loudspeaker Design Cookbook" 7th ed.'
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-power-amplifier", "lc-resonance", "filter-designer"],
  exportComponents: (_inputs, outputs) => {
    const fmtL = (mh) => mh >= 1 ? `${+mh.toPrecision(3)} mH` : `${+(mh * 1e3).toPrecision(3)} \u03BCH`;
    const fmtC = (uf) => uf >= 1 ? `${+uf.toPrecision(3)} \u03BCF` : `${+(uf * 1e3).toPrecision(3)} nF`;
    return [
      { qty: 1, description: "L1 (woofer LP, series)", value: fmtL(outputs?.wooferL ?? 0), package: "0402", componentType: "L", placement: "series" },
      { qty: 1, description: "C1 (woofer LP, shunt)", value: fmtC(outputs?.wooferC ?? 0), package: "0402", componentType: "C", placement: "shunt" },
      { qty: 1, description: "C2 (tweeter HP, series)", value: fmtC(outputs?.tweeterC ?? 0), package: "0402", componentType: "C", placement: "series" },
      { qty: 1, description: "L2 (tweeter HP, shunt)", value: fmtL(outputs?.tweeterL ?? 0), package: "0402", componentType: "L", placement: "shunt" }
    ];
  }
};

// src/lib/calculators/audio/room-modes.ts
function calculateRoomModes(inputs) {
  const { length, width, height, speedOfSound, rt60 } = inputs;
  if (length <= 0 || width <= 0 || height <= 0) {
    return { values: {}, errors: ["Room dimensions must be positive"] };
  }
  const flLength = speedOfSound / (2 * length);
  const flWidth = speedOfSound / (2 * width);
  const flHeight = speedOfSound / (2 * height);
  const volume = length * width * height;
  const schroeder = 2e3 * Math.sqrt(rt60 / volume);
  return { values: { flLength, flWidth, flHeight, schroeder, volume } };
}
var roomModes = {
  slug: "room-modes",
  title: "Room Acoustic Modes",
  shortTitle: "Room Modes",
  category: "audio",
  description: "Calculate room axial resonant frequencies and Schroeder frequency for acoustic treatment and speaker placement.",
  keywords: ["room modes", "room acoustics", "standing waves", "axial modes", "Schroeder frequency", "room resonance"],
  inputs: [
    { key: "length", label: "Room Length", symbol: "L", unit: "m", defaultValue: 5, min: 0.5, step: 0.1 },
    { key: "width", label: "Room Width", symbol: "W", unit: "m", defaultValue: 3.5, min: 0.5, step: 0.1 },
    { key: "height", label: "Room Height", symbol: "H", unit: "m", defaultValue: 2.5, min: 0.5, step: 0.1 },
    { key: "speedOfSound", label: "Speed of Sound", symbol: "c", unit: "m/s", defaultValue: 343, min: 300, max: 360, tooltip: "343 m/s at 20\xB0C" },
    { key: "rt60", label: "Reverberation Time (RT60)", symbol: "T\u2086\u2080", unit: "s", defaultValue: 0.4, min: 0.05, max: 5, step: 0.05, tooltip: "Typical rooms 0.3\u20130.8 s" }
  ],
  outputs: [
    { key: "flLength", label: "Length Mode (1st)", symbol: "f_L", unit: "Hz", precision: 1 },
    { key: "flWidth", label: "Width Mode (1st)", symbol: "f_W", unit: "Hz", precision: 1 },
    { key: "flHeight", label: "Height Mode (1st)", symbol: "f_H", unit: "Hz", precision: 1 },
    { key: "schroeder", label: "Schroeder Frequency", symbol: "f_S", unit: "Hz", precision: 0 },
    { key: "volume", label: "Room Volume", symbol: "V", unit: "m\xB3", precision: 1 }
  ],
  calculate: calculateRoomModes,
  formula: {
    primary: "f_n = n \xD7 c / (2L)",
    variables: [
      { symbol: "c", description: "Speed of sound", unit: "m/s" },
      { symbol: "L", description: "Room dimension", unit: "m" },
      { symbol: "n", description: "Mode number (1, 2, 3\u2026)", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["speaker-sensitivity", "subwoofer-box", "audio-snr"]
};

// src/lib/calculators/audio/speaker-sensitivity.ts
function calculateSpeakerSensitivity(inputs) {
  const { sensitivity, power, distance } = inputs;
  if (power <= 0) {
    return { values: {}, errors: ["Power must be positive"] };
  }
  if (distance <= 0) {
    return { values: {}, errors: ["Distance must be positive"] };
  }
  const splAtPower = sensitivity + 10 * Math.log10(power);
  const splAtDistance = splAtPower - 20 * Math.log10(distance);
  return { values: { splAtPower, splAtDistance } };
}
var speakerSensitivity = {
  slug: "speaker-sensitivity",
  title: "Speaker Sensitivity & SPL",
  shortTitle: "Speaker SPL",
  category: "audio",
  description: "Calculate speaker SPL at any power and distance from the rated sensitivity (dB/W/m) specification.",
  keywords: ["speaker sensitivity", "SPL calculator", "speaker dB", "speaker loudness", "dB/W/m", "speaker power"],
  inputs: [
    { key: "sensitivity", label: "Speaker Sensitivity", symbol: "S", unit: "dB/W/m", defaultValue: 89, min: 60, max: 120, tooltip: "From speaker datasheet, measured at 1W, 1m" },
    { key: "power", label: "Amplifier Power", symbol: "P", unit: "W", defaultValue: 50, min: 1e-3 },
    { key: "distance", label: "Listening Distance", symbol: "d", unit: "m", defaultValue: 3, min: 0.1 }
  ],
  outputs: [
    { key: "splAtPower", label: "SPL at Full Power (1m)", symbol: "SPL_P", unit: "dB", precision: 1 },
    { key: "splAtDistance", label: "SPL at Distance", symbol: "SPL_d", unit: "dB", precision: 1 }
  ],
  calculate: calculateSpeakerSensitivity,
  formula: {
    primary: "SPL = S + 10\xB7log\u2081\u2080(P) \u2212 20\xB7log\u2081\u2080(d)",
    variables: [
      { symbol: "S", description: "Sensitivity (dB/W/m)", unit: "dB" },
      { symbol: "P", description: "Power", unit: "W" },
      { symbol: "d", description: "Distance", unit: "m" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-power-amplifier", "room-modes", "headphone-power"]
};

// src/lib/calculators/audio/headphone-power.ts
function calculateHeadphonePower(inputs) {
  const { impedance, sensitivity, targetSpl } = inputs;
  if (impedance <= 0) {
    return { values: {}, errors: ["Impedance must be positive"] };
  }
  const requiredPowerMw = Math.pow(10, (targetSpl - sensitivity) / 10);
  const requiredPowerW = requiredPowerMw / 1e3;
  const requiredVoltageRms = Math.sqrt(requiredPowerW * impedance);
  const requiredCurrentMa = requiredVoltageRms / impedance * 1e3;
  return { values: { requiredPowerMw, requiredPowerW, requiredVoltageRms, requiredCurrentMa } };
}
var headphonePower = {
  slug: "headphone-power",
  title: "Headphone Amplifier Power",
  shortTitle: "Headphone Power",
  category: "audio",
  description: "Calculate the amplifier output power, voltage, and current required to drive headphones to a target SPL.",
  keywords: ["headphone amplifier", "headphone power", "headphone impedance", "headphone SPL", "amp output power", "headphone sensitivity"],
  inputs: [
    {
      key: "impedance",
      label: "Headphone Impedance",
      symbol: "Z",
      unit: "\u03A9",
      defaultValue: 300,
      min: 8,
      presets: [
        { label: "32 \u03A9 (IEMs)", values: { impedance: 32 } },
        { label: "150 \u03A9 (semi-open)", values: { impedance: 150 } },
        { label: "300 \u03A9 (Sennheiser HD)", values: { impedance: 300 } },
        { label: "600 \u03A9 (AKG K240)", values: { impedance: 600 } }
      ]
    },
    { key: "sensitivity", label: "Headphone Sensitivity", symbol: "S", unit: "dB/mW", defaultValue: 100, min: 70, max: 130, tooltip: "From headphone datasheet, in dB SPL per milliwatt" },
    { key: "targetSpl", label: "Target SPL", symbol: "SPL", unit: "dB", defaultValue: 110, min: 70, max: 140 }
  ],
  outputs: [
    { key: "requiredPowerMw", label: "Required Power", symbol: "P_req", unit: "mW", precision: 3 },
    { key: "requiredPowerW", label: "Required Power (W)", symbol: "P_W", unit: "W", precision: 4, tooltip: "Power in watts (for amplifier datasheet comparison)" },
    { key: "requiredVoltageRms", label: "Required Voltage (RMS)", symbol: "V_rms", unit: "V", precision: 3 },
    { key: "requiredCurrentMa", label: "Required Current", symbol: "I_req", unit: "mA", precision: 2 }
  ],
  calculate: calculateHeadphonePower,
  formula: {
    primary: "P = 10^((SPL \u2212 S)/10) mW,  V = \u221A(P \xD7 Z)",
    variables: [
      { symbol: "S", description: "Headphone sensitivity", unit: "dB/mW" },
      { symbol: "Z", description: "Headphone impedance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["speaker-sensitivity", "audio-power-amplifier", "power-amplifier-gain"]
};

// src/lib/calculators/audio/audio-snr.ts
function calculateAudioSnr(inputs) {
  const { signalLevel, noiseFloor } = inputs;
  const snr = signalLevel - noiseFloor;
  const maxLevel = 0;
  const dynamicRange = maxLevel - noiseFloor;
  const snrLinear = Math.pow(10, snr / 20);
  const noiseBits = snr / 6.02;
  return { values: { snr, dynamicRange, snrLinear, noiseBits } };
}
var audioSnr = {
  slug: "audio-snr",
  title: "Audio SNR & Dynamic Range",
  shortTitle: "Audio SNR",
  category: "audio",
  description: "Calculate audio signal-to-noise ratio, dynamic range, and equivalent noise bits from signal and noise floor levels.",
  keywords: ["audio SNR", "signal to noise ratio audio", "dynamic range audio", "noise floor audio", "audio quality", "ENOB audio"],
  inputs: [
    { key: "signalLevel", label: "Signal Level", symbol: "V_sig", unit: "dBV", defaultValue: 0, min: -80, max: 30 },
    { key: "noiseFloor", label: "Noise Floor", symbol: "V_noise", unit: "dBV", defaultValue: -90, min: -140, max: 0 }
  ],
  outputs: [
    { key: "snr", label: "SNR", symbol: "SNR", unit: "dB", precision: 1, thresholds: { good: { min: 90 }, warning: { min: 60 } } },
    { key: "dynamicRange", label: "Dynamic Range", symbol: "DR", unit: "dB", precision: 1, tooltip: "Span from noise floor to 0 dBFS maximum level" },
    { key: "snrLinear", label: "SNR (linear voltage ratio)", symbol: "SNR_V", unit: ":1", precision: 0 },
    { key: "noiseBits", label: "Effective Noise Bits", symbol: "ENOB", unit: "bits", precision: 1 }
  ],
  calculate: calculateAudioSnr,
  formula: {
    primary: "SNR = V_signal \u2212 V_noise (dB)",
    variables: [
      { symbol: "SNR", description: "Signal-to-noise ratio", unit: "dB" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-adc-snr", "audio-power-amplifier", "amplifier-clipping"]
};

// src/lib/calculators/audio/op-amp-slew-rate.ts
function calculateOpAmpSlewRate(inputs) {
  const { slewRate, amplitude, frequency } = inputs;
  if (slewRate <= 0 || amplitude <= 0 || frequency <= 0) {
    return { values: {}, errors: ["All inputs must be positive"] };
  }
  const fullPowerBandwidth = slewRate * 1e6 / (2 * Math.PI * amplitude);
  const minSlewRateRequired = 2 * Math.PI * frequency * amplitude / 1e6;
  const slewMargin = slewRate - minSlewRateRequired;
  return { values: { fullPowerBandwidth, minSlewRateRequired, slewMargin } };
}
var opAmpSlewRate = {
  slug: "op-amp-slew-rate",
  title: "Op-Amp Slew Rate & Full-Power Bandwidth",
  shortTitle: "Op-Amp Slew Rate",
  category: "audio",
  description: "Calculate op-amp full-power bandwidth from slew rate and signal amplitude, and verify the op-amp can handle your signal without slew-rate distortion.",
  keywords: ["op-amp slew rate", "full power bandwidth", "slew rate distortion", "op amp bandwidth", "audio op amp", "slewing"],
  inputs: [
    { key: "slewRate", label: "Op-Amp Slew Rate", symbol: "SR", unit: "V/\u03BCs", defaultValue: 13, min: 1e-3, tooltip: "From op-amp datasheet" },
    { key: "amplitude", label: "Signal Peak Amplitude", symbol: "V_p", unit: "V", defaultValue: 5, min: 1e-3 },
    { key: "frequency", label: "Signal Frequency", symbol: "f", unit: "Hz", defaultValue: 2e4, min: 1 }
  ],
  outputs: [
    { key: "fullPowerBandwidth", label: "Full-Power Bandwidth", symbol: "FPBW", unit: "Hz", precision: 0 },
    { key: "minSlewRateRequired", label: "Min. Slew Rate Required", symbol: "SR_min", unit: "V/\u03BCs", precision: 3 },
    { key: "slewMargin", label: "Slew Rate Margin", symbol: "SR_margin", unit: "V/\u03BCs", precision: 3, thresholds: { good: { min: 0 } } }
  ],
  calculate: calculateOpAmpSlewRate,
  formula: {
    primary: "FPBW = SR / (2\u03C0 \xD7 V_peak)",
    variables: [
      { symbol: "SR", description: "Slew rate", unit: "V/\u03BCs" },
      { symbol: "V_peak", description: "Peak output voltage", unit: "V" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-power-amplifier", "audio-snr", "equalizer-q-factor"]
};

// src/lib/calculators/audio/audio-transformer.ts
function calculateAudioTransformer(inputs) {
  const { primaryImpedance, secondaryImpedance, primaryVoltage, primaryCurrent } = inputs;
  if (primaryImpedance <= 0 || secondaryImpedance <= 0) {
    return { values: {}, errors: ["Impedances must be positive"] };
  }
  const turnsRatio = Math.sqrt(primaryImpedance / secondaryImpedance);
  const secondaryVoltage = primaryVoltage / turnsRatio;
  const secondaryCurrent = primaryCurrent * turnsRatio;
  const powerTransferred = primaryVoltage * primaryCurrent;
  return { values: { turnsRatio, secondaryVoltage, secondaryCurrent, powerTransferred } };
}
var audioTransformer = {
  slug: "audio-transformer",
  title: "Audio Transformer Turns Ratio",
  shortTitle: "Audio Transformer",
  category: "audio",
  description: "Calculate audio transformer turns ratio for impedance matching between source and load, plus secondary voltage and current.",
  keywords: ["audio transformer", "transformer turns ratio", "impedance matching transformer", "balun transformer audio", "DI box transformer", "600 ohm matching"],
  inputs: [
    { key: "primaryImpedance", label: "Primary Impedance", symbol: "Z\u2081", unit: "\u03A9", defaultValue: 600, min: 1 },
    { key: "secondaryImpedance", label: "Secondary Impedance", symbol: "Z\u2082", unit: "\u03A9", defaultValue: 8, min: 1 },
    { key: "primaryVoltage", label: "Primary Voltage (RMS)", symbol: "V\u2081", unit: "V", defaultValue: 1, min: 0 },
    { key: "primaryCurrent", label: "Primary Current (RMS)", symbol: "I\u2081", unit: "A", defaultValue: 1e-3, min: 0, step: 1e-4 }
  ],
  outputs: [
    { key: "turnsRatio", label: "Turns Ratio (n)", symbol: "n", unit: ":1", precision: 3 },
    { key: "secondaryVoltage", label: "Secondary Voltage", symbol: "V\u2082", unit: "V", precision: 4 },
    { key: "secondaryCurrent", label: "Secondary Current", symbol: "I\u2082", unit: "A", precision: 4 },
    { key: "powerTransferred", label: "Power Transferred", symbol: "P", unit: "W", precision: 4 }
  ],
  calculate: calculateAudioTransformer,
  formula: {
    primary: "n = \u221A(Z\u2081/Z\u2082),  V\u2082 = V\u2081/n,  I\u2082 = I\u2081 \xD7 n",
    variables: [
      { symbol: "n", description: "Turns ratio", unit: "" },
      { symbol: "Z", description: "Impedance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-power-amplifier", "speaker-sensitivity", "tweeter-capacitor"]
};

// src/lib/calculators/audio/cable-capacitance-rolloff.ts
function calculateCableCapacitanceRolloff(inputs) {
  const { sourceImpedance, cableCapacitancePf, cableLengthM } = inputs;
  if (sourceImpedance <= 0 || cableCapacitancePf <= 0 || cableLengthM <= 0) {
    return { values: {}, errors: ["All inputs must be positive"] };
  }
  const totalCapacitancePf = cableCapacitancePf * cableLengthM;
  const totalCapacitanceF = totalCapacitancePf * 1e-12;
  const cutoffFrequency = 1 / (2 * Math.PI * sourceImpedance * totalCapacitanceF);
  const rolloffAt20k = -20 * Math.log10(Math.sqrt(1 + Math.pow(2 * Math.PI * 2e4 * sourceImpedance * totalCapacitanceF, 2)));
  return { values: { totalCapacitancePf, cutoffFrequency, rolloffAt20k } };
}
var cableCapacitanceRolloff = {
  slug: "cable-capacitance-rolloff",
  title: "Cable Capacitance High-Frequency Rolloff",
  shortTitle: "Cable Rolloff",
  category: "audio",
  description: "Calculate the high-frequency rolloff (-3 dB point) caused by cable capacitance interacting with source impedance.",
  keywords: ["cable capacitance", "high frequency rolloff", "guitar cable", "audio cable rolloff", "capacitance rolloff", "cable treble loss"],
  inputs: [
    {
      key: "sourceImpedance",
      label: "Source Impedance",
      symbol: "Z_s",
      unit: "\u03A9",
      defaultValue: 1e4,
      min: 1,
      presets: [
        { label: "Guitar pickup (250 k\u03A9)", values: { sourceImpedance: 25e4 } },
        { label: "Hi-Z input (10 k\u03A9)", values: { sourceImpedance: 1e4 } },
        { label: "Line out (100 \u03A9)", values: { sourceImpedance: 100 } }
      ]
    },
    { key: "cableCapacitancePf", label: "Cable Capacitance", symbol: "C/m", unit: "pF/m", defaultValue: 100, min: 1, tooltip: "Per metre, from cable datasheet (typical: 80\u2013150 pF/m)" },
    { key: "cableLengthM", label: "Cable Length", symbol: "l", unit: "m", defaultValue: 5, min: 0.1 }
  ],
  outputs: [
    { key: "totalCapacitancePf", label: "Total Cable Capacitance", symbol: "C_total", unit: "pF", precision: 0 },
    { key: "cutoffFrequency", label: "-3 dB Frequency", symbol: "f_c", unit: "Hz", precision: 0 },
    { key: "rolloffAt20k", label: "Rolloff at 20 kHz", symbol: "\u0394dB", unit: "dB", precision: 1 }
  ],
  calculate: calculateCableCapacitanceRolloff,
  formula: {
    primary: "f_c = 1 / (2\u03C0 \xD7 Z_s \xD7 C_total)",
    variables: [
      { symbol: "Z_s", description: "Source impedance", unit: "\u03A9" },
      { symbol: "C_total", description: "Total cable capacitance", unit: "F" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-transformer", "op-amp-slew-rate", "audio-snr"]
};

// src/lib/calculators/audio/subwoofer-box.ts
function calculateSubwooferBox(inputs) {
  const { vas, qts, fs } = inputs;
  if (vas <= 0 || qts <= 0 || fs <= 0) {
    return { values: {}, errors: ["All Thiele-Small parameters must be positive"] };
  }
  const qtc = 0.707;
  const denominator = (qtc / qts) ** 2 - 1;
  const vbSealed = denominator > 0 ? vas / denominator : vas * 2;
  const vbVented = 20 * qts ** 3.3 * vas;
  const portTuning = 0.76 * qts ** 0.26 * fs;
  const fc = fs * qtc / qts;
  const a = 1 / (2 * qtc * qtc);
  const f3Sealed = fc * Math.sqrt(a - 1 + Math.sqrt((a - 1) ** 2 + 1));
  return {
    values: {
      vbSealed: Math.max(0.1, vbSealed),
      vbVented: Math.max(0.1, vbVented),
      portTuning,
      f3Sealed
    }
  };
}
var subwooferBox = {
  slug: "subwoofer-box",
  title: "Subwoofer Enclosure Volume",
  shortTitle: "Subwoofer Box",
  category: "audio",
  description: "Calculate optimal subwoofer box (sealed and ported) volume and port tuning frequency from Thiele-Small parameters (Vas, Qts, Fs).",
  keywords: ["subwoofer box calculator", "speaker enclosure", "Thiele-Small", "ported box", "sealed box subwoofer", "Vas Qts Fs"],
  inputs: [
    { key: "vas", label: "Vas (Equivalent Volume)", symbol: "Vas", unit: "L", defaultValue: 50, min: 0.1, tooltip: "From driver datasheet" },
    { key: "qts", label: "Qts (Total Q)", symbol: "Qts", unit: "", defaultValue: 0.35, min: 0.01, max: 2, step: 0.01, tooltip: "Qts < 0.35 \u2192 vented, 0.35\u20130.7 \u2192 sealed" },
    { key: "fs", label: "Fs (Resonant Frequency)", symbol: "Fs", unit: "Hz", defaultValue: 35, min: 5, max: 200 }
  ],
  outputs: [
    { key: "vbSealed", label: "Sealed Box Volume", symbol: "Vb_s", unit: "L", precision: 1 },
    { key: "vbVented", label: "Ported Box Volume", symbol: "Vb_v", unit: "L", precision: 1 },
    { key: "portTuning", label: "Port Tuning Frequency", symbol: "Fb", unit: "Hz", precision: 1 },
    { key: "f3Sealed", label: "-3 dB (Sealed)", symbol: "f_3", unit: "Hz", precision: 1 }
  ],
  calculate: calculateSubwooferBox,
  formula: {
    primary: "Vb = Vas / ((Qtc/Qts)\xB2 \u2212 1) [sealed]",
    variables: [
      { symbol: "Vas", description: "Equivalent compliance volume", unit: "L" },
      { symbol: "Qtc", description: "Target box Q (0.707 Butterworth)", unit: "" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["room-modes", "speaker-sensitivity", "tweeter-capacitor"]
};

// src/lib/calculators/audio/tweeter-capacitor.ts
function calculateTweeterCapacitor(inputs) {
  const { tweetImpedance, crossoverFreq } = inputs;
  if (tweetImpedance <= 0 || crossoverFreq <= 0) {
    return { values: {}, errors: ["Impedance and crossover frequency must be positive"] };
  }
  const capacitanceFarads = 1 / (2 * Math.PI * crossoverFreq * tweetImpedance);
  const capacitanceMicroF = capacitanceFarads * 1e6;
  const reactanceAt1k = 1 / (2 * Math.PI * 1e3 * capacitanceFarads);
  const rolloffAt100Hz = -20 * Math.log10(Math.sqrt(1 + Math.pow(crossoverFreq / 100, 2)));
  return { values: { capacitanceMicroF, reactanceAt1k, rolloffAt100Hz } };
}
var tweeterCapacitor = {
  slug: "tweeter-capacitor",
  title: "Tweeter Protection Capacitor",
  shortTitle: "Tweeter Capacitor",
  category: "audio",
  description: "Calculate the capacitor value for a first-order tweeter high-pass filter to protect tweeters from low-frequency damage.",
  keywords: ["tweeter capacitor", "tweeter protection", "crossover capacitor", "high-pass filter speaker", "tweeter crossover", "speaker protection cap"],
  inputs: [
    {
      key: "tweetImpedance",
      label: "Tweeter Impedance",
      symbol: "Z_t",
      unit: "\u03A9",
      defaultValue: 8,
      min: 1,
      presets: [
        { label: "4 \u03A9", values: { tweetImpedance: 4 } },
        { label: "8 \u03A9", values: { tweetImpedance: 8 } }
      ]
    },
    { key: "crossoverFreq", label: "Crossover Frequency", symbol: "f_c", unit: "Hz", defaultValue: 3e3, min: 100 }
  ],
  outputs: [
    { key: "capacitanceMicroF", label: "Capacitor Value", symbol: "C", unit: "\u03BCF", precision: 2 },
    { key: "reactanceAt1k", label: "Reactance at 1 kHz", symbol: "Xc", unit: "\u03A9", precision: 1 },
    { key: "rolloffAt100Hz", label: "Rolloff at 100 Hz", symbol: "\u0394dB", unit: "dB", precision: 0 }
  ],
  calculate: calculateTweeterCapacitor,
  formula: {
    primary: "C = 1 / (2\u03C0 \xD7 f_c \xD7 Z_t)",
    variables: [
      { symbol: "f_c", description: "Crossover frequency", unit: "Hz" },
      { symbol: "Z_t", description: "Tweeter impedance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["speaker-sensitivity", "subwoofer-box", "audio-transformer"],
  exportComponents: (_inputs, outputs) => {
    const uf = outputs?.capacitanceMicroF ?? 0;
    const fmtC = (v) => v >= 1 ? `${+v.toPrecision(3)} \u03BCF` : `${+(v * 1e3).toPrecision(3)} nF`;
    return [
      { qty: 1, description: "C (tweeter crossover)", value: fmtC(uf), package: "0402", componentType: "C", placement: "series" }
    ];
  }
};

// src/lib/calculators/audio/class-d-efficiency.ts
function calculateClassDEfficiency(inputs) {
  const { outputPower, supplyVoltage, loadImpedance, rdson, mosfetCount, quiescentCurrent } = inputs;
  if (outputPower <= 0 || supplyVoltage <= 0) {
    return { values: {}, errors: ["Output power and supply voltage must be positive"] };
  }
  const rdsonOhms = rdson / 1e3;
  const loadCurrent = Math.sqrt(outputPower / loadImpedance);
  const conductionLoss = loadCurrent * loadCurrent * rdsonOhms * mosfetCount;
  const quiescentLoss = supplyVoltage * quiescentCurrent / 1e3;
  const totalLoss = conductionLoss + quiescentLoss;
  const totalInput = outputPower + totalLoss;
  const efficiency = outputPower / totalInput * 100;
  return { values: { conductionLoss, quiescentLoss, totalLoss, totalInput, efficiency } };
}
var classDEfficiency = {
  slug: "class-d-efficiency",
  title: "Class D Amplifier Efficiency",
  shortTitle: "Class-D Efficiency",
  category: "audio",
  description: "Estimate Class D amplifier efficiency from MOSFET conduction losses and quiescent current at a given output power.",
  keywords: ["class D amplifier", "class D efficiency", "switching amplifier", "class D audio", "PWM amplifier efficiency", "class D vs class AB"],
  inputs: [
    { key: "outputPower", label: "Output Power", symbol: "P_out", unit: "W", defaultValue: 50, min: 0.1 },
    { key: "supplyVoltage", label: "Supply Voltage", symbol: "V_s", unit: "V", defaultValue: 36, min: 1 },
    { key: "loadImpedance", label: "Load Impedance", symbol: "Z_L", unit: "\u03A9", defaultValue: 8, min: 1, presets: [
      { label: "4 \u03A9", values: { loadImpedance: 4 } },
      { label: "8 \u03A9", values: { loadImpedance: 8 } }
    ] },
    { key: "rdson", label: "MOSFET RDS(on)", symbol: "R_DS", unit: "m\u03A9", defaultValue: 50, min: 1, tooltip: "Per MOSFET in milliohms" },
    { key: "mosfetCount", label: "Number of MOSFETs", symbol: "N", unit: "", defaultValue: 4, min: 2, step: 2 },
    { key: "quiescentCurrent", label: "Quiescent Current", symbol: "I_q", unit: "mA", defaultValue: 30, min: 0 }
  ],
  outputs: [
    { key: "efficiency", label: "Efficiency", symbol: "\u03B7", unit: "%", precision: 1, thresholds: { good: { min: 85 }, warning: { min: 70 } } },
    { key: "conductionLoss", label: "Conduction Loss", symbol: "P_cond", unit: "W", precision: 2 },
    { key: "quiescentLoss", label: "Quiescent Loss", symbol: "P_q", unit: "W", precision: 2 },
    { key: "totalLoss", label: "Total Power Loss", symbol: "P_loss", unit: "W", precision: 2, tooltip: "Total heat dissipated \u2014 use for heatsink sizing" },
    { key: "totalInput", label: "Total Input Power", symbol: "P_in", unit: "W", precision: 1 }
  ],
  calculate: calculateClassDEfficiency,
  formula: {
    primary: "\u03B7 = P_out / (P_out + P_cond + P_q) \xD7 100%",
    variables: [
      { symbol: "R_DS", description: "MOSFET on-resistance", unit: "\u03A9" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-power-amplifier", "audio-snr", "amplifier-clipping"]
};

// src/lib/calculators/audio/audio-adc-snr.ts
function calculateAudioAdcSnr(inputs) {
  const { bitDepth, oversamplingRatio } = inputs;
  if (bitDepth < 1 || oversamplingRatio < 1) {
    return { values: {}, errors: ["Bit depth must be \u2265 1 and oversampling ratio \u2265 1"] };
  }
  const theoreticalSnr = 6.02 * bitDepth + 1.76;
  const oversamplingGain = 10 * Math.log10(oversamplingRatio);
  const totalSnr = theoreticalSnr + oversamplingGain;
  const dynamicRange = theoreticalSnr;
  return { values: { theoreticalSnr, oversamplingGain, totalSnr, dynamicRange } };
}
var audioAdcSnr = {
  slug: "audio-adc-snr",
  title: "ADC Bit Depth to Dynamic Range",
  shortTitle: "ADC Dynamic Range",
  category: "audio",
  description: "Calculate the theoretical SNR and dynamic range of an audio ADC from its bit depth, and the improvement from oversampling.",
  keywords: ["ADC SNR", "bit depth dynamic range", "audio ADC", "24 bit audio", "oversampling SNR", "ENOB audio ADC"],
  inputs: [
    {
      key: "bitDepth",
      label: "Bit Depth",
      symbol: "N",
      unit: "bits",
      defaultValue: 24,
      min: 1,
      max: 32,
      step: 1,
      presets: [
        { label: "16-bit (CD)", values: { bitDepth: 16 } },
        { label: "24-bit (studio)", values: { bitDepth: 24 } },
        { label: "32-bit (float)", values: { bitDepth: 32 } }
      ]
    },
    {
      key: "oversamplingRatio",
      label: "Oversampling Ratio",
      symbol: "OSR",
      unit: "\xD7",
      defaultValue: 1,
      min: 1,
      presets: [
        { label: "No oversampling (1\xD7)", values: { oversamplingRatio: 1 } },
        { label: "4\xD7 oversampling", values: { oversamplingRatio: 4 } },
        { label: "64\xD7 (sigma-delta)", values: { oversamplingRatio: 64 } }
      ]
    }
  ],
  outputs: [
    { key: "theoreticalSnr", label: "Theoretical SNR", symbol: "SNR_ideal", unit: "dB", precision: 1 },
    { key: "oversamplingGain", label: "Oversampling Gain", symbol: "G_OS", unit: "dB", precision: 1 },
    { key: "totalSnr", label: "Total SNR", symbol: "SNR_total", unit: "dB", precision: 1, thresholds: { good: { min: 96 } } },
    { key: "dynamicRange", label: "Dynamic Range", symbol: "DR", unit: "dB", precision: 1 }
  ],
  calculate: calculateAudioAdcSnr,
  formula: {
    primary: "SNR = 6.02N + 1.76 dB,  G_OS = 10\xB7log\u2081\u2080(OSR)",
    variables: [
      { symbol: "N", description: "Bit depth", unit: "bits" },
      { symbol: "OSR", description: "Oversampling ratio", unit: "\xD7" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-snr", "amplifier-clipping"]
};

// src/lib/calculators/audio/equalizer-q-factor.ts
function calculateEqualizerQFactor(inputs) {
  const { centerFreq, bandwidth } = inputs;
  if (centerFreq <= 0 || bandwidth <= 0) {
    return { values: {}, errors: ["Center frequency and bandwidth must be positive"] };
  }
  const qFactor2 = centerFreq / bandwidth;
  const octaves = Math.log2(1 + 1 / (2 * qFactor2) + Math.sqrt(1 / qFactor2 + 1 / (4 * qFactor2 ** 2)));
  const lowerFreq = centerFreq / Math.pow(2, octaves / 2);
  const upperFreq = centerFreq * Math.pow(2, octaves / 2);
  return { values: { qFactor: qFactor2, octaves, lowerFreq, upperFreq } };
}
var equalizerQFactor = {
  slug: "equalizer-q-factor",
  title: "Equalizer Filter Q & Bandwidth",
  shortTitle: "EQ Q Factor",
  category: "audio",
  description: "Calculate equalizer Q factor from center frequency and bandwidth, or convert between Q, octaves, and frequency limits.",
  keywords: ["equalizer Q factor", "EQ bandwidth", "parametric EQ", "Q factor audio", "octave bandwidth", "EQ filter"],
  inputs: [
    { key: "centerFreq", label: "Center Frequency", symbol: "f\u2080", unit: "Hz", defaultValue: 1e3, min: 1 },
    { key: "bandwidth", label: "Bandwidth (\u22123 dB)", symbol: "BW", unit: "Hz", defaultValue: 200, min: 0.1 }
  ],
  outputs: [
    { key: "qFactor", label: "Q Factor", symbol: "Q", unit: "", precision: 2 },
    { key: "octaves", label: "Bandwidth", symbol: "BW", unit: "octaves", precision: 2 },
    { key: "lowerFreq", label: "Lower \u22123 dB Frequency", symbol: "f_L", unit: "Hz", precision: 0 },
    { key: "upperFreq", label: "Upper \u22123 dB Frequency", symbol: "f_H", unit: "Hz", precision: 0 }
  ],
  calculate: calculateEqualizerQFactor,
  formula: {
    primary: "Q = f\u2080 / BW",
    variables: [
      { symbol: "f\u2080", description: "Center frequency", unit: "Hz" },
      { symbol: "BW", description: "-3 dB bandwidth", unit: "Hz" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-snr", "op-amp-slew-rate", "cable-capacitance-rolloff"]
};

// src/lib/calculators/audio/amplifier-clipping.ts
function calculateAmplifierClipping(inputs) {
  const { supplyVoltage, loadImpedance, headroom } = inputs;
  if (supplyVoltage <= 0 || loadImpedance <= 0) {
    return { values: {}, errors: ["Supply voltage and load impedance must be positive"] };
  }
  const maxOutputVoltage = supplyVoltage * 0.9 * (headroom / 100);
  const clippingPower = maxOutputVoltage ** 2 / (2 * loadImpedance);
  const rmsVoltage = maxOutputVoltage / Math.SQRT2;
  const clippingLevel = 20 * Math.log10(Math.max(rmsVoltage, 1e-9));
  return { values: { maxOutputVoltage, rmsVoltage, clippingPower, clippingLevel } };
}
var amplifierClipping = {
  slug: "amplifier-clipping",
  title: "Amplifier Clipping Level",
  shortTitle: "Amp Clipping",
  category: "audio",
  description: "Calculate amplifier clipping voltage, power, and dBV level from supply voltage and load impedance.",
  keywords: ["amplifier clipping", "clip level", "amplifier output voltage", "amp clipping power", "headroom amplifier", "clipping distortion"],
  inputs: [
    { key: "supplyVoltage", label: "Supply Voltage (\xB1V or single)", symbol: "V_cc", unit: "V", defaultValue: 36, min: 1, tooltip: "For dual supply (\xB118V), enter 18V" },
    {
      key: "loadImpedance",
      label: "Load Impedance",
      symbol: "Z_L",
      unit: "\u03A9",
      defaultValue: 8,
      min: 1,
      presets: [
        { label: "4 \u03A9", values: { loadImpedance: 4 } },
        { label: "8 \u03A9", values: { loadImpedance: 8 } }
      ]
    },
    { key: "headroom", label: "Headroom Reserve", symbol: "H", unit: "%", defaultValue: 100, min: 10, max: 100, tooltip: "100% = maximum output, lower to add headroom margin" }
  ],
  outputs: [
    { key: "maxOutputVoltage", label: "Max Output Voltage (peak)", symbol: "V_peak", unit: "V", precision: 2 },
    { key: "rmsVoltage", label: "Max Output Voltage (RMS)", symbol: "V_rms", unit: "V", precision: 2 },
    { key: "clippingPower", label: "Continuous Power at Clipping", symbol: "P_clip_rms", unit: "W", precision: 1 },
    { key: "clippingLevel", label: "Clipping Level", symbol: "dBV", unit: "dBV", precision: 1 }
  ],
  calculate: calculateAmplifierClipping,
  formula: {
    primary: "V_peak \u2248 0.9 \xD7 V_cc,  P_clip = V_peak\xB2 / (2 \xD7 Z_L)",
    variables: [
      { symbol: "V_cc", description: "Supply rail voltage", unit: "V" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-power-amplifier", "audio-snr", "power-amplifier-gain"]
};

// src/lib/calculators/audio/audio-delay-time.ts
function calculateAudioDelayTime(inputs) {
  const { bpm, noteValue, speedOfSound, distance } = inputs;
  if (bpm <= 0 || noteValue <= 0 || speedOfSound <= 0) {
    return { values: {}, errors: ["BPM, note value, and speed of sound must be positive"] };
  }
  const beatMs = 6e4 / bpm;
  const noteDelayMs = beatMs * (4 / noteValue);
  const propagationMs = distance / speedOfSound * 1e3;
  return { values: { beatMs, noteDelayMs, propagationMs } };
}
var audioDelayTime = {
  slug: "audio-delay-time",
  title: "Audio Delay & Echo Time Calculator",
  shortTitle: "Delay Time",
  category: "audio",
  description: "Calculate musically-synced delay times from BPM and note value, plus acoustic propagation delay from speaker distance.",
  keywords: ["audio delay time", "BPM delay calculator", "delay tempo sync", "echo time", "reverb time", "delay milliseconds BPM"],
  inputs: [
    { key: "bpm", label: "Tempo (BPM)", symbol: "BPM", unit: "bpm", defaultValue: 120, min: 20, max: 300 },
    {
      key: "noteValue",
      label: "Note Division",
      symbol: "n",
      unit: "",
      defaultValue: 4,
      min: 1,
      presets: [
        { label: "Whole note (1)", values: { noteValue: 1 } },
        { label: "Half note (2)", values: { noteValue: 2 } },
        { label: "Quarter note (4)", values: { noteValue: 4 } },
        { label: "Eighth note (8)", values: { noteValue: 8 } }
      ]
    },
    { key: "distance", label: "Speaker Distance", symbol: "d", unit: "m", defaultValue: 10, min: 0 },
    { key: "speedOfSound", label: "Speed of Sound", symbol: "c", unit: "m/s", defaultValue: 343, min: 300, max: 360 }
  ],
  outputs: [
    { key: "beatMs", label: "Quarter-Note Delay", symbol: "t_beat", unit: "ms", precision: 1 },
    { key: "noteDelayMs", label: "Selected Note Delay", symbol: "t_note", unit: "ms", precision: 1 },
    { key: "propagationMs", label: "Propagation Delay", symbol: "t_prop", unit: "ms", precision: 1 }
  ],
  calculate: calculateAudioDelayTime,
  formula: {
    primary: "t_beat = 60000/BPM ms,  t_prop = d/c \xD7 1000",
    variables: [
      { symbol: "BPM", description: "Beats per minute", unit: "bpm" },
      { symbol: "c", description: "Speed of sound", unit: "m/s" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["room-modes", "speaker-sensitivity", "audio-snr"]
};

// src/lib/calculators/audio/power-amplifier-gain.ts
function calculatePowerAmplifierGain(inputs) {
  const { inputVoltage, outputVoltage, inputPower, outputPower } = inputs;
  if (inputVoltage <= 0 || outputVoltage <= 0) {
    return { values: {}, errors: ["Input and output voltages must be positive"] };
  }
  if (inputPower <= 0 || outputPower <= 0) {
    return { values: {}, errors: ["Input and output powers must be positive"] };
  }
  const voltageGain = outputVoltage / inputVoltage;
  const voltageGainDb = 20 * Math.log10(voltageGain);
  const powerGain = outputPower / (inputPower / 1e3);
  const powerGainDb = 10 * Math.log10(powerGain);
  return { values: { voltageGain, voltageGainDb, powerGain, powerGainDb } };
}
var powerAmplifierGain = {
  slug: "power-amplifier-gain",
  title: "Power Amplifier Gain Calculator",
  shortTitle: "Amplifier Gain",
  category: "audio",
  description: "Calculate power amplifier voltage gain (V/V and dB) and power gain from input/output voltage and power measurements.",
  keywords: ["amplifier gain", "power amplifier dB", "voltage gain amplifier", "gain dB", "amplifier sensitivity", "audio gain"],
  inputs: [
    { key: "inputVoltage", label: "Input Voltage (RMS)", symbol: "V_in", unit: "V", defaultValue: 1, min: 1e-3 },
    { key: "outputVoltage", label: "Output Voltage (RMS)", symbol: "V_out", unit: "V", defaultValue: 28, min: 1e-3 },
    { key: "inputPower", label: "Input Power", symbol: "P_in", unit: "mW", defaultValue: 0.1, min: 1e-3, tooltip: "Power consumed by amplifier input" },
    { key: "outputPower", label: "Output Power", symbol: "P_out", unit: "W", defaultValue: 100, min: 1e-3 }
  ],
  outputs: [
    { key: "voltageGain", label: "Voltage Gain", symbol: "Av", unit: "V/V", precision: 1 },
    { key: "voltageGainDb", label: "Voltage Gain", symbol: "Av_dB", unit: "dB", precision: 1 },
    { key: "powerGain", label: "Power Gain", symbol: "Ap", unit: "W/W", precision: 0 },
    { key: "powerGainDb", label: "Power Gain", symbol: "Ap_dB", unit: "dB", precision: 1 }
  ],
  calculate: calculatePowerAmplifierGain,
  formula: {
    primary: "Av_dB = 20\xB7log\u2081\u2080(V_out/V_in)",
    variables: [
      { symbol: "Av", description: "Voltage gain", unit: "V/V or dB" },
      { symbol: "Ap", description: "Power gain", unit: "W/W or dB" }
    ]
  },
  visualization: { type: "none" },
  relatedCalculators: ["audio-power-amplifier", "amplifier-clipping", "audio-snr"]
};

// src/lib/calculators/registry.ts
var ALL_CALCULATORS = [
  microstripImpedance,
  rfLinkBudget,
  vswrReturnLoss,
  dbConverter,
  noiseFigureCascade,
  skinDepth,
  wavelengthFrequency,
  coaxImpedance,
  coaxLoss,
  ismCoexistence,
  attenuatorDesigner,
  smithChart,
  traceWidthCurrent,
  traceResistance,
  differentialPair,
  viaCalculator,
  stackupBuilder,
  voltageDivider,
  ledResistor,
  buckConverter,
  ldoThermal,
  batteryLife,
  filterDesigner,
  samplingNyquist,
  dipoleAntenna,
  patchAntenna,
  eirpCalculator,
  ohmsLaw,
  resistorColorCode,
  rcTimeConstant,
  seriesParallelResistor,
  lcResonance,
  opampGain,
  uartBaudRate,
  i2cPullup,
  clockJitter,
  heatsinkCalculator,
  pcbTraceTemp,
  dcMotorSpeed,
  stepperMotor,
  shieldingEffectiveness,
  wireGauge,
  capacitorEnergy,
  powerFactor,
  qFactor,
  waveguideCutoff,
  zenerDiode,
  inductorEnergy,
  boostConverter,
  threePhasePower,
  antennaBeamwidth,
  snrCalculator,
  controlledImpedance,
  ferriteBead,
  // Batch 4 — RF/Signal/Antenna/Protocol
  freeSpacePathLoss,
  radarRangeEquation,
  powerAmplifierEfficiency,
  intermodulationDistortion,
  phaseNoiseToJitter,
  vibrationPhaseNoise,
  returnLossError,
  adcSnr,
  fftBinResolution,
  johnsonNoise,
  amModulationIndex,
  fmModulationIndex,
  oversamplingSnr,
  digitalFilterOrder,
  yagiAntenna,
  hornAntenna,
  parabolicDishAntenna,
  loopAntenna,
  spiTiming,
  canBusTiming,
  usbTermination,
  rs485Termination,
  // Batch 4 — Power/PCB/General/Thermal/Motor
  pwmDutyCycle,
  mosfetPowerDissipation,
  solarPanelSizing,
  batteryChargeTime,
  inrushCurrentLimiter,
  chargePumpVoltage,
  switchingRegulatorRipple,
  linearRegulatorDropout,
  pcbCrosstalk,
  decouplingCapacitor,
  pcbTraceInductance,
  viaThermalResistance,
  bjtBiasPoint,
  mosfetOperatingPoint,
  comparatorHysteresis,
  timer555,
  transistorSwitch,
  currentMirror,
  thermalResistanceNetwork,
  bldcMotor,
  // Batch 7 — Motor (15 new)
  servoMotor,
  gearRatio,
  pwmDutyCycleMotor,
  torqueUnitConverter,
  motorEfficiency,
  inductionMotorSlip,
  motorInrushCurrent,
  motorHeatDissipation,
  encoderResolution,
  motorStartingTorque,
  batteryRuntimeMotor,
  motorWindingResistance,
  hBridgeSelection,
  motorDriverPower,
  pidTuning,
  // Batch 5 — Sensor / Unit-Conversion / Thermal / Signal / RF
  ntcThermistor,
  rtdTemperature,
  wheatstoneBridge,
  hallEffectSensor,
  strainGaugeBridge,
  // Sensor Batch 9
  pt100Resistance,
  thermocoupleVoltage,
  loadCellAmplifier,
  photodiodeTransimpedance,
  capacitiveProximity,
  currentShunt,
  accelerometerSensitivity,
  pressureBridgeOutput,
  sensorAccuracyBudget,
  opticalSensorRange,
  lvdtSensitivity,
  loopTransmitter420ma,
  frequencyWavelength,
  dbmWatts,
  temperatureConverter,
  awgWire,
  capacitorCode,
  // Unit Conversion Batch 7
  inductanceUnits,
  capacitanceUnits,
  resistanceUnits,
  currentUnits,
  voltageUnits,
  timeUnits,
  magneticFluxUnits,
  dataRateUnits,
  angleUnits,
  energyUnits,
  torqueUnitsConv,
  illuminanceUnits,
  junctionTemperature,
  heatsinkSelection,
  thermalViaArray,
  pllLoopFilter,
  berSnr,
  quantizationNoise,
  fresnelZone,
  powerDensity,
  balunTransformer,
  linkMargin,
  mixerSpurCalculator,
  // Batch 6 — General/Power/Protocol/PCB/EMC/Audio
  schmittTrigger,
  crystalLoadCapacitance,
  opampBandwidth,
  lm317Resistors,
  voltageRegulatorDropout,
  transformerTurnsRatio,
  flybackConverter,
  supercapacitorBackup,
  batteryInternalResistance,
  i2sTiming,
  linBusTiming,
  modbusFrameTiming,
  ethernetCable,
  powerPlaneImpedance,
  viaStubResonance,
  solderPasteVolume,
  emiFilterLc,
  esdTvsDiode,
  // EMC Batch 8
  commonModeChoke,
  decouplingCapacitorEmc,
  esdClampSelection,
  radiatedEmissionEstimate,
  groundPlaneImpedance,
  pcbCrosstalkEmc,
  powerSupplyRippleFilter,
  cableShieldEffectiveness,
  chassisResonance,
  emiMarginBudget,
  conductedEmissionsFilter,
  differentialModeFilter,
  audioPowerAmplifier,
  speakerCrossover,
  // Audio Batch 7
  roomModes,
  speakerSensitivity,
  headphonePower,
  audioSnr,
  opAmpSlewRate,
  audioTransformer,
  cableCapacitanceRolloff,
  subwooferBox,
  tweeterCapacitor,
  classDEfficiency,
  audioAdcSnr,
  equalizerQFactor,
  amplifierClipping,
  audioDelayTime,
  powerAmplifierGain
];
function getAllCalculators() {
  return ALL_CALCULATORS;
}
function getCalculator(slug) {
  return ALL_CALCULATORS.find((c) => c.slug === slug);
}
function getCalculatorsByCategory(category) {
  return ALL_CALCULATORS.filter((c) => c.category === category);
}

// src/lib/calculators/types.ts
var CATEGORIES = {
  rf: {
    slug: "rf",
    title: "RF & Microwave Calculators",
    shortTitle: "RF",
    icon: "radio",
    color: "#3B82F6",
    description: "Calculate VSWR, return loss, skin depth, noise figure, Smith chart impedance matching, link budgets, and more for RF and microwave circuits from MHz to mmWave."
  },
  pcb: {
    slug: "pcb",
    title: "PCB Design Calculators",
    shortTitle: "PCB",
    icon: "cpu",
    color: "#10B981",
    description: "Trace width, controlled impedance, via sizing, differential pairs, crosstalk, decoupling, and PCB thermal calculators for high-speed and high-power board design."
  },
  power: {
    slug: "power",
    title: "Power Electronics Calculators",
    shortTitle: "Power",
    icon: "zap",
    color: "#F59E0B",
    description: "Buck, boost, and flyback converter design, LDO dropout, MOSFET power dissipation, battery life, PWM duty cycle, and power factor calculators for power supply design."
  },
  signal: {
    slug: "signal",
    title: "Signal Processing Calculators",
    shortTitle: "Signal",
    icon: "activity",
    color: "#8B5CF6",
    description: "Filter design (Butterworth, Chebyshev), ADC SNR, FFT bin resolution, Johnson noise, BER vs SNR, PLL loop filter, and sampling/Nyquist calculators."
  },
  antenna: {
    slug: "antenna",
    title: "Antenna Design Calculators",
    shortTitle: "Antenna",
    icon: "radio",
    color: "#06B6D4",
    description: "Dipole, patch, Yagi, horn, parabolic dish, and loop antenna calculators for gain, beamwidth, EIRP, and resonant frequency from VHF to microwave bands."
  },
  general: {
    slug: "general",
    title: "General Electronics Calculators",
    shortTitle: "General",
    icon: "settings",
    color: "#6B7280",
    description: "Ohm's law, voltage dividers, op-amp gain, RC time constants, transistor biasing, 555 timer, crystal load capacitance, and other fundamental electronics calculators."
  },
  motor: {
    slug: "motor",
    title: "Motor Control Calculators",
    shortTitle: "Motor",
    icon: "rotate-cw",
    color: "#EF4444",
    description: "DC motor speed, stepper motor resolution, BLDC power, servo torque, gear ratios, PID tuning, H-bridge selection, and motor efficiency calculators."
  },
  protocol: {
    slug: "protocol",
    title: "Communications Calculators",
    shortTitle: "Comms",
    icon: "wifi",
    color: "#EC4899",
    description: "UART baud rate, I2C pull-up, SPI timing, CAN bus, USB termination, RS-485, I2S, LIN bus, Modbus frame timing, and Ethernet cable calculators."
  },
  emc: {
    slug: "emc",
    title: "EMC/EMI Calculators",
    shortTitle: "EMC",
    icon: "shield",
    color: "#14B8A6",
    description: "Shielding effectiveness, EMI filter design, ferrite bead selection, ESD/TVS diodes, radiated emission estimates, ground plane impedance, and crosstalk calculators."
  },
  thermal: {
    slug: "thermal",
    title: "Thermal Management Calculators",
    shortTitle: "Thermal",
    icon: "thermometer",
    color: "#F97316",
    description: "Heatsink selection, junction temperature, PCB trace temperature rise, thermal via arrays, and thermal resistance network calculators for component and board-level cooling."
  },
  sensor: {
    slug: "sensor",
    title: "Sensor Interface Calculators",
    shortTitle: "Sensor",
    icon: "cpu",
    color: "#84CC16",
    description: "NTC thermistor, RTD, thermocouple, Wheatstone bridge, load cell, 4-20 mA transmitter, photodiode transimpedance, and sensor accuracy budget calculators."
  },
  "unit-conversion": {
    slug: "unit-conversion",
    title: "Unit Conversion Calculators",
    shortTitle: "Convert",
    icon: "refresh-cw",
    color: "#A78BFA",
    description: "Frequency/wavelength, dBm/Watts, temperature, AWG wire gauge, capacitor codes, and unit converters for inductance, voltage, current, energy, data rate, and more."
  },
  audio: {
    slug: "audio",
    title: "Audio Electronics Calculators",
    shortTitle: "Audio",
    icon: "volume-2",
    color: "#F43F5E",
    description: "Speaker crossover design, room modes, amplifier power and clipping, headphone power, class-D efficiency, audio SNR, equalizer Q factor, and subwoofer box calculators."
  }
};

// ../rftools-mcp/mcp-server.ts
var VALID_CATEGORIES = Object.keys(CATEGORIES);
var API_BASE = process.env.RFTOOLS_API_BASE ?? "https://rftools.io/api/py";
var API_KEY = process.env.RFTOOLS_API_KEY ?? "";
var POLL_TIMEOUT_MS = 10 * 60 * 1e3;
var SIMULATION_TOOLS = [
  {
    slug: "impedance-matching",
    jobType: "impedance_match",
    title: "Broadband Impedance Matching Synthesizer",
    description: "Synthesize L, Pi, T, or ladder matching networks for broadband impedance transformation.",
    params: "sourceR (\u03A9), sourceX (\u03A9), loadR (\u03A9), loadX (\u03A9), freqStart (Hz), freqStop (Hz), topology (L|Pi|T|ladder_2|ladder_3)"
  },
  {
    slug: "filter-monte-carlo",
    jobType: "filter_monte_carlo",
    title: "RF Filter Monte Carlo Tolerance Analysis",
    description: "Monte Carlo yield analysis for RF filters \u2014 passband ripple, stopband degradation, worst-case sensitivity.",
    params: "filterType (butterworth|chebyshev|bessel|elliptic), order (int), frequency (Hz), ripple (dB), topology (lowpass|highpass|bandpass|bandstop), componentTolerance (%), monteCarloIterations (50\u201310000)"
  },
  {
    slug: "eye-diagram",
    jobType: "eye_diagram",
    title: "Eye Diagram Generator",
    description: "Generate eye diagrams from Touchstone S-parameter files with PRBS patterns, jitter, and ISI analysis.",
    params: "inputFileKeys (uploaded .s2p/.s4p keys), dataRate (bps), prbs (PRBS-7|PRBS-15|PRBS-31), samplesPerUI (int)"
  },
  {
    slug: "antenna-sim",
    jobType: "antenna_sim",
    title: "NEC2 Wire Antenna Simulator",
    description: "NEC2 antenna simulation: radiation patterns, gain, impedance for dipoles, Yagis, and loops.",
    params: "antennaType (dipole|yagi|loop), frequency (Hz), numElements (int, Yagi only), boomLength (m, Yagi only), height (m)"
  },
  {
    slug: "sparam-pipeline",
    jobType: "sparam_pipeline",
    title: "S-Parameter Analysis Pipeline",
    description: "Automated S-parameter analysis from Touchstone files: IL, RL, group delay, TDR, ripple.",
    params: "inputFileKeys (uploaded .s2p/.s4p keys), analysisTypes (array: il|rl|group_delay|tdr|ripple)"
  },
  {
    slug: "fdtd-sparam",
    jobType: "fdtd_sparam",
    title: "FDTD S-Parameter Simulator",
    description: "FDTD electromagnetic simulation for vias and PCB discontinuities \u2014 S-parameters across frequency.",
    params: "structure (via_single|via_differential|stripline_bend|coax_transition), frequency (Hz), meshDensity (coarse|normal|fine)"
  },
  {
    slug: "smps-control-loop",
    jobType: "smps_control_loop",
    title: "SMPS Control Loop Stability Analyzer",
    description: "Buck/boost/flyback control loop analysis: Bode plot, phase margin, gain margin, loop bandwidth.",
    params: "topology (buck|boost|flyback), vin (V), vout (V), iout (A), fsw (Hz), l (H), cout (F), rload (\u03A9), compensationType (type2|type3)"
  },
  {
    slug: "emi-radiated",
    jobType: "emi_radiated",
    title: "EMI Radiated Emissions Estimator",
    description: "PCB radiated emissions vs FCC Part 15 / CISPR 32 limits with Monte Carlo confidence intervals.",
    params: "traceLength (m), traceHeight (m), current (A), frequency (Hz), distance (m), numHarmonics (int), monteCarloRuns (int)"
  },
  {
    slug: "magnetics-optimizer",
    jobType: "magnetics_optimizer",
    title: "Magnetics Optimizer (NSGA-II)",
    description: "NSGA-II Pareto-optimal transformer/inductor design across 113 cores from TDK, Ferroxcube, Magnetics Inc., Micrometals.",
    params: "designType (transformer|inductor), frequency (Hz), power (W), vin (V), vout (V, transformer), turns_ratio (float, transformer), inductance (H, inductor), population (int), generations (int)"
  },
  {
    slug: "radar-detection",
    jobType: "radar_detection",
    title: "Radar Detection Probability Calculator",
    description: "All five Swerling models, non-coherent pulse integration, ITU-R P.838 rain attenuation, Monte Carlo uncertainty bands, ROC curves.",
    params: "pt (W), gt (dB), gr (dB), frequency (Hz), rcs (m\xB2), range (m), noiseFigure (dB), bandwidth (Hz), numPulses (int), swerlingModel (0\u20134), rainRate (mm/hr)"
  },
  {
    slug: "pdn-impedance",
    jobType: "pdn_impedance",
    title: "PDN Impedance Analyzer",
    description: "Power delivery network impedance with plane-pair cavity resonance (Novak) and genetic algorithm decoupling optimizer.",
    params: "planesX (m), planesY (m), planesSeparation (m), vrmR (\u03A9), vrmL (H), vrmC (F), targetImpedance (\u03A9), freqPoints (int), population (int), generations (int), capBudget (int)"
  },
  {
    slug: "sat-link-budget",
    jobType: "sat_link_budget",
    title: "Satellite Link Budget (ITU-R)",
    description: "Satellite/terrestrial link budget with ITU-R P.618 rain, P.676 gaseous, P.840 cloud models and Monte Carlo confidence intervals.",
    params: "eirp (dBW), frequency (Hz), distance (m), gt (dB/K), bandwidth (Hz), elevation (deg), latitude (deg), availability (%), mcTrials (int)"
  },
  {
    slug: "rf-cascade",
    jobType: "rf_cascade",
    title: "RF Cascade Budget with Monte Carlo",
    description: "Friis noise figure, cascaded IIP3, P1dB, SFDR, and Monte Carlo yield for multi-stage RF chains.",
    params: "stages (array of {type, gain, nf, iip3, p1db, tolerance}), frequency (Hz), temperature (K), mcTrials (int)"
  }
];
async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function pollInterval(elapsedMs) {
  return elapsedMs < 12e4 ? 5e3 : 1e4;
}
var server = new import_mcp.McpServer({
  name: "rftools",
  version: "1.3.1"
});
server.registerTool(
  "list_calculators",
  {
    title: "List Calculators",
    description: "List available RF & electronics calculators. Optionally filter by category: rf, pcb, power, signal, antenna, general, motor, protocol, emc, thermal, sensor, unit-conversion, audio.",
    inputSchema: import_zod.z.object({
      category: import_zod.z.string().optional().describe("Calculator category to filter by (e.g. rf, pcb, power)")
    })
  },
  async ({ category }) => {
    const calcs = category ? getCalculatorsByCategory(category) : getAllCalculators();
    if (category && !VALID_CATEGORIES.includes(category)) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown category "${category}". Valid categories: ${VALID_CATEGORIES.join(", ")}`
          }
        ],
        isError: true
      };
    }
    const listing = calcs.map((c) => ({
      slug: c.slug,
      title: c.title,
      category: c.category,
      description: c.description
    }));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(listing, null, 2)
        }
      ]
    };
  }
);
server.registerTool(
  "get_calculator_info",
  {
    title: "Get Calculator Info",
    description: "Get detailed information about a specific calculator including its inputs, outputs, and formula. Use this to understand what parameters a calculator needs before running it.",
    inputSchema: import_zod.z.object({
      slug: import_zod.z.string().describe('Calculator slug (e.g. "microstrip-impedance")')
    })
  },
  async ({ slug }) => {
    const calc = getCalculator(slug);
    if (!calc) {
      return {
        content: [
          {
            type: "text",
            text: `Calculator "${slug}" not found. Use list_calculators to see available calculators.`
          }
        ],
        isError: true
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
        tooltip: i.tooltip
      })),
      outputs: calc.outputs.map((o) => ({
        key: o.key,
        label: o.label,
        unit: o.unit,
        tooltip: o.tooltip
      })),
      formula: calc.formula.primary,
      keywords: calc.keywords
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(info, null, 2)
        }
      ]
    };
  }
);
server.registerTool(
  "run_calculation",
  {
    title: "Run Calculation",
    description: "Run an RF/electronics calculator with the given inputs. Use get_calculator_info first to see required inputs.",
    inputSchema: import_zod.z.object({
      slug: import_zod.z.string().describe('Calculator slug (e.g. "microstrip-impedance")'),
      inputs: import_zod.z.record(import_zod.z.string(), import_zod.z.number()).describe('Input values keyed by input name (e.g. {"traceWidth": 1.2, "substrateHeight": 1.6})')
    })
  },
  async ({ slug, inputs }) => {
    const calc = getCalculator(slug);
    if (!calc) {
      return {
        content: [
          {
            type: "text",
            text: `Calculator "${slug}" not found. Use list_calculators to see available calculators.`
          }
        ],
        isError: true
      };
    }
    try {
      const result = calc.calculate(inputs);
      const results = calc.outputs.map((o) => ({
        key: o.key,
        label: o.label,
        value: result.values[o.key],
        unit: o.unit
      }));
      const webUrl = `https://rftools.io/calculators/${calc.category}/${calc.slug}`;
      const response = {
        slug: calc.slug,
        results,
        webUrl
      };
      if (result.warnings?.length) response.warnings = result.warnings;
      if (result.errors?.length) response.errors = result.errors;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Calculation error: ${err instanceof Error ? err.message : String(err)}`
          }
        ],
        isError: true
      };
    }
  }
);
server.registerTool(
  "list_simulation_tools",
  {
    title: "List Simulation Tools",
    description: "List the 14 server-side RF simulation tools available via API key. These require RFTOOLS_API_KEY (set in env). Free tier: 5 runs/month. Pro: 100/month. API tier: 10 000/month.",
    inputSchema: import_zod.z.object({})
  },
  async () => {
    const listing = SIMULATION_TOOLS.map((t) => ({
      slug: t.slug,
      jobType: t.jobType,
      title: t.title,
      description: t.description,
      params: t.params
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(listing, null, 2) }]
    };
  }
);
server.registerTool(
  "run_simulation",
  {
    title: "Run Simulation Tool",
    description: "Submit a server-side RF simulation job and wait for the result. Requires RFTOOLS_API_KEY environment variable. Simulations typically complete in 15\u2013120 seconds; queue wait may add more time. Use list_simulation_tools to see available jobTypes and required params.",
    inputSchema: import_zod.z.object({
      jobType: import_zod.z.string().describe(
        'Job type identifier (e.g. "impedance_match", "filter_monte_carlo", "emi_radiated"). Use list_simulation_tools to see all valid values.'
      ),
      params: import_zod.z.record(import_zod.z.string(), import_zod.z.unknown()).describe(
        "Simulation parameters as key/value pairs. Use list_simulation_tools to see required params per jobType."
      )
    })
  },
  async ({ jobType, params }) => {
    if (!API_KEY) {
      return {
        content: [{
          type: "text",
          text: 'RFTOOLS_API_KEY is not set. Add it to your MCP config:\n  "env": { "RFTOOLS_API_KEY": "rfc_..." }\nGet a key at https://rftools.io/dashboard'
        }],
        isError: true
      };
    }
    const tool = SIMULATION_TOOLS.find((t) => t.jobType === jobType);
    if (!tool) {
      const valid = SIMULATION_TOOLS.map((t) => t.jobType).join(", ");
      return {
        content: [{
          type: "text",
          text: `Unknown jobType "${jobType}". Valid values: ${valid}`
        }],
        isError: true
      };
    }
    let submitResp;
    try {
      submitResp = await apiPost("/v1/jobs", { jobType, params });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.includes("quota")) {
        return {
          content: [{
            type: "text",
            text: `API key error: ${msg}
Check your quota at https://rftools.io/dashboard`
          }],
          isError: true
        };
      }
      return {
        content: [{ type: "text", text: `Failed to submit job: ${msg}` }],
        isError: true
      };
    }
    const { jobId } = submitResp;
    const started = Date.now();
    while (true) {
      const elapsed = Date.now() - started;
      if (elapsed >= POLL_TIMEOUT_MS) {
        return {
          content: [{
            type: "text",
            text: `Simulation timed out after 10 minutes. Job ID: ${jobId}
Check status at https://rftools.io/tools/${tool.slug}/results?jobId=${jobId}`
          }],
          isError: true
        };
      }
      await sleep(pollInterval(elapsed));
      let statusResp;
      try {
        statusResp = await apiGet(`/v1/jobs/${jobId}`);
      } catch (err) {
        console.error(`[rftools] poll error for ${jobId}:`, err);
        continue;
      }
      const { status, queuePosition, queueTotal, resultUrl, errorMessage, progress } = statusResp;
      if (status === "queued") {
        const pos = queuePosition != null ? `position ${queuePosition}/${queueTotal ?? "?"}` : "waiting";
        console.error(`[rftools] ${jobId} queued \u2014 ${pos} (+${Math.round(elapsed / 1e3)}s elapsed)`);
        continue;
      }
      if (status === "processing") {
        const pct = progress != null ? ` ${Math.round(progress * 100)}%` : "";
        console.error(`[rftools] ${jobId} processing${pct} (+${Math.round(elapsed / 1e3)}s elapsed)`);
        continue;
      }
      if (status === "failed") {
        return {
          content: [{
            type: "text",
            text: `Simulation failed: ${errorMessage ?? "unknown error"}
Job ID: ${jobId}`
          }],
          isError: true
        };
      }
      if (status === "completed" && resultUrl) {
        let resultData;
        try {
          const res = await fetch(resultUrl);
          if (!res.ok) throw new Error(`Result fetch ${res.status}`);
          resultData = await res.json();
        } catch (err) {
          return {
            content: [{
              type: "text",
              text: `Job completed but result fetch failed: ${err instanceof Error ? err.message : String(err)}
View at: https://rftools.io/tools/${tool.slug}/results?jobId=${jobId}`
            }],
            isError: true
          };
        }
        const webUrl = `https://rftools.io/tools/${tool.slug}/results?jobId=${jobId}`;
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ jobId, jobType, tool: tool.title, webUrl, result: resultData }, null, 2)
          }]
        };
      }
    }
  }
);
async function main() {
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
  console.error("rftools MCP server running on stdio");
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
