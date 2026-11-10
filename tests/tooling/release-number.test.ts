import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/** Creates workflow-run metadata without reading the network or repository history.
 * @param number Workflow's global sequence number.
 * @param key Repeated hexadecimal fixture character identifying a historical commit.
 * @returns Synthetic push to the release branch.
 */
const releaseRun = (number: number, key: string) => ({
  run_number: number,
  head_sha: key.repeat(40),
  event: 'push',
  head_branch: 'gitops/release-build',
});

/** Evaluates the resolver with deterministic historical versions through its public port.
 * @param pages Synthetic paginated workflow-run API responses.
 * @param runNumber Current workflow run, unchanged on retries.
 * @param version App version whose build sequence is being resolved.
 * @returns Resolver subprocess output, including nonzero status for rejected history.
 */
const inspectBuildNumber = (pages: unknown, runNumber: number, version: string) => {
  const script = join(process.cwd(), 'scripts/resolve-release-build.mjs');
  const code = `import { countReleaseBuild } from ${JSON.stringify(script)}; const data = JSON.parse(process.argv[1]); const versions = {a: '1.0.0', b: '1.1.0'}; const build = countReleaseBuild(data.pages, data.runNumber, data.version, sha => versions[sha[0]]); process.stdout.write(String(build));`;
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', code, JSON.stringify({ pages, runNumber, version })],
    { encoding: 'utf8' },
  );
};

const pages = [
  { workflow_runs: [releaseRun(4, 'b'), releaseRun(3, 'b')] },
  { workflow_runs: [releaseRun(2, 'a'), releaseRun(1, 'a')] },
];

it('starts each version at one and increments only its own workflow runs across pages', () => {
  const cases: [number, string, string][] = [
    [1, '1.0.0', '1'],
    [2, '1.0.0', '2'],
    [3, '1.1.0', '1'],
    [4, '1.1.0', '2'],
    [5, '1.0.0', '3'],
  ];
  for (const [runNumber, version, expected] of cases) {
    const result = inspectBuildNumber(pages, runNumber, version);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(expected);
  }
});

it('retries ignore later runs and duplicate pages without depending on success status', () => {
  const result = inspectBuildNumber(
    [
      ...pages,
      { workflow_runs: [{ ...releaseRun(3, 'b'), conclusion: 'failure', run_attempt: 2 }] },
    ],
    4,
    '1.1.0',
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toBe('2');
});

it('ignores PR runs and pushes to other branches', () => {
  const result = inspectBuildNumber(
    [
      {
        workflow_runs: [
          { ...releaseRun(1, 'a'), event: 'pull_request' },
          { ...releaseRun(2, 'a'), head_branch: 'dev' },
        ],
      },
    ],
    3,
    '1.0.0',
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toBe('1');
});

it.each([
  null,
  [{}],
  [{ workflow_runs: [releaseRun(0, 'a')] }],
  [{ workflow_runs: [releaseRun(1, 'z')] }],
  [{ workflow_runs: [releaseRun(1, 'c')] }],
])('rejects missing or invalid historical metadata: %p', (history) => {
  expect(inspectBuildNumber(history, 5, '1.0.0').status).not.toBe(0);
});
