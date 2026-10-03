// The site's reference tables as MCP resources (openspec agent-surface,
// design D6): rftools://reference/{domain}/{id}, one resource template per
// domain, one resource per page the site publishes under /reference/.
//
// Every entry comes from the same modules and the same getAll…Slugs()
// functions the /reference/ routes are generated from, so the resource count
// of each domain is the page count of that domain by construction, and an
// entry added to the site is listed here at the next build.
//
// This module imports the frontend through the `@` alias, so it is tested
// through the built bundle (test/discovery.test.js).

import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getAllConnectorSlugs, getRfConnector } from '@/lib/reference/connectors';
import {
  CAPACITOR_CODES,
  CAPACITOR_TEMP_CODES,
  CAPACITOR_TOLERANCE_CODES,
  CAPACITOR_VOLTAGE_CODES,
  SMD_3DIGIT_CODES,
  SMD_4DIGIT_CODES,
  SMD_EIA96_CODES,
  getAllCodeTableSlugs,
  getCodeTable,
  type CodeTableSection,
} from '@/lib/reference/component-codes';
import { getAllFrequencyBandSlugs, getFrequencyBand } from '@/lib/reference/frequency-bands';
import { COPPER_WEIGHTS, PCB_THICKNESSES, getAllPcbSpecSlugs, getPcbSpec } from '@/lib/reference/pcb-specs';
import { getAllStandardValueSlugs, getStandardValueTable } from '@/lib/reference/standard-values';
// The standards each table names on its page — the same list the pages'
// structured data cites as isBasedOn.
import { REFERENCE_TABLE_STANDARDS } from '@/lib/seo/jsonld/pages/reference';

export const REFERENCE_SCHEME = 'rftools://reference';
const SITE = 'https://rftools.io';
const MIME = 'application/json';

/** Where an entry's values come from, as its page states it. */
export interface ReferenceSource {
  /** Standards or series the page names; empty when it names none. */
  standards: string[];
  /** The page's own note on the values' origin, when it has one. */
  note: string | null;
}

export interface ReferenceEntry {
  name: string;
  /** One line for the resource listing. */
  summary: string;
  source: ReferenceSource;
  values: Record<string, unknown>;
}

interface ReferenceDomain {
  domain: 'bands' | 'connectors' | 'values' | 'codes' | 'pcb';
  title: string;
  description: string;
  slugs: () => string[];
  entry: (slug: string) => ReferenceEntry | undefined;
}

function standardsFor(domain: string, slug: string): string[] {
  return [...(REFERENCE_TABLE_STANDARDS[`${domain}/${slug}`] ?? [])];
}

/** A table as columns and rows: the codes tables run to hundreds of rows. */
function table(columns: string[], rows: unknown[][]): Record<string, unknown> {
  return { columns, rows };
}

function codeSection(section: CodeTableSection): Record<string, unknown> {
  const head = { title: section.title, ...(section.description ? { description: section.description } : {}) };
  switch (section.type) {
    case 'smd-3digit':
      return { ...head, ...table(['code', 'resistanceOhm', 'tolerancePercent'], SMD_3DIGIT_CODES.map((c) => [c.code, c.resistance, c.tolerancePercent])) };
    case 'smd-4digit':
      return { ...head, ...table(['code', 'resistanceOhm', 'tolerancePercent'], SMD_4DIGIT_CODES.map((c) => [c.code, c.resistance, c.tolerancePercent])) };
    case 'smd-eia96':
      return { ...head, ...table(['code', 'resistanceOhm', 'tolerancePercent'], SMD_EIA96_CODES.map((c) => [c.code, c.resistance, c.tolerancePercent])) };
    case 'capacitor-3digit':
      return { ...head, ...table(['code', 'picofarads', 'description'], CAPACITOR_CODES.map((c) => [c.code, c.picofarads, c.description ?? null])) };
    case 'capacitor-voltage':
      return { ...head, ...table(['code', 'volts'], Object.entries(CAPACITOR_VOLTAGE_CODES)) };
    case 'capacitor-tolerance':
      return { ...head, ...table(['code', 'tolerance'], Object.entries(CAPACITOR_TOLERANCE_CODES)) };
    case 'capacitor-temp':
      return {
        ...head,
        ...table(['code', 'name', 'range', 'stability'], Object.entries(CAPACITOR_TEMP_CODES).map(([code, t]) => [code, t.name, t.range, t.stability])),
      };
    default:
      throw new Error(`reference codes: no table for section type ${(section as CodeTableSection).type}`);
  }
}

