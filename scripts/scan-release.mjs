import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workstation = new RegExp(
  [
    '(?<![A-Za-z0-9_.-])/(',
    'Users',
    '|home|private|tmp|var/folders)/[^\\s"<>]+',
    '|[A-Za-z]:\\\\[A-Za-z0-9_. -]{2,}\\\\[A-Za-z0-9_. -]{2,}',
  ].join(''),
);
const testMaterial =
  /Public deterministic interoperability fixture|Public NIST CAVS|abandon(?: abandon){10} about/;

/** Scans packaged text/binary strings without printing sensitive matched contents.
 * @param bytes Delivered bundle, asset, metadata or native-library bytes.
 * @returns Nonsecret issue categories, including UTF-8 and UTF-16 workstation references.
 */
export const scanReleaseBytes = (bytes) => {
  const buffer = Buffer.from(bytes);
  const texts = [buffer.toString('utf8'), buffer.toString('utf16le')];
  const issues = [];
  if (texts.some((text) => workstation.test(text))) issues.push('workstation-reference');
  if (texts.some((text) => testMaterial.test(text))) issues.push('bundled-test-material');
  return issues;
};

/** Scans every decompressed APK member, or a standalone delivered artifact, under a bounded tool buffer.
 * @param filename Locally resolved delivery artifact; never written into a report.
 * @returns Portable member diagnostics; source maps and private signing files are forbidden.
 */
export const scanRelease = (filename) => {
  if (!filename.endsWith('.apk')) return scanReleaseBytes(readFileSync(filename));
  const entries = execFileSync('unzip', ['-Z1', filename], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
    .trim()
    .split('\n')
    .filter((entry) => entry && !entry.endsWith('/'));
  return entries.flatMap((entry) => {
    if (/\.(?:map|jks|keystore|key|p12)$/.test(entry))
      return [`${entry}: private build/signing artifact`];
    const bytes = execFileSync('unzip', ['-p', filename, entry], { maxBuffer: 256 * 1024 * 1024 });
    return scanReleaseBytes(bytes).map((issue) => `${entry}: ${issue}`);
  });
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    process.stderr.write('Supply a release APK or artifact.\n');
    process.exitCode = 1;
  } else {
    const issues = scanRelease(resolve(target));
    issues.forEach((issue) => process.stderr.write(issue + '\n'));
    process.exitCode = issues.length ? 1 : 0;
    if (!issues.length) process.stdout.write('Release artifact scan passed.\n');
  }
}
