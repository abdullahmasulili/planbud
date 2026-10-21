# Personal Android release

Read `docs/engineering/verification.md` for executed evidence. This checklist is a release gate, not a claim that an unchecked item passed.

- [x] Product and engineering contracts approved before implementation.
- [x] Domain, application and native adapter ownership enforced.
- [x] Whole-change review completed and Important findings corrected with regressions.
- [x] Source check: 143 tests, zero-warning lint, types, boundaries and release-entry policy passed.
- [x] Native font/database/recovery/cryptography/atomic-restore contracts: 18 passed on API 24 and Samsung API 34.
- [x] Frozen dependency installation and Expo compatibility passed.
- [x] Expo Doctor: 20/20 after removing temporary local EAS CLI.
- [x] Initial personal signed standalone APK compiled for all four configured ABIs.
- [x] Corrected APK compiled with native compiler path remapping and minimal permissions.
- [x] Signature and packaged manifest verified; no internet permission, automatic backup or debug flag.
- [x] Every decompressed APK member passes the portability/test-material scan.
- [x] Standalone fresh setup, categories, monthly plans and actual transactions survive restart offline.
- [x] Goals, contribution correction and selected shortfall adjustment preserve actual/planned separation.
- [x] Light/dark/system persistence, keyboard, 200% text and back navigation checked.
- [x] Native file-provider cancellation, encrypted export and authenticated replacement checked.
- [x] Wrong phrase and corrupt backup preserve existing data.
- [x] Export restores after uninstall/reinstall with no original protected key, account or network.
- [x] Sensitive view prevents capture; backgrounding disposes input and normal navigation releases protection.
- [x] API 24 startup/native contracts and dual-device bounded 50,000-record/storage-full stress recorded.
- [x] API 24 Settings navigation, local-provider restore/export, maximum-record pagination/restart and oversized/excessive-record rejection passed.
- [ ] Physical Samsung TalkBack gesture and complete speech/focus qualification recorded.

## Reproduce

Use the Node/pnpm versions in the repository. Run `pnpm check` and `pnpm exec expo install --check`. Expo Doctor can run with `pnpm dlx expo-doctor`; EAS CLI remains outside project dependencies.

Build with `pnpm android:preview`, then scan `dist/android/plan-bud-preview.apk` with `pnpm scan:release dist/android/plan-bud-preview.apk`. Preserve the ignored private signing identity for updates. Deliver the APK and checksum only, never private signing files, debug maps, generated native reports or temporary logs.

On a disposable emulator, install the APK and stop Metro. Set `PLAN_BUD_TEST_DEVICE` to a disposable emulator serial and run the composed suite with `MAESTRO_DRIVER_STARTUP_TIMEOUT=120000 maestro --device "$PLAN_BUD_TEST_DEVICE" test .maestro/release.yaml`. The suite calls its seven workflows explicitly so their dependency order does not rely on discovery behavior in an installed CLI version. Development flows under `.maestro/development/` refer to removed diagnostics and must be excluded. `node scripts/create-maestro-fixtures.mjs` generates only synthetic encrypted files using published test entropy; never use that entropy for personal backups. Copy both generated fixtures into the disposable emulator's Download folder, and create a PlanBudBackups folder there before running the suite. Test imports with the matching published BIP-39 zero-entropy vector. Do not generate or capture a real recovery phrase during automation.

File selection/export destinations belong to Android's chosen document provider. Test the actual provider, retain exported ciphertext for the clean-install step, and remove only synthetic verification files afterward. Never clear a personal installation for testing.