export const REFERENCE_DOMAINS: ReferenceDomain[] = [
  {
    domain: 'bands',
    title: 'Frequency bands',
    description: 'A frequency band: its limits, wavelength, ITU designation, uses, propagation and regulatory notes.',
    slugs: getAllFrequencyBandSlugs,
    entry: (slug) => {
      const b = getFrequencyBand(slug);
      if (!b) return undefined;
      return {
        name: b.name,
        summary: `${b.shortName}: ${b.freqLabel}`,
        source: { standards: b.ituDesignation ? [b.ituDesignation] : [], note: b.regulatoryNotes },
        values: {
          shortName: b.shortName,
          category: b.category,
          freqMinHz: b.freqMinHz,
          freqMaxHz: b.freqMaxHz,
          freqLabel: b.freqLabel,
          wavelengthLabel: b.wavelengthLabel,
          ituDesignation: b.ituDesignation ?? null,
          applications: b.applications,
          propagationNotes: b.propagationNotes,
          regulatoryNotes: b.regulatoryNotes,
          relatedCalculators: b.relatedCalcSlugs,
        },
      };
    },
  },
  {
    domain: 'connectors',
    title: 'RF connectors',
    description: 'An RF connector: impedance, frequency and power limits, VSWR, mating cycles, materials and uses.',
    slugs: getAllConnectorSlugs,
    entry: (slug) => {
      const c = getRfConnector(slug);
      if (!c) return undefined;
      return {
        name: c.name,
        summary: `${c.shortName}: ${c.impedanceOhm} Ω, ${c.freqLabel}`,
        // The connector pages cite no standard for their figures.
        source: { standards: [], note: null },
        values: {
          shortName: c.shortName,
          impedanceOhm: c.impedanceOhm,
          freqMaxGHz: c.freqMaxGHz,
          freqLabel: c.freqLabel,
          powerMaxW: c.powerMaxW ?? null,
          vswr: c.vswr ?? null,
          matingCycles: c.matingCycles ?? null,
          bodyMaterial: c.bodyMaterial,
          contactMaterial: c.contactMaterial,
          gender: c.gender,
          size: c.size,
          applications: c.applications,
          notes: c.notes,
          relatedCalculators: c.relatedCalcSlugs,
        },
      };
    },
  },
  {
    domain: 'values',
    title: 'Standard values',
    description: 'A standard-value table: E-series resistors and capacitors, wire gauges, drills, threads, SI prefixes.',
    slugs: getAllStandardValueSlugs,
    entry: (slug) => {
      const t = getStandardValueTable(slug);
      if (!t) return undefined;
      return {
        name: t.name,
        summary: t.shortName,
        source: { standards: standardsFor('values', slug), note: t.sourceNote ?? t.toleranceNote ?? null },
        values: {
          shortName: t.shortName,
          category: t.category,
          description: t.description,
          ...(t.answer ? { answer: t.answer } : {}),
          columns: t.columns,
          rows: t.data,
          ...(t.toleranceNote ? { toleranceNote: t.toleranceNote } : {}),
          relatedCalculators: t.relatedCalcSlugs,
        },
      };
    },
  },
  {
    domain: 'codes',
    title: 'Component marking codes',
    description: 'A marking-code chart: SMD resistor codes or capacitor value, voltage, tolerance and dielectric codes.',
    slugs: getAllCodeTableSlugs,
    entry: (slug) => {
      const t = getCodeTable(slug);
      if (!t) return undefined;
      return {
        name: t.name,
        summary: t.shortName,
        source: { standards: standardsFor('codes', slug), note: null },
        values: {
          shortName: t.shortName,
          description: t.description,
          ...(t.answer ? { answer: t.answer } : {}),
          sections: t.sections.map(codeSection),
          relatedCalculators: t.relatedCalcSlugs,
        },
      };
    },
  },
  {
    domain: 'pcb',
    title: 'PCB specifications',
    description: 'A PCB specification table: copper weight against thickness and current, or standard board thicknesses.',
    slugs: getAllPcbSpecSlugs,
    entry: (slug) => {
      const s = getPcbSpec(slug);
      if (!s) return undefined;
      const rows = s.type === 'copper-weight' ? COPPER_WEIGHTS : PCB_THICKNESSES;
      return {
        name: s.name,
        summary: s.shortName,
        source: { standards: standardsFor('pcb', slug), note: null },
        values: {
          shortName: s.shortName,
          type: s.type,
          description: s.description,
          rows,
          relatedCalculators: s.relatedCalcSlugs,
        },
      };
    },
  },
];

