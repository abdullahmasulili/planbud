# Dependency patches

## expo-crypto 58.0.7

`expo-crypto@58.0.7.patch` changes only Android's authenticated-decryption output conversion. The upstream adapter allocates a ByteBuffer using `Cipher.getOutputSize`, then returns its whole backing array. Android allows that capacity estimate to exceed the actual plaintext length. API 24 returned 32 bytes for a published 16-byte NIST plaintext, so backup authentication succeeded but exact-length and JSON validation failed.

The patch copies only `plaintext.position()` bytes after successful `doFinal`. Android specifies that the output buffer's position advances by the actual number of bytes written. Cipher selection, nonce, AAD, key handling, tag validation and exception behavior remain owned by Expo's adapter. No JavaScript plaintext trimming or authentication bypass is introduced.

The exact-version patch is registered in `pnpm-workspace.yaml` and the lockfile. Frozen installation must apply it. `package.json` opts only `expo-crypto` out of Expo's precompiled modules through `expo.autolinking.android.buildFromSource`; otherwise Gradle would use an unpatched AAR. Its Kotlin context is upstream code; this narrow compatibility change does not authorize class-based application components or a replacement cryptographic implementation. See [Expo's precompiled module configuration](https://docs.expo.dev/guides/prebuilt-expo-modules).

Native regressions are in `tests/native/crypto-contract.ts`: the independent NIST vector, container interoperability, exact lengths at 0/1/15/16/17/31 bytes and damaged-tag rejection. Re-run them on API 24 and a modern Android target before upgrading or removing this patch. Preparing the patch does not establish runtime acceptance; see the [qualification report](../docs/engineering/android-qualification.md).

Reference: [Android Cipher output sizing and doFinal](https://developer.android.com/reference/javax/crypto/Cipher).
