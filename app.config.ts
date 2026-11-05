import type { ConfigContext } from 'expo/config';

/** Reads a positive decimal build identifier within Android's version-code limit.
 * @param input Explicit environment value or configured default.
 * @returns Validated numeric identifier.
 * @throws When the value is malformed or outside the supported integer range.
 */
const readBuildNumber = (input: string): number => {
  const number = Number(input);
  if (!/^[1-9]\d*$/.test(input) || !Number.isInteger(number) || number > 2_100_000_000)
    throw new Error('Release build number must be an integer between 1 and 2100000000.');
  return number;
};

/** Applies separate visible build and monotonic Android identifiers without changing static settings.
 * @param context Static app config and Expo project context.
 * @param context.config Static settings preserved alongside the release versionCode.
 * @returns Config with a per-version releaseBuildNumber and an independent Android versionCode.
 * @throws When an explicit build number is not a positive decimal integer within Android's limit.
 */
const configureApp = ({ config }: ConfigContext): ConfigContext['config'] => {
  const input = process.env.PLAN_BUD_BUILD_NUMBER ?? String(config.android?.versionCode ?? 1);
  const releaseBuildNumber = readBuildNumber(input);
  const versionCode = readBuildNumber(process.env.PLAN_BUD_VERSION_CODE ?? input);
  return {
    ...config,
    android: { ...config.android, versionCode },
    extra: { ...config.extra, releaseBuildNumber },
  };
};

export default configureApp;
