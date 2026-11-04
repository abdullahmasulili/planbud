import { spawnSync } from 'node:child_process';

describe('Android brand resources', () => {
  it('UI-011 preserves night colors and OFF-003 disables automatic messaging registration', () => {
    const code = `
      const assert = require('node:assert/strict');
      const withBrandIcons = require('./plugins/with-brand-icons.cjs');
      const withOfflineAndroid = require('./plugins/with-offline-android.cjs');
      (async () => {
        const brand = withBrandIcons({ name: 'fixture', slug: 'fixture' });
        const night = {
          modResults: { resources: { color: [
            { $: { name: 'unrelated' }, _: '#112233' },
            { $: { name: 'iconBackground' }, _: '#FFFFFF' },
          ] } },
          modRequest: { platform: 'android', modName: 'colorsNight' },
        };
        await brand.mods.android.colorsNight(night);
        await brand.mods.android.colorsNight(night);
        assert.deepEqual(night.modResults.resources.color, [
          { $: { name: 'unrelated' }, _: '#112233' },
          { $: { name: 'iconBackground' }, _: '#005EAD' },
        ]);
        const offline = withOfflineAndroid({ name: 'fixture', slug: 'fixture' });
        const application = { $: {}, activity: [{ $: { 'android:name': '.MainActivity' } }] };
        const manifest = {
          modResults: { manifest: { application: [application] } },
          modRequest: { platform: 'android', modName: 'manifest' },
        };
        await offline.mods.android.manifest(manifest);
        await offline.mods.android.manifest(manifest);
        for (const name of [
          'firebase_messaging_auto_init_enabled',
          'firebase_analytics_collection_enabled',
        ]) {
          const entries = application['meta-data'].filter(item => item.$['android:name'] === name);
          assert.equal(entries.length, 1);
          assert.equal(entries[0].$['android:value'], 'false');
        }
      })().catch(() => { process.exitCode = 1; });
    `;
    const result = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });
});
