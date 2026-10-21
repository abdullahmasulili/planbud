# Android device qualification

Execution date: 2026-10-21. This records the additional testing requested after the API 36 candidate. Synthetic fixtures use published BIP-39 test entropy; they must never become a personal profile or backup key.

## Environments and isolation

- Samsung SM-A528B: Android 14, API 34. No Plan Bud installation existed for the primary user before testing. The signed candidate and synthetic files were installed for this run. The monthly setup/category/budget/transaction flow passed. Subsequent automation lost its driver while another application's instrumentation was using the phone. The user subsequently reserved the phone. The updated test-only build passed all 18 native contracts and all five isolated native stress cases. Existing product data is preserved; the clear-state automation was declined by automatic approval review, so subsequent phone checks use non-clearing operations.
- API 24: isolated ARM64 Google APIs emulator, Android 7.0. Initial release installation succeeded but startup failed before setup. No other emulator or personal dataset is used.
- Host SQLite: real SQLite engine through Node, with an isolated in-memory database per case. These checks do not substitute for Android execution.

## API 24 startup regression

The native log identifies `java.nio.file.Path` resolution in Expo Modules v2's converter registry as the first failure. That prevents ExpoCrypto registration and then causes route loading to fail. The Android config plugin now enables core library desugaring with the NIO variant, pinned to `com.android.tools:desugar_jdk_libs_nio:2.1.5`. This keeps the declared API 24 minimum and supplies the missing standard library API through the build toolchain. Generated native files are not edited by hand.

