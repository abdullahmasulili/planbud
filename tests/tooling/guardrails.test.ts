import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Runs a policy module against a temporary project without exposing host paths.
 * @param kind Boundary or artifact checker to run.
 * @param files Portable fixture files created only for this assertion.
 * @returns Reported policy violations.
 */
const inspectFixture = (
  kind: 'boundaries' | 'artifacts' | 'release',
  files: Record<string, string>,
) => {
  const root = mkdtempSync(join(tmpdir(), 'plan-bud-policy-'));
  try {
    Object.entries(files).forEach(([path, content]) => {
      const target = join(root, path);
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, content);
    });
    const modulePath = join(process.cwd(), `scripts/check-${kind}.mjs`);
    const exportName =
      kind === 'boundaries'
        ? 'checkBoundaries'
        : kind === 'release'
          ? 'checkRelease'
          : 'checkArtifacts';
    const code = `import { ${exportName} } from ${JSON.stringify(modulePath)}; process.stdout.write(JSON.stringify(${exportName}(process.argv[1])));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code, root], {
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error('Policy subprocess failed');
    const report: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(report) || !report.every((item: unknown) => typeof item === 'string'))
      throw new Error('Invalid policy report');
    return report;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

describe('engineering guardrails', () => {
  it('OFF-003 rejects updates, automatic backup, extra targets and reachable test material', () => {
    const expo = {
      platforms: ['android'],
      android: { package: 'com.planbud.app', allowBackup: false },
      updates: { enabled: false, checkAutomatically: 'NEVER' },
      plugins: ['./plugins/with-offline-android.cjs'],
    };
    const files = {
      'app.json': JSON.stringify({ expo }),
      'src/app/_layout.tsx': 'export const Layout = () => null;',
    };
    expect(inspectFixture('release', files)).toEqual([]);
    for (const changed of [
      { ...expo, platforms: ['android', 'ios'] },
      { ...expo, updates: { enabled: true, checkAutomatically: 'ALWAYS' } },
      { ...expo, android: { package: 'com.planbud.app', allowBackup: true } },
    ])
      expect(
        inspectFixture('release', { ...files, 'app.json': JSON.stringify({ expo: changed }) })
          .length,
      ).toBeGreaterThan(0);
    expect(
      inspectFixture('release', {
        ...files,
        'src/app/_layout.tsx': "import '../composition/diagnostic';",
        'src/composition/diagnostic.ts': "import '../../tests/fixtures/vector.json';",
        'tests/fixtures/vector.json': '{}',
      }).length,
    ).toBeGreaterThan(0);
    expect(
      inspectFixture('release', {
        ...files,
        'src/app/_layout.tsx': "const bytes = fetch('https://example.invalid/remote-font');",
      }).length,
    ).toBeGreaterThan(0);
    const patched = {
      ...files,
      'patches/expo-crypto@58.0.7.patch': 'Synthetic dependency patch marker',
      'package.json': JSON.stringify({
        expo: { autolinking: { android: { buildFromSource: ['expo-crypto'] } } },
      }),
    };
    expect(inspectFixture('release', patched)).toEqual([]);
    expect(inspectFixture('release', { ...patched, 'package.json': '{}' })).toContain(
      'package.json: patched ExpoCrypto must build from source',
    );
    expect(
      inspectFixture('release', {
        ...files,
        'src/app/_layout.tsx':
          "import { Dialog as UnsafeDialog } from 'react-native-paper'; export const Root = () => <UnsafeDialog visible />;",
      }),
    ).toContain('src/app/_layout.tsx: use the native Material dialog boundary');
  });
  it('LAYER-008 treats tests as composition roots without permitting production imports', () => {
    expect(
      inspectFixture('boundaries', {
        'src/domains/settings/infrastructure/repository.test.ts':
          "import '../../../../tests/helpers/host';",
        'tests/helpers/host.ts': 'export const host = 1;',
      }),
    ).toEqual([]);
    expect(
      inspectFixture('boundaries', {
        'src/domains/settings/infrastructure/repository.ts': "import './repository.test';",
        'src/domains/settings/infrastructure/repository.test.ts': 'export const host = 1;',
      }).length,
    ).toBeGreaterThan(0);
  });
  it('LAYER-002 permits packaged pure domain reference data', () => {
    expect(
      inspectFixture('boundaries', {
        'src/shared/domain/currency.ts':
          "import table from './currencies.json'; export const data = table;",
        'src/shared/domain/currencies.json': '{"USD":2}',
      }),
    ).toEqual([]);
  });
  it('LAYER-002 rejects relative infrastructure imports from domain code', () => {
    expect(
      inspectFixture('boundaries', {
        'src/domains/goals/domain/goal.ts': "import '../infrastructure/repository';",
        'src/domains/goals/infrastructure/repository.ts': 'export const storage = 1;',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('LAYER-006 rejects cross-domain internal access and cycles through re-exports', () => {
    expect(
      inspectFixture('boundaries', {
        'src/domains/goals/application/goal.ts':
          "export * from '../../budgeting/infrastructure/repository';",
        'src/domains/budgeting/infrastructure/repository.ts':
          "import '../../goals/application/goal';",
      }).length,
    ).toBeGreaterThan(0);
  });

  it('LAYER-002 rejects alias and transitive escapes from pure domain code', () => {
    expect(
      inspectFixture('boundaries', {
        'src/domains/goals/domain/goal.ts': "import '@/shared/domain/escape';",
        'src/shared/domain/escape.ts': "export * from '../infrastructure/database';",
        'src/shared/infrastructure/database.ts': 'export const db = 1;',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('LAYER-004 permits application-owned ports and their infrastructure adapters', () => {
    expect(
      inspectFixture('boundaries', {
        'src/domains/goals/application/public.ts':
          'export type GoalPort = { read: () => Promise<string> };',
        'src/domains/goals/infrastructure/repository.ts':
          "import type { GoalPort } from '../application/public';",
      }),
    ).toEqual([]);
  });

  it('ART-001 detects nonportable references without committing a workstation fixture', () => {
    const localReference = ['/', 'Users', '/', 'example', '/', 'work'].join('');
    expect(
      inspectFixture('artifacts', { 'docs/result.md': localReference }).length,
    ).toBeGreaterThan(0);
  });

  it('ART-001 accepts relative paths and public URLs', () => {
    expect(
      inspectFixture('artifacts', {
        'docs/result.md': 'src/domains/goals/domain/goal.ts https://docs.expo.dev/',
      }),
    ).toEqual([]);
  });
});
