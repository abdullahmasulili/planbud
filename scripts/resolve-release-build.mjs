import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Counts earlier release runs for one app version, excluding future runs and duplicate pages.
 * @param pages Paginated workflow-run API responses.
 * @param runNumber Current workflow run number, unchanged on retries.
 * @param version Current app version from app.json.
 * @param readVersion Reads the app version at a validated historical commit SHA.
 * @returns One-based build number for this app version, including failed/cancelled earlier runs.
 * @throws When run history or a historical app version cannot be validated.
 */
export const countReleaseBuild = (pages, runNumber, version, readVersion) => {
  if (!Array.isArray(pages) || !Number.isInteger(runNumber) || runNumber < 1)
    throw new Error('Invalid release run history or current run number.');
  const seen = new Set();
  const versions = new Map();
  let build = 1;
  // shortcut: numbering depends on retained run history; use durable release records before pruning runs.
  for (const page of pages) {
    if (!Array.isArray(page?.workflow_runs)) throw new Error('Invalid workflow run history.');
    for (const run of page.workflow_runs) {
      if (run?.event !== 'push' || run.head_branch !== 'gitops/release-build') continue;
      if (
        !Number.isInteger(run.run_number) ||
        run.run_number < 1 ||
        !/^[a-f0-9]{40}$/.test(run.head_sha)
      )
        throw new Error('Invalid release run identity.');
      if (run.run_number >= runNumber || seen.has(run.run_number)) continue;
      seen.add(run.run_number);
      if (!versions.has(run.head_sha)) versions.set(run.head_sha, readVersion(run.head_sha));
      const historicalVersion = versions.get(run.head_sha);
      if (typeof historicalVersion !== 'string' || !historicalVersion)
        throw new Error('Invalid historical app version.');
      if (historicalVersion === version) build += 1;
    }
  }
  return build;
};

/** Reads authored version metadata without exposing git diagnostics or machine paths.
 * @param sha Validated historical release commit SHA.
 * @returns App version recorded in that commit's app.json.
 * @throws When checkout history is incomplete or authored version metadata is invalid.
 */
const readVersion = (sha) => {
  const result = spawnSync('git', ['show', `${sha}:app.json`], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0)
    throw new Error(
      'Cannot read a previous release version; full release git history is required.',
    );
  return JSON.parse(result.stdout).expo?.version;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const history = process.argv[2];
  const output = process.env.GITHUB_OUTPUT;
  const currentRun = process.env.GITHUB_RUN_NUMBER;
  if (!history || !output || !/^[1-9]\d*$/.test(currentRun ?? ''))
    throw new Error('Supply workflow history, GITHUB_RUN_NUMBER and GITHUB_OUTPUT.');
  const { expo } = JSON.parse(readFileSync('app.json', 'utf8'));
  if (typeof expo?.version !== 'string' || !expo.version)
    throw new Error('Set the app version in app.json before building.');
  const build = countReleaseBuild(
    JSON.parse(readFileSync(history, 'utf8')),
    Number(currentRun),
    expo.version,
    readVersion,
  );
  appendFileSync(output, `build-number=${build}\n`);
  process.stdout.write(`Release ${expo.version}+${build}; Android versionCode ${currentRun}.\n`);
}