The corrected signed APK reached currency setup on API 24. Native font, migration, foreign-key, rollback/revision, concurrent-write, schema-rollback, reopen, protected-secret, mnemonic-vector and CSPRNG checks also passed. References: [Android NIO desugaring](https://developer.android.com/studio/write/java11-nio-support-table), [Gradle configuration](https://developer.android.com/studio/write/java8-support), [library release history](https://github.com/google/desugar_jdk_libs/blob/master/CHANGELOG.md).

## API 24 authenticated-decryption regression

The first native run then failed NIST/container/restore checks. A refined public-vector diagnostic confirmed that ciphertext and tag matched NIST, but decryption returned 32 bytes for the published 16-byte plaintext. Android's `Cipher.getOutputSize` is a capacity estimate; Expo returned the entire backing array instead of the bytes written by successful `doFinal`.

The pinned one-line patch and source-build configuration are documented in [dependency patches](../../patches/README.md). A failing-then-passing release guard detects omission of the explicit ExpoCrypto source build. SDK compatibility still reports dependencies up to date. All 18 native contracts passed on both API 24 and Samsung API 34, including NIST and independent-container vectors, exact plaintext lengths 0/1/15/16/17/31, damaged-tag rejection, protected-secret reopening and atomic restore. These checks use isolated test namespaces and published vectors.

## API 24 native-stack navigation

Opening Settings from the financial tabs produced a native `libhwui.so` RenderThread SIGSEGV. Restarting the emulator with `-gpu swiftshader_indirect` allowed a fresh Settings launch, but the transition crash later recurred on that renderer. The renderer change alone is not a fix, and the initial graphics-only hypothesis was rejected.

Disabling native stack animation also reproduced the crash, so that trial was removed. The CNG plugin now assigns MainActivity a version-qualified rendering Boolean: software Canvas on API 24 and hardware rendering from API 25 onward. This changes the activity's drawing pipeline rather than merely changing the emulator's GPU backend. The packaged resources and actual window flags confirmed software drawing on API 24 and hardware drawing on Samsung API 34. Three Settings push/pop cycles and process restart passed; the original RenderThread failure did not recur. Dark, light and system preferences also passed, including dark persistence after restart. The return-screen regression asserts the visible Open plan control because the Overview retains its scroll position. Provider and maximum-record UI acceptance are recorded separately. The minimum version remains 24. [Android hardware-acceleration controls](https://developer.android.com/develop/ui/views/graphics/hardware-accel) document the activity setting; software drawing on API 24 may cost more CPU.

The final crash-buffer read contained one earlier Binder-thread SIGSEGV at 16:41:56, PID 3803, address 0x140. Its process name was absent. Persisted tombstones identify only the three earlier Plan Bud RenderThread crashes; no tombstone identifies this Binder entry. Process ownership remains an attribution gap. The subsequent provider and maximum-record flows completed, and the original RenderThread failure did not recur in their recorded crash buffer. This evidence does not establish that the entire emulator session was free of native crashes.

## Bounded stress cases

`tests/stress/database-stress.test.ts` passed a complete 50,000-record source round trip, rejection of record 50,001 without revision/data changes, and a real SQLite full-database fault followed by a successful write. The fixture includes nested category limits, 48,996 transactions, 500 goals and 500 contributions. The first transaction exercises the 2,000-character note limit.

Storage exhaustion uses SQLite's `max_page_count` on the isolated test database and a bounded one-MiB insert. The assertion checks that the original failure is actually SQLite's full-storage error, that earlier work in the failed transaction rolled back, and that the connection accepts another write. It does not fill the personal phone's filesystem. Native stress contracts additionally exercise 20 queued writes after the failure and a relationship-heavy 50,000-record variant with 24,998 goals and matching contributions. All five native cases passed on both devices. The canonical snapshot comparison avoids treating object-property order as a source-data difference. API 24 replacement/read/history/dense-history diagnostics were 36,687/1,290/27/803 ms; Samsung diagnostics were 25,018/2,158/44/6,880 ms. These are individual observations under test load, not latency guarantees.

The relationship-heavy host run exposed repeated whole-list scans in the goal history reader. The time-budget regression failed at 331,890 ms; grouping validated histories once reduced the same projection to 928 ms. Seven focused host tests passed, including empty histories, date/ID ordering, orphan rejection, overflow, maximum-record preservation and full-storage rollback. These are diagnostic timings from this workstation, not device latency guarantees.

Generate optional large public-vector fixtures with:

```sh
node scripts/create-maestro-fixtures.mjs --stress
```

This creates ignored `stress-50000.planbud`, `stress-50001.planbud` and `stress-oversized.planbud` fixtures. The latter exceeds 16 MiB by one byte. Run `.maestro/manual/stress.yaml` only after copying the fixtures into Download on a disposable installation. On the signed API 24 candidate, this flow passed authenticated count review, replacement of all 50,000 records, spending 48,996, three additional transaction-page loads, process restart and goal savings/target/remaining amounts of 1,001/30,000/28,999. This also exercises the software-rendered list UI; it is not a general frame-rate guarantee.

The subsequent `.maestro/manual/stress-limits.yaml` also passed on API 24: the 16-MiB-plus-one-byte file was rejected at selection, and the authenticated 50,001-record file was rejected without truncation or replacement. Spending 48,996 and goal savings/target/remaining 1,001/30,000/28,999 remained intact after returning to the financial tabs.

## API 24 document provider

Wrong valid recovery words and damaged ciphertext were rejected while preserving USD settings, recorded spending 10 and the corrected contribution 30. Valid authenticated replacement restored JPY, dark appearance and goal savings 3,000, with recovery readiness verified. Export cancellation reported no saved file; a subsequent local-provider save reported success, followed by process restart.

Android 7's Downloads catalog did not list ADB-copied fixtures. The verified path is internal storage → Download. Enable Show internal storage separately in the file picker and directory picker; the directory picker uses SELECT. The fixture helper handles the emulator's internal-storage root, and export confirmation supports both SELECT and USE THIS FOLDER. Provider and stress runs used disabled emulator animations; the three native-stack regression cycles passed before animations were disabled. Samsung settings were not changed for these runs.

The software-rendered API 24 recovery input retained FLAG_SECURE in its actual activity window. The capture command returned no PNG, so this run does not claim a visually verified black screenshot on API 24; the separate API 36 black-capture evidence remains recorded in the implementation verification.

## TalkBack

Samsung TalkBack 14.5.00.14 was enabled with touch exploration and its developer speech-output display. Actual TalkBack window announcements and focus indicators were observed. A transparent first-run permission activity retained input focus; bringing the app task forward resolved that setup obstruction. No phone-call permission was granted.

Injected ADB taps, swipes and key combinations do not establish physical TalkBack gesture acceptance: they can operate the app while bypassing the screen reader's gesture handling. A physical swipe/double-tap check has been requested from the user. Dialog focus traversal, role/state speech, validation announcements and audible pronunciation remain pending until that check is observed or reported. The user deferred this physical check. The original service list, font scale 0.8, animation scales 1.0, connectivity state and disabled speech-output display were restored after the automated phase. [Android accessibility testing](https://developer.android.com/guide/topics/ui/accessibility/testing) and [TalkBack keyboard navigation](https://support.google.com/accessibility/android/answer/6110948) describe the corresponding manual checks.

## Dialog isolation and automation

The API 24 accessibility tree exposed background transaction filters alongside an open Paper dialog. Forms now use a shared React Native modal window while retaining Material dialog content. A native-window regression and busy/back test pass, and the release guard rejects direct Paper dialog roots outside that wrapper. The API 24 planner passed setup, categories, estimates, income/expense, nested category selection and restart persistence.

Automation ambiguities were corrected: Android Maestro's `hideKeyboard` sends Back even when no keyboard is visible, so the helper now requires a tested input-method window; the API 24 system Recents control is also called Overview, so the Overview test selector now requires the app control above system Recents after keyboard dismissal. A failed batch hit Recents after successfully correcting a contribution to 30; a later restart verified the retained contribution and spending before theme checks passed. The file picker can open in Recent, so fixture selection also handles its observed Show roots / Downloads navigation. Final provider acceptance is tracked separately.

## Limits of this evidence

Host fault tests do not qualify document-provider storage exhaustion, every OEM's accessibility behavior, or audible pronunciation. Test data must be cleared before personal use, and only test-owned external files may be removed. The composed release flow deliberately clears app data and never belongs on a personal installation.

No external ticket. No commits, pushes or pull requests created for this qualification.

## Samsung production layout and cleanup

The rebuilt production APK is installed on the Samsung and its installed SHA-256 matches `dist/android/SHA256SUMS.txt`. The non-clearing `.maestro/manual/samsung-layout.yaml` passed both dark and light at 200% font scale: active native dialog isolation, keyboard-visible amount/name fields, keyboard dismissal without closing the form, nested category-picker Back, scrollable goal editing, canceled drafts, appearance restoration and process restart. The financial profile was preserved. Both reviewers found no Critical or Important defect in the qualification code delta before the final API 24 rendering fallback; the stale pending evidence wording was corrected. The fallback received focused local review of generated resources, manifest, actual window flags and capture protection; no additional reviewers were spawned.

All saved device settings were read back after restoration. Only the two test-owned Download fixtures, the empty test backup folder and test-owned screenshot/XML files were removed. No app-data reset ran on the Samsung; its synthetic test profile remains, because automatic approval review rejected clear-state automation. It must be explicitly cleared before personal use.

The subsequent API 24 rendering fix was installed as an update without clearing Samsung data. The installed APK hash matched the rebuilt candidate and the activity retained hardware acceleration. The competing fitness test runner returned to the foreground before the final Overview assertion; that interrupted assertion is not counted as a passing UI smoke test. The earlier completed 200% layout run remains the production UI evidence.

Final Samsung readback retained an empty accessibility-service list, font scale 0.8, animation scales 1.0 and airplane mode off. The accessibility-enabled flag then reported 0, while the saved baseline had reported 1 with no enabled services. No setting was overwritten while the competing runner was active. Only the owned API 24 emulator was stopped after evidence collection.
