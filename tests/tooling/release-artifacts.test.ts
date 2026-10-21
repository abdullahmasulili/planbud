import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

it('ART-003 accepts portable release bytes and rejects workstation paths or bundled test fixtures', () => {
  const script = join(process.cwd(), 'scripts/scan-release.mjs');
  const code = `import { scanReleaseBytes } from ${JSON.stringify(script)}; const value = JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(scanReleaseBytes(Buffer.from(value))));`;
  for (const [input, passes] of [
    ['portable bundled font metadata', true],
    [['/data/local/', 'tmp', '/exopackage/'].join(''), true],
    [['file:', '// is a runtime URI scheme'].join(''), true],
    [['file:', '///', 'Users', '/example/build/app'].join(''), false],
    [['/', 'Users', '/example/build/app'].join(''), false],
    [['C:', '\\', 'work', '\\', 'project', '\\', 'source.cpp'].join(''), false],
    [['binary prefix ', 'S:', '\\', '\u0000', 'binary suffix'].join(''), true],
    ['Public deterministic interoperability fixture', false],
  ]) {
    if (typeof input !== 'string') throw new Error('Invalid artifact fixture');
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', code, JSON.stringify(input)],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    const report: unknown = JSON.parse(result.stdout);
    expect(Array.isArray(report) && (report.length === 0) === passes).toBe(true);
  }
});