/** How many pages each domain publishes, from the same getAll…Slugs() the /reference/ routes use. */
export function referenceSlugCounts(): Record<string, number> {
  return Object.fromEntries(REFERENCE_DOMAINS.map((d) => [d.domain, d.slugs().length]));
}

export function referenceUri(domain: string, slug: string): string {
  return `${REFERENCE_SCHEME}/${domain}/${slug}`;
}

export function referenceTemplate(domain: string): string {
  return `${REFERENCE_SCHEME}/${domain}/{id}`;
}

export function referencePageUrl(domain: string, slug: string): string {
  return `${SITE}/reference/${domain}/${slug}/`;
}

/** The JSON a read returns, or undefined for an identifier the domain does not have. */
export function readReference(domain: string, slug: string): Record<string, unknown> | undefined {
  const d = REFERENCE_DOMAINS.find((x) => x.domain === domain);
  const entry = d?.entry(slug);
  if (!d || !entry) return undefined;
  return {
    domain,
    id: slug,
    name: entry.name,
    url: referencePageUrl(domain, slug),
    source: entry.source,
    ...entry.values,
  };
}

export function registerReferenceResources(server: McpServer): string[] {
  const names: string[] = [];
  for (const d of REFERENCE_DOMAINS) {
    const name = `reference-${d.domain}`;
    names.push(name);
    server.registerResource(
      name,
      new ResourceTemplate(referenceTemplate(d.domain), {
        list: async () => ({
          resources: d.slugs().map((slug) => {
            const entry = d.entry(slug)!;
            return {
              uri: referenceUri(d.domain, slug),
              name: `${d.domain}/${slug}`,
              title: entry.name,
              description: entry.summary,
              mimeType: MIME,
            };
          }),
        }),
        complete: {
          id: (value: string) => d.slugs().filter((slug) => slug.startsWith(value ?? '')),
        },
      }),
      {
        title: d.title,
        description: `${d.description} Look up by identifier: ${referenceTemplate(d.domain)}.`,
        mimeType: MIME,
      },
      async (uri, variables) => {
        const raw = variables.id;
        const id = Array.isArray(raw) ? raw[0] : raw;
        const body = id ? readReference(d.domain, id) : undefined;
        if (!body) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `No ${d.domain} entry "${id ?? ''}". Look one up with ${referenceTemplate(d.domain)}, where id is one of: ` +
              `${d.slugs().join(', ')}.`,
          );
        }
        return { contents: [{ uri: uri.href, mimeType: MIME, text: JSON.stringify(body) }] };
      },
    );
  }
  return names;
}
