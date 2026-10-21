const {
  withAndroidManifest,
  withDangerousMod,
  withAppBuildGradle,
} = require('expo/config-plugins');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const domains = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];
const exclusions = domains
  .map((domain) => `    <exclude domain="${domain}" path="." />`)
  .join('\n');
const legacyRules = `<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n${exclusions}\n</full-backup-content>\n`;
const extractionRules = `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup disableIfNoEncryptionCapabilities="true">\n${exclusions}\n  </cloud-backup>\n  <device-transfer>\n${exclusions}\n  </device-transfer>\n</data-extraction-rules>\n`;
const releaseManifest = `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">\n  <uses-permission android:name="android.permission.INTERNET" tools:node="remove" />\n  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" tools:node="remove" />\n  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove" />\n  <application android:usesCleartextTraffic="false" tools:replace="android:usesCleartextTraffic" />\n</manifest>\n`;
// Expo derives this public error code from its class name; R8 must preserve cancellation semantics.
const pickerRules = '-keep class expo.modules.filesystem.PickerCancelledException { *; }\n';

/** Configures private signing, API 24 compatibility, offline boundaries and native cancellation.
 * @param config Expo SDK-compatible CNG configuration.
 * @returns Config with reproducible native resources; debug tooling retains local Metro connectivity.
 */
const withOfflineAndroid = (config) => {
  const manifest = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) throw new Error('Android application manifest missing.');
    app.$['android:allowBackup'] = 'false';
    app.$['android:fullBackupContent'] = '@xml/planbud_backup_rules';
    app.$['android:dataExtractionRules'] = '@xml/planbud_data_extraction_rules';
    const activity = app.activity?.find((item) =>
      item.$['android:name']?.endsWith('.MainActivity'),
    );
    if (!activity) throw new Error('Android main activity missing.');
    activity.$['android:hardwareAccelerated'] = '@bool/planbud_hardware_accelerated';
    return mod;
  });
  const signed = withAppBuildGradle(manifest, (mod) => {
    const marker = '\n// PLANBUD_SIGNING_START\n';
    const block = `\ndef planbudKeystore = System.getenv("PLAN_BUD_KEYSTORE")\nif (planbudKeystore) {\n  android.signingConfigs.create("planbudPersonal") {\n    storeFile file(planbudKeystore)\n    storePassword System.getenv("PLAN_BUD_SIGNING_PASSWORD")\n    keyAlias "planbud-personal"\n    keyPassword System.getenv("PLAN_BUD_SIGNING_PASSWORD")\n  }\n  android.buildTypes.release.signingConfig = android.signingConfigs.planbudPersonal\n} else if (System.getenv("EAS_BUILD") != "true" && gradle.startParameter.taskNames.any { it.toLowerCase().contains("release") }) {\n  throw new GradleException("Use the private local signing environment or configured EAS credentials for release builds.")\n}\n`;
    mod.modResults.contents =
      mod.modResults.contents.replace(
        /\n\/\/ PLANBUD_SIGNING_START[\s\S]*?\/\/ PLANBUD_SIGNING_END\n?/g,
        '',
      ) +
      marker +
      block +
      '// PLANBUD_SIGNING_END\n';
    const portableMarker = '\n// PLANBUD_PORTABLE_START\n';
    mod.modResults.contents =
      mod.modResults.contents.replace(
        /\n\/\/ PLANBUD_PORTABLE_START[\s\S]*?\/\/ PLANBUD_PORTABLE_END\n?/g,
        '',
      ) +
      portableMarker +
      `def planbudPrefixFlag = "-ffile-prefix-map=" + System.getProperty("user.home") + "=."\nandroid.defaultConfig.externalNativeBuild.cmake {\n  cppFlags planbudPrefixFlag\n  cFlags planbudPrefixFlag\n}\n// PLANBUD_PORTABLE_END\n`;
    mod.modResults.contents =
      mod.modResults.contents.replace(
        /\n\/\/ PLANBUD_PICKER_START[\s\S]*?\/\/ PLANBUD_PICKER_END\n?/g,
        '',
      ) +
      '\n// PLANBUD_PICKER_START\nandroid.buildTypes.release {\n  proguardFile "planbud-proguard-rules.pro"\n}\n// PLANBUD_PICKER_END\n';
    // Expo Modules v2 registers Path converters at startup, including on Android 7.
    mod.modResults.contents =
      mod.modResults.contents.replace(
        /\n\/\/ PLANBUD_DESUGAR_START[\s\S]*?\/\/ PLANBUD_DESUGAR_END\n?/g,
        '',
      ) +
      '\n// PLANBUD_DESUGAR_START\nandroid.compileOptions.coreLibraryDesugaringEnabled = true\ndependencies {\n  coreLibraryDesugaring "com.android.tools:desugar_jdk_libs_nio:2.1.5"\n}\n// PLANBUD_DESUGAR_END\n';
    return mod;
  });
  return withDangerousMod(signed, [
    'android',
    async (mod) => {
      const project = mod.modRequest.platformProjectRoot;
      const xml = join(project, 'app/src/main/res/xml');
      const release = join(project, 'app/src/release');
      const values = join(project, 'app/src/main/res/values');
      const modernValues = join(project, 'app/src/main/res/values-v25');
      await mkdir(xml, { recursive: true });
      await mkdir(release, { recursive: true });
      await mkdir(values, { recursive: true });
      await mkdir(modernValues, { recursive: true });
      // Only Android 7.0 uses a software canvas; API 25+ keeps hardware rendering.
      for (const [folder, enabled] of [
        [values, false],
        [modernValues, true],
      ]) {
        await writeFile(
          join(folder, 'planbud_renderer.xml'),
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <bool name="planbud_hardware_accelerated">${enabled}</bool>\n</resources>\n`,
        );
      }
      await writeFile(join(xml, 'planbud_backup_rules.xml'), legacyRules);
      await writeFile(join(xml, 'planbud_data_extraction_rules.xml'), extractionRules);
      await writeFile(join(release, 'AndroidManifest.xml'), releaseManifest);
      await writeFile(join(project, 'app/planbud-proguard-rules.pro'), pickerRules);
      return mod;
    },
  ]);
};

module.exports = withOfflineAndroid;
