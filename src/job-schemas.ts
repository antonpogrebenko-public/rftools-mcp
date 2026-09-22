// The async-job contract, imported from the generated JSON Schemas.
//
// shared/job-schemas/*.json is generated from frontend/src/lib/tools/registry.ts
// by scripts/sync_job_schemas.ts and checked for drift before deploy. Nothing
// about a job type's parameters is typed by hand here: the tool list, the
// parameter names, their ranges, units, defaults and tier bounds all come from
// these files, so a contract change reaches the MCP server at the next build.
//
// The imports are static so that esbuild inlines them — the published package
// ships only dist/mcp-server.cjs, so the bundle has to be self-contained.

import indexJson from '../../shared/job-schemas/index.json' with { type: 'json' };
import antennaSim from '../../shared/job-schemas/antenna_sim.json' with { type: 'json' };
import emiRadiated from '../../shared/job-schemas/emi_radiated.json' with { type: 'json' };
import eyeDiagram from '../../shared/job-schemas/eye_diagram.json' with { type: 'json' };
import fdtdSparam from '../../shared/job-schemas/fdtd_sparam.json' with { type: 'json' };
import filterMonteCarlo from '../../shared/job-schemas/filter_monte_carlo.json' with { type: 'json' };
import impedanceMatch from '../../shared/job-schemas/impedance_match.json' with { type: 'json' };
import magneticsOptimizer from '../../shared/job-schemas/magnetics_optimizer.json' with { type: 'json' };
import pdnImpedance from '../../shared/job-schemas/pdn_impedance.json' with { type: 'json' };
import radarDetection from '../../shared/job-schemas/radar_detection.json' with { type: 'json' };
import rfCascade from '../../shared/job-schemas/rf_cascade.json' with { type: 'json' };
import satLinkBudget from '../../shared/job-schemas/sat_link_budget.json' with { type: 'json' };
import smpsControlLoop from '../../shared/job-schemas/smps_control_loop.json' with { type: 'json' };
import sparamPipeline from '../../shared/job-schemas/sparam_pipeline.json' with { type: 'json' };

/** One parameter of a job type, as the generated schema describes it. */
export interface JobParamSchema {
  type?: 'number' | 'integer' | 'string' | 'boolean' | 'array' | 'object';
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
  'x-label'?: string;
  'x-unit'?: string;
  'x-tooltip'?: string;
  'x-hidden'?: boolean;
  /** Which branch of the form this parameter belongs to; a list means several. */
  'x-showWhen'?: { key: string; value: string | string[] };
  /** Per-tier bound: { free: { maximum: 500 } }. */
  'x-tier'?: Record<string, { minimum?: number; maximum?: number }>;
  /** What the handler computes when the parameter is absent. */
  'x-derived'?: string;
  /** Enum values a paid tier is required for. */
  'x-paidOnly'?: string[];
  'x-dimensionless'?: boolean;
  'x-step'?: number;
  /** Source file describing a structure the schema does not: pass it through as given. */
  'x-ref'?: string;
}

/** The file input a job type takes, when it takes one. */
export interface JobFileSchema {
  min: number;
  max: number;
  extensions: string[];
  label?: string;
}

/** One job type's whole parameter contract. */
export interface JobSchema {
  type: 'object';
  additionalProperties: false;
  required: string[];
  properties: Record<string, JobParamSchema>;
  'x-jobType': string;
  'x-slug': string;
  'x-title': string;
  'x-checks': string[];
  'x-files'?: JobFileSchema;
}

/** One job type's entry in the index. */
export interface JobIndexEntry {
  slug: string;
  title: string;
  tiers: string[];
  timeoutSeconds: number;
  files: boolean;
}

const RAW_SCHEMAS = [
  antennaSim,
  emiRadiated,
  eyeDiagram,
  fdtdSparam,
  filterMonteCarlo,
  impedanceMatch,
  magneticsOptimizer,
  pdnImpedance,
  radarDetection,
  rfCascade,
  satLinkBudget,
  smpsControlLoop,
  sparamPipeline,
] as unknown as JobSchema[];

/** Every job type's schema, keyed by job type. */
export const JOB_SCHEMAS: Record<string, JobSchema> = Object.fromEntries(
  RAW_SCHEMAS.map((s) => [s['x-jobType'], s]),
);

/** The index: slug, title, tiers, time budget and whether the job takes files. */
export const JOB_INDEX: Record<string, JobIndexEntry> =
  (indexJson as unknown as { jobTypes: Record<string, JobIndexEntry> }).jobTypes;

/** The cross-job checks the service applies, named. */
export const JOB_CHECKS: string[] = (indexJson as unknown as { checks: string[] }).checks;

/** Every job type, in index order. Every count published anywhere derives from this. */
export const JOB_TYPES: string[] = Object.keys(JOB_INDEX);

/** The MCP tool name for a job type: `simulate_<slug with underscores>`. */
export function toolNameForJobType(jobType: string): string {
  const entry = JOB_INDEX[jobType];
  if (!entry) throw new Error(`Unknown jobType "${jobType}"`);
  return `simulate_${entry.slug.replace(/-/g, '_')}`;
}

/** The results page for a finished job. */
export function webUrlFor(jobType: string, jobId: string): string {
  const slug = JOB_INDEX[jobType]?.slug ?? jobType;
  return `https://rftools.io/tools/${slug}/results?jobId=${jobId}`;
}

/** The file contract for a job type, or null when it takes no files. */
export function fileSchemaFor(jobType: string): JobFileSchema | null {
  return JOB_SCHEMAS[jobType]?.['x-files'] ?? null;
}

/** Every job type the contract knows, with the facts a caller needs to choose one. */
export function listJobTypes(): Array<
  JobIndexEntry & { jobType: string; toolName: string; params: string[]; files: JobFileSchema | null }
> {
  return JOB_TYPES.map((jobType) => ({
    jobType,
    toolName: toolNameForJobType(jobType),
    ...JOB_INDEX[jobType],
    params: Object.keys(JOB_SCHEMAS[jobType]?.properties ?? {}),
    files: fileSchemaFor(jobType),
  }));
}

/** Sanity check at startup: the index and the schema files must describe the same set. */
export function assertContractConsistent(): void {
  const schemaTypes = Object.keys(JOB_SCHEMAS).sort();
  const indexTypes = [...JOB_TYPES].sort();
  if (schemaTypes.join(',') !== indexTypes.join(',')) {
    throw new Error(
      `job-schema drift: index has [${indexTypes.join(', ')}] but the schema files have [${schemaTypes.join(', ')}]`,
    );
  }
  for (const jobType of indexTypes) {
    const hasFiles = Boolean(JOB_SCHEMAS[jobType]['x-files']);
    if (hasFiles !== JOB_INDEX[jobType].files) {
      throw new Error(`job-schema drift: ${jobType} disagrees about file inputs`);
    }
  }
}
