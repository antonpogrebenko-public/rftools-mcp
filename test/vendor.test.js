// vendor/ (see scripts/vendor_shared.sh) is what src/ and test/ actually read
// at runtime, so a stale vendored copy would silently ship or test the wrong
// contract. `npm run build:check` catches that in the monorepo (it shells out
// to `scripts/vendor_shared.sh --check`), and this file catches it from
// `npm test` too, so a plain `npm test` inside the monorepo also notices.
//
// Every test here is skipped, not failed, when the thing it compares against
// isn't there — a standalone checkout of this repository (what
// .github/workflows/test.yml tests) has no ../shared or ../frontend beside
// it, only the vendored copies this file exists to keep honest.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const MONOREPO_JOB_SCHEMAS = here('../../shared/job-schemas');
const MONOREPO_PROVENANCE = here('../../shared/result-provenance.schema.json');
const MONOREPO_FIXTURES = here('../../frontend/src/components/async-tool/results/__tests__/fixtures');

const VENDOR_JOB_SCHEMAS = here('../vendor/shared/job-schemas');
const VENDOR_PROVENANCE = here('../vendor/shared/result-provenance.schema.json');
const VENDOR_FIXTURES = here('../vendor/frontend-fixtures');

// The fixtures test/results.test.js reads — see FIXTURE_DIR there and
// scripts/vendor_shared.sh's FIXTURE_NAMES, which must list the same files.
const FIXTURE_NAMES = [
  'sparam-4port.json',
  'antenna-sweep.json',
  'eye-lossy-line.json',
  'smps-subharmonic.json',
  'magnetics-verified.json',
];

const hasSharedContract = existsSync(MONOREPO_JOB_SCHEMAS) && existsSync(MONOREPO_PROVENANCE);
const noSharedReason = 'no ../shared next to this checkout (standalone rftools-mcp, or a package build)';

const hasFrontendFixtures = existsSync(MONOREPO_FIXTURES);
const noFixturesReason = 'no ../frontend next to this checkout (standalone rftools-mcp, or a package build)';

test(
  'vendor/shared/job-schemas has exactly the files ../shared/job-schemas has',
  { skip: !hasSharedContract && noSharedReason },
  () => {
    const sourceNames = readdirSync(MONOREPO_JOB_SCHEMAS).filter((n) => n.endsWith('.json')).sort();
    const vendoredNames = readdirSync(VENDOR_JOB_SCHEMAS).filter((n) => n.endsWith('.json')).sort();
    assert.deepEqual(
      vendoredNames,
      sourceNames,
      'vendor/shared/job-schemas/ is out of date — run `npm run vendor` in rftools-mcp',
    );
  },
);

test(
  'vendor/shared/job-schemas matches ../shared/job-schemas, file for file',
  { skip: !hasSharedContract && noSharedReason },
  () => {
    const mismatches = [];
    for (const name of readdirSync(MONOREPO_JOB_SCHEMAS).filter((n) => n.endsWith('.json'))) {
      const vendoredPath = `${VENDOR_JOB_SCHEMAS}/${name}`;
      if (!existsSync(vendoredPath)) { mismatches.push(name); continue; }
      const source = JSON.parse(readFileSync(`${MONOREPO_JOB_SCHEMAS}/${name}`, 'utf8'));
      const vendored = JSON.parse(readFileSync(vendoredPath, 'utf8'));
      if (JSON.stringify(source) !== JSON.stringify(vendored)) mismatches.push(name);
    }
    assert.deepEqual(mismatches, [], 'run `npm run vendor` in rftools-mcp');
  },
);

test(
  'vendor/shared/result-provenance.schema.json is byte-identical to ../shared/result-provenance.schema.json',
  { skip: !hasSharedContract && noSharedReason },
  () => {
    assert.deepEqual(
      readFileSync(VENDOR_PROVENANCE),
      readFileSync(MONOREPO_PROVENANCE),
      'vendor/shared/result-provenance.schema.json is out of date — run `npm run vendor` in rftools-mcp',
    );
  },
);

test(
  'vendor/frontend-fixtures matches the frontend fixtures it copies',
  { skip: !hasFrontendFixtures && noFixturesReason },
  () => {
    const mismatches = [];
    for (const name of FIXTURE_NAMES) {
      const vendoredPath = `${VENDOR_FIXTURES}/${name}`;
      if (!existsSync(vendoredPath)) { mismatches.push(name); continue; }
      const source = JSON.parse(readFileSync(`${MONOREPO_FIXTURES}/${name}`, 'utf8'));
      const vendored = JSON.parse(readFileSync(vendoredPath, 'utf8'));
      if (JSON.stringify(source) !== JSON.stringify(vendored)) mismatches.push(name);
    }
    assert.deepEqual(mismatches, [], 'run `npm run vendor` in rftools-mcp');
  },
);
