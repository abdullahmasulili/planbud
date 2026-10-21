import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ignored = new Set([
  'node_modules',
  '.git',
  '.superpowers',
  '.private',
  '.expo',
  'android',
  'ios',
  'coverage',
  'assets',
]);
const localPattern = new RegExp(
  [
    '/(?:',
    'Users',
    '|home|private|tmp|var/folders)/[^\\s"\'<>]+',
    '|file:',
    '//',
    '|[A-Za-z]:\\\\',
  ].join(''),
);

/** Lists authored text and generated delivery metadata while excluding private build caches.
 * @param folder Directory whose text artifacts should be inspected.
 * @returns Candidate filenames without dependency or private-cache contents.
 */
const collectArtifacts = (folder) =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const target = resolve(folder, entry.name);
    if (ignored.has(entry.name) || entry.name === 'pnpm-lock.yaml') return [];
    return entry.isDirectory()
      ? collectArtifacts(target)
      : /\.(?:[cm]?[jt]sx?|json|ya?ml|md|txt|map)$/.test(entry.name)
        ? [target]
        : [];
  });

/** Returns machine-specific references without including their sensitive contents.
 * @param root Repository or fixture root to inspect.
 * @returns Repository-relative locations of nonportable artifact content.
 */
export const checkArtifacts = (root = process.cwd()) =>
  collectArtifacts(root).flatMap((filename) =>
    readFileSync(filename, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        localPattern.test(line)
          ? [
              `${relative(root, filename).replaceAll('\\', '/')}:${index + 1}: nonportable reference`,
            ]
          : [],
      ),
  );

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = checkArtifacts();
  issues.forEach((issue) => process.stderr.write(`${issue}\n`));
  process.exitCode = issues.length ? 1 : 0;
}
