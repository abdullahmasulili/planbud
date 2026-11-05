import type { ConfigContext } from 'expo/config';
import configureApp from '../../app.config';

const originalBuildNumber = process.env.PLAN_BUD_BUILD_NUMBER;
const originalVersionCode = process.env.PLAN_BUD_VERSION_CODE;
const context: ConfigContext = {
  projectRoot: '.',
  staticConfigPath: 'app.json',
  packageJsonPath: 'package.json',
  config: {
    name: 'Plan Bud',
    slug: 'plan-bud',
    version: '1.0.0',
    android: { package: 'com.planbud.app', allowBackup: false },
    updates: { enabled: false, checkAutomatically: 'NEVER' },
  },
};

beforeEach(() => {
  delete process.env.PLAN_BUD_BUILD_NUMBER;
  delete process.env.PLAN_BUD_VERSION_CODE;
});

afterEach(() => {
  if (originalBuildNumber === undefined) delete process.env.PLAN_BUD_BUILD_NUMBER;
  else process.env.PLAN_BUD_BUILD_NUMBER = originalBuildNumber;
  if (originalVersionCode === undefined) delete process.env.PLAN_BUD_VERSION_CODE;
  else process.env.PLAN_BUD_VERSION_CODE = originalVersionCode;
});

it('uses the release number as versionCode while preserving the app version and offline config', () => {
  process.env.PLAN_BUD_BUILD_NUMBER = '42';
  expect(configureApp(context)).toEqual({
    ...context.config,
    android: { ...context.config.android, versionCode: 42 },
    extra: { releaseBuildNumber: 42 },
  });
  expect(context.config.android?.versionCode).toBeUndefined();
});

it('resets the visible build while keeping Android versionCode increasing and preserving extra config', () => {
  process.env.PLAN_BUD_BUILD_NUMBER = '1';
  process.env.PLAN_BUD_VERSION_CODE = '44';
  const config = configureApp({
    ...context,
    config: { ...context.config, version: '1.1.0', extra: { marker: 'preserved' } },
  });
  expect(config.version).toBe('1.1.0');
  expect(config.android?.versionCode).toBe(44);
  expect(config.extra).toEqual({ marker: 'preserved', releaseBuildNumber: 1 });
});

it('rejects an invalid independent Android versionCode', () => {
  process.env.PLAN_BUD_BUILD_NUMBER = '1';
  process.env.PLAN_BUD_VERSION_CODE = '0';
  expect(() => configureApp(context)).toThrow('Release build number must be an integer');
});

it('retains the local versionCode or defaults to one when no release number is supplied', () => {
  delete process.env.PLAN_BUD_BUILD_NUMBER;
  expect(configureApp(context).android?.versionCode).toBe(1);
  expect(
    configureApp({
      ...context,
      config: { ...context.config, android: { ...context.config.android, versionCode: 7 } },
    }).android?.versionCode,
  ).toBe(7);
});

it.each(['', '0', '-1', '1.5', '1e3', ' 42', '042', 'abc', '2100000001'])(
  'rejects invalid release build number %p before native generation',
  (input) => {
    process.env.PLAN_BUD_BUILD_NUMBER = input;
    expect(() => configureApp(context)).toThrow('Release build number must be an integer');
  },
);

it('accepts Android’s maximum supported versionCode', () => {
  process.env.PLAN_BUD_BUILD_NUMBER = '2100000000';
  expect(configureApp(context).android?.versionCode).toBe(2_100_000_000);
});
