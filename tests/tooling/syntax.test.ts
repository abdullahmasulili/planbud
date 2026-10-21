import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const forbiddenForms = [
  'export function task() { return 1; }',
  'export const task = function named() { return 1; };',
  'export const task = function() { return 1; };',
  'export const service = { read() { return 1; } };',
  'export default () => null;',
  'export class Screen extends React.Component { render() { return null; } }',
  "import { Component } from 'react'; export class Screen extends Component { render = () => null; }",
  'export const Service = class { read = () => 1; };',
];
const undocumented = 'export const task = () => 1;';
const promiseChain =
  '/** Resolves a calculation. */\nexport const task = () => Promise.resolve(1).then((value) => value);';
const floatingPromise = 'Promise.reject(new Error("failure")); export {};';
const validComponent =
  '/** Renders the screen. @returns Screen content. */\nconst Screen = () => null; export default Screen;';
const validAwait =
  '/** Reads a value. @returns The resolved calculation. */\nexport const read = async () => { return await Promise.resolve(1); };';

/** Inspects every policy fixture in one real typed ESLint process.
 * @param sources Intentionally valid and invalid authored syntax samples.
 * @returns Rule identifiers keyed by source, without retaining diagnostic filenames.
 */
const inspectSyntaxBatch = (
  sources: readonly string[],
): ReadonlyMap<string, readonly (string | null)[]> => {
  const folder = join(process.cwd(), 'tests', 'policy-fixtures', randomUUID());
  mkdirSync(folder, { recursive: true });
  const files = sources.map((source, index) => {
    const filename = join(folder, `fixture-${index}.tsx`);
    writeFileSync(filename, source);
    return filename;
  });
  try {
    const result = spawnSync(
      process.execPath,
      ['node_modules/eslint/bin/eslint.js', ...files, '--format=json'],
      { encoding: 'utf8', timeout: 120000 },
    );
    if (!result.stdout || result.error)
      throw new Error('ESLint fixtures did not produce a report.');
    const report: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(report)) throw new Error('Invalid lint report.');
    const reports = new Map<string, readonly (string | null)[]>();
    const rows: readonly unknown[] = report;
    for (const file of rows) {
      if (
        typeof file !== 'object' ||
        file === null ||
        !('filePath' in file) ||
        typeof file.filePath !== 'string' ||
        !('messages' in file) ||
        !Array.isArray(file.messages)
      )
        throw new Error('Invalid lint file report.');
      const source = sources[files.indexOf(file.filePath)];
      if (source === undefined) throw new Error('Unexpected lint fixture.');
      const messages: (string | null)[] = [];
      const entries: readonly unknown[] = file.messages;
      for (const message of entries) {
        if (
          typeof message !== 'object' ||
          message === null ||
          !('ruleId' in message) ||
          (message.ruleId !== null && typeof message.ruleId !== 'string')
        )
          throw new Error('Invalid lint message.');
        if ('fatal' in message && message.fatal) throw new Error('Fixture parser failed.');
        messages.push(message.ruleId);
      }
      reports.set(source, messages);
    }
    if (reports.size !== sources.length) throw new Error('Incomplete lint fixture report.');
    return reports;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
};

let reports: ReadonlyMap<string, readonly (string | null)[]> = new Map();
beforeAll(() => {
  reports = inspectSyntaxBatch([
    ...forbiddenForms,
    undocumented,
    promiseChain,
    floatingPromise,
    validComponent,
    validAwait,
  ]);
});

/** Retrieves independently asserted rules from the shared real-config lint run.
 * @param source Fixture whose behavior is being checked.
 * @returns Rule identifiers for that fixture; missing reports fail the suite.
 */
const inspectSyntax = (source: string) => {
  const messages = reports.get(source);
  if (!messages) throw new Error('Missing policy fixture evidence.');
  return messages;
};

describe('syntax contracts', () => {
  it.each(forbiddenForms)('FUNC-002 rejects a forbidden authored function form: %s', (source) => {
    expect(inspectSyntax(source)).toContain('project/arrow-functions');
  });
  it('DOC-001 rejects an undocumented module-level callable', () => {
    expect(inspectSyntax(undocumented)).toContain('project/document-contracts');
  });
  it('ASYNC-001 rejects promise chains in ordinary workflows', () => {
    expect(inspectSyntax(promiseChain)).toContain('project/async-workflows');
  });
  it('ASYNC-003 rejects unobserved rejected promises', () => {
    expect(inspectSyntax(floatingPromise)).toContain('@typescript-eslint/no-floating-promises');
  });
  it('FUNC-003 accepts a documented arrow component with a separate export', () => {
    expect(inspectSyntax(validComponent)).toEqual([]);
  });
  it('ASYNC-001 accepts documented async/await without promise chains', () => {
    expect(inspectSyntax(validAwait)).toEqual([]);
  });
});
