# Plan Bud encrypted container, version 1

Status: implemented profile; independent native AES-GCM and container interoperability contracts passed on Android. Provider/release acceptance is tracked in the verification record.

Files use `.planbud`. The association is not access control: anyone with the format and recovery secret could implement decryption. Both the encrypted file and the original 12-word recovery phrase are required. There is no server reset.

All multi-byte integers are unsigned big-endian. The complete file is at most 16,777,216 bytes. Empty plaintext, compression, trailing bytes, unknown versions, and unknown cryptographic profiles are rejected before cryptographic processing. No plaintext temporary file is permitted.

| Byte offsets           | Size   | Content                                              |
| ---------------------- | ------ | ---------------------------------------------------- |
| 0–7                    | 8      | ASCII `PLANBUD` followed by one zero byte            |
| 8–9                    | 2      | Container version `1`                                |
| 10–11                  | 2      | Cryptographic profile `1`                            |
| 12–43                  | 32     | Fresh native CSPRNG salt per export                  |
| 44–55                  | 12     | Fresh native CSPRNG GCM nonce per export             |
| 56–59                  | 4      | Ciphertext byte length, excluding authentication tag |
| 60 through 59 + length | length | Ciphertext                                           |
| Last 16 bytes          | 16     | GCM authentication tag                               |

The full 60-byte header is additional authenticated data. The nonce appears once in this format: do not append a native sealed-data combined nonce/ciphertext/tag representation.

Decode a valid English BIP-39 mnemonic to its original 16 entropy bytes. Do not derive a wallet seed. Derive 32 key bytes with HKDF-SHA-256: input keying material is those 16 bytes, salt is the header's 32 bytes, info is UTF-8 `plan-bud/backup/v1`, output length is 32. Encrypt with AES-256-GCM, the header nonce, and a 16-byte tag. The mnemonic provides 128 bits of entropy; a 256-bit derived key does not increase that entropy.

Use maintained libraries for BIP-39, HKDF, and SHA-256, and native Expo Crypto for CSPRNG and AES-GCM. Never fall back to `Math.random`. Return one authentication failure for wrong valid phrases and altered authenticated data; never return partially authenticated plaintext.

The plaintext is strict UTF-8 JSON containing a supported snapshot contract: schemaVersion, createdAt (UTC ISO audit timestamp), profile, categories, plans, transactions, goals, contributions, and allocations. Snapshot schema version is independent of the encrypted-container version. Container version 1 accepts snapshot schema versions 1 and 2. Version 2 adds the required `namedPlans` array; each plan has exactly `id`, `name`, `funding`, and `items`, and each item has exactly `id`, `name`, and `amount`. New exports use snapshot schema 2. Restoring schema 1 clears existing named plans and imports its original source records without inventing estimates. Older app versions reject schema-2 backups; updating the app is required to import them. Unknown fields are rejected, including credentials, executable fields, provider locations, and device metadata. Totals, command logs, recovery metadata, entropy, mnemonic, cached previews, and storage references are excluded.

Validation limits are shared by outgoing and incoming snapshots: at most 50,000 records summed across top-level arrays, nested monthly limits, and named-plan expense estimates (up to 100 per named plan); names at most 120 Unicode code points; notes at most 2,000; IDs at most 100. Inputs must also satisfy canonical currency/exponent, locale, appearance, date, and exact safe-integer rules. Validate uniqueness and all category, plan, goal and contribution relationships before replacement. No fields are executed. An oversized outgoing dataset fails without truncation or mutation.

Local recovery metadata is excluded from snapshots. Its fingerprint is lowercase SHA-256 hex of UTF-8 `plan-bud/recovery/v1` concatenated with the 16 entropy bytes. Protected slots are keyed by profile and random generation. Restore commits financial records and a pending generation/fingerprint atomically; export remains disabled until the matching protected secret has been saved and readiness committed.

Verification uses [RFC 5869 appendix A](https://www.rfc-editor.org/rfc/rfc5869#appendix-A), published BIP-39 vectors, fixed AES-GCM vectors, and a container fixture independently produced by Node's OpenSSL-backed cryptography. Native interoperability must pass on Android; round trips alone are insufficient.
