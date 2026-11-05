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

## GitHub Actions release builds

The dedicated release target is `gitops/release-build`. Every push to that branch triggers [Android release APK](../../.github/workflows/android-release.yml); pushes to other branches and pull requests do not trigger signing. Submit workflow and app changes from a separate working branch through a PR targeting `dev`. After review and merge, promote approved `dev` changes to `gitops/release-build` and push that branch to generate a build. The release branch is reserved for build promotion and is not a PR source branch. A newer push cancels an unfinished older build.

Before the first push, configure these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret                      | Value                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `PLAN_BUD_KEYSTORE_BASE64`  | Base64 encoding of the existing `.private/android-signing/personal.p12` file, as one line. |
| `PLAN_BUD_SIGNING_PASSWORD` | Contents of the matching `.private/android-signing/password` file.                         |

Use the existing signing pair from the previous personal APK build, with alias `planbud-personal`. Keep a secure backup of both files. The workflow fails when a secret is missing rather than creating a new signing identity; a different identity cannot update an existing installation. If no identity exists yet, create it once with the documented local build before configuring the secrets. Never commit the signing files or their encoded contents. Only reviewed code should reach this branch because its build can access the signing identity.

The runner installs the repository's Node/pnpm versions, Java 17 and Android SDK tools, then runs `pnpm check`, `pnpm android:preview` and the release artifact scan. This uses CNG and Gradle directly and requires no Expo account, token or EAS subscription. The script builds the signed `assembleRelease` variant with its bundled JavaScript, independent of Metro.

Release identifiers use `<app version>+<build number>`, for example `1.0.0+42`. `expo.version` in `app.json` owns the app version and generated Android `versionName`. The workflow reads its paginated run history and the app version at each earlier release commit to count runs for the current version. Changing to `1.1.0` starts at `1.1.0+1`; another run of that version becomes `1.1.0+2`. Failed and cancelled runs consume numbers, retries retain the original number and replace the artifact, and returning to an older version continues that version's existing sequence. The build script uses the resolved `extra.releaseBuildNumber` to name the APK, artifact and checksum entry.

Android's internal `versionCode` remains the global `github.run_number`, passed as `PLAN_BUD_VERSION_CODE`, so updates continue to increase even when the visible build number resets. Keep this workflow's counter continuous and retain its run records and release git history: deleting earlier run records can reuse visible build numbers, and missing historical commits stop numbering rather than silently resetting it. Artifact/log expiration does not require deleting workflow run records. The global Android code and commit SHA remain in the run summary for tracing builds.

After a successful run, open **Actions → Android release APK → run → Artifacts** and download `plan-bud-v<app version>-build<build number>`, or follow the run summary's download link. For release `1.0.0+42`, the archive is named `plan-bud-v1.0.0-build42` and contains only `plan-bud-v1.0.0-build42.apk` and `SHA256SUMS.txt`. Extract both and run `sha256sum -c SHA256SUMS.txt` on Linux, or `shasum -a 256 -c SHA256SUMS.txt` on macOS, from the extracted folder to verify the APK. Signed-in users with repository read access can download it for 14 days; afterward, generate another build or retain a downloaded copy.

This produces a downloadable build, not a GitHub Release or a completed device qualification. Follow the native acceptance steps below before treating a new APK as qualified. GitHub Actions compute and artifact-storage allowances still apply; use the repository owner's billing limits to prevent paid overages.

References: [workflow artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts), [artifact upload and retention](https://github.com/actions/upload-artifact/tree/v4), [local Expo release builds](https://docs.expo.dev/guides/local-app-production/), and [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## Reproduce

Use the Node/pnpm versions in the repository. Run `pnpm check` and `pnpm exec expo install --check`. Expo Doctor can run with `pnpm dlx expo-doctor`; EAS CLI remains outside project dependencies.

Build with `pnpm android:preview`, then scan the generated versioned APK with `pnpm scan:release dist/android/plan-bud-v1.0.0-build1.apk` for the current local defaults. Local builds default to visible build 1 and version code 1; set `PLAN_BUD_BUILD_NUMBER` to choose the visible number and `PLAN_BUD_VERSION_CODE` higher than the installed Android code when updating an installation. Without an explicit version code, a local build uses its visible build number. Preserve the ignored private signing identity for updates. Deliver the APK and checksum only, never private signing files, debug maps, generated native reports or temporary logs.

On a disposable emulator, install the APK and stop Metro. Set `PLAN_BUD_TEST_DEVICE` to a disposable emulator serial and run the composed suite with `MAESTRO_DRIVER_STARTUP_TIMEOUT=120000 maestro --device "$PLAN_BUD_TEST_DEVICE" test .maestro/release.yaml`. The suite calls its seven workflows explicitly so their dependency order does not rely on discovery behavior in an installed CLI version. Development flows under `.maestro/development/` refer to removed diagnostics and must be excluded. `node scripts/create-maestro-fixtures.mjs` generates only synthetic encrypted files using published test entropy; never use that entropy for personal backups. Copy both generated fixtures into the disposable emulator's Download folder, and create a PlanBudBackups folder there before running the suite. Test imports with the matching published BIP-39 zero-entropy vector. Do not generate or capture a real recovery phrase during automation.

File selection/export destinations belong to Android's chosen document provider. Test the actual provider, retain exported ciphertext for the clean-install step, and remove only synthetic verification files afterward. Never clear a personal installation for testing.
