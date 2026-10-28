# Plan Bud product and engineering specification

Status: Approved by the user on 2026-10-20. Source implementation is complete. The Android candidate is verified on API 36; remaining device qualification is recorded in `docs/engineering/verification.md`.
Date: 2026-10-20 (Asia/Jakarta)

## Purpose and confirmed requirements

Build a personal budget planner in the existing Expo project. Success means the user can plan spending against financial goals, record actual activity, and recover data without any remote service.

| ID       | Confirmed requirement                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLAT-001 | Deliver Android only. Exclude iOS implementation and web delivery.                                                                                                                                                                    |
| OFF-001  | All user features work offline, including first launch, planning, backup, and restore.                                                                                                                                                |
| BACK-001 | Export encrypted backups in an app-specific format and import them through the app.                                                                                                                                                   |
| BACK-002 | Use a generated 12-word mnemonic recovery phrase instead of a backup password.                                                                                                                                                        |
| GOAL-001 | Users define financial goals that inform budget planning through decision support.                                                                                                                                                    |
| UI-001   | Use Material Design 3 with Plus Jakarta Sans, interpreting the requested Jakarta Sans font as this family.                                                                                                                            |
| UI-002   | Support light and dark schemes.                                                                                                                                                                                                       |
| ENG-001  | Use spec-driven development, documented guidelines, and enforceable engineering guardrails.                                                                                                                                           |
| ENG-008  | Apply DRY, KISS, SOLID, appropriate design patterns, clean layer separation, and domain directory grouping.                                                                                                                           |
| ENG-009  | Use anonymous arrow-function expressions with descriptive bindings; no class components.                                                                                                                                              |
| ENG-010  | Use Zustand and React Context API with explicit, separate responsibilities.                                                                                                                                                           |
| ENG-011  | Prefer `async` / `await`, strictly limit `.then()` / `.catch()` chains, encapsulate error handling at responsible boundaries, require meaningful JSDoc contracts, and use modern ES6+ syntax and React / React Native best practices. |
| ENG-012  | Exclude machine-specific local paths from all authored and delivered artifacts.                                                                                                                                                       |

The following sections define the approved product behavior. The engineering conventions are mandatory; their exact interpretation and planned enforcement are defined in the [engineering standards](../../engineering/standards.md). The [implementation plan](../../superpowers/plans/2026-10-20-budget-planner.md) was approved for in-session execution.

## MVP scope

- One local personal profile, one currency, calendar-month budgets, and independent named planning estimates.
- Choose the currency during setup. Default the selection from device locale; require confirmation. Changing currency after records exist requires clearing data or restoring a different profile; do not relabel amounts or convert them silently.
- Enter planned monthly income and category spending limits. Mark categories as essential or flexible.
- Record, edit, and delete income and expense transactions with a date, category where applicable, amount, and optional note.
- Create, edit, complete, and archive financial goals; record and correct actual goal contributions.
- Review monthly planned versus actual spending and goal progress.
- Preview goal-based planning recommendations and explicitly apply selected adjustments.
- Export and restore encrypted backups through Android file selection.
- Choose system, light, or dark appearance; persist the choice locally.

Exclude authentication, bank connections, cloud sync, remote analytics, advertising, remote AI, automatic currency conversion, investment recommendations, and recurring transaction automation from the MVP.

## Named plans and visual summaries

Approved scope extension on 2026-10-27: separate planning estimates, without assigning transactions to named plans.

- PLAN-001: Create, edit, and delete multiple named plans, such as a vacation. Each has independent funding and named expense estimates in the profile currency. Plans are independent of calendar months and each other; they do not reserve monthly income or change transaction totals or goal allocations.
- PLAN-002: Derive allocated and remaining funding from expense estimates. Allow an overallocated plan and show its exact shortfall. Reject invalid or unsafe totals. Zero funding and zero estimates are valid. Bound each plan to 100 expense estimates.
- PLAN-003: Keep named plans in SQLite across restarts and in encrypted backups. Upgrade schema 1 without changing existing records. Accept original version-1 snapshots; emit version 2 with named plans, and reject unsupported snapshot versions.
- UI-009: Use Material cards for financial summaries, labeled planned-versus-actual bar charts, and a semicircular spending gauge. Give each spending category its own card in the planner and overview. Show exact amounts alongside charts, including zero-limit and overspending states. Charts use source records; never invent history.
- UI-010: Named plan cards and their editor show an allocation gauge and expense breakdown. Keep scalable text, light/dark theme roles, native Android back/discard confirmation, bounded forms, and accessible text equivalents. Deletion names the plan and requires confirmation.

## Money and date rules

- MONEY-001: Store monetary amounts as integers in the selected currency's minor unit; use that currency's exponent rather than assuming two decimal places. Reject non-finite, unsafe, or out-of-range amounts and arithmetic results.
- MONEY-002: Transaction amounts must be positive. The transaction type determines income or expense. Goal contributions are separate earmarking records and do not count again as income or spending.
- MONEY-003: Derive totals from source records. Editing or deleting a record updates all affected summaries.
- DATE-001: Store transaction and contribution dates as validated calendar dates, not UTC-midnight timestamps. Store audit timestamps separately.
- DATE-002: Assign records to the calendar month of their recorded date. Device timezone changes must not move existing records between months.
- DATA-001: Validate inputs in the application layer and enforce applicable database constraints. Multi-record changes commit atomically.

## Goal-based decision support

Use deterministic calculations running entirely on the device. Do not require an AI model or network service.

### Inputs and calculation

- DSS-001: A goal has an ID, name, target amount, starting saved amount, optional deadline, priority (high, medium, low), contribution history, and active/completed/archived state.
- DSS-002: Actual saved amount equals starting saved amount plus recorded contributions. Clamp the remaining target at zero. A planned contribution does not increase actual saved amount.
- DSS-003: For each category, reserve the larger of its monthly limit and actual monthly spending. Monthly capacity equals planned income minus all category reserves minus actual goal contributions already recorded in that month. This prevents overspending or earlier contributions from being allocated again. If negative, show the deficit and allocate zero to goals until the user adjusts the plan.
- DSS-004: For an incomplete goal with a current or future deadline, count calendar months from the planning month through the deadline month, inclusive. Required monthly contribution equals the remaining target divided by that count, rounded up to a minor unit.
- DSS-005: An incomplete goal whose deadline predates the planning month is overdue. Display its remaining target separately; do not divide by a zero or negative horizon. A goal without a deadline requires a user-entered desired monthly contribution before automatic allocation.
- DSS-006: Allocate available capacity toward required contributions by priority, then earliest deadline (undated last), then stable goal ID. Never allocate beyond capacity or a goal's remaining target. Explain that this prioritizes selected goals rather than guaranteeing every deadline.
- DSS-007: Show required contribution, proposed allocation, and funding gap for each eligible goal. If funds are insufficient, present the shortfall and let the user reduce flexible category limits, reduce the target, change priority, or extend the deadline.
- DSS-008: Recommendations never reduce essential limits automatically. A proposed flexible limit cannot fall below already-recorded spending for that category and month.
- DSS-009: Show the input amounts and reason behind each recommendation. Mark plans based only on user-entered estimates as estimates. Do not invent historical income or spending.
- DSS-010: Applying recommendations requires a preview and explicit action. Recompute against current data before saving; invalidate a preview if its inputs changed. Keep historical monthly plans independent.

### Illustrative acceptance example

In an example using whole currency units, planned income of 1,000, essential limits of 600, and flexible limits of 200 leave 200 for goals. A high-priority goal needing 150 per month receives 150; a lower-priority goal needing 100 receives 50 and shows a gap of 50. The user sees these calculations before applying the plan. These numbers are a test fixture, not financial advice or suggested personal limits.

## Encrypted backup and recovery

### Meaning of app-specific import

BACK-003: The app exports a versioned `.planbud` encrypted container and provides its restore workflow. No plaintext JSON, CSV, or spreadsheet export is included in the MVP. The extension is a format association, not a security mechanism. A third-party program with the format and recovery secret could implement decryption; do not promise exclusive decryption by this app.

### Recovery phrase lifecycle

- KEY-001: Generate 128 bits with a cryptographically secure random source on the Android device, then encode them as a BIP-39 English 12-word mnemonic with its checksum. Never generate a real user's phrase in chat, fixtures, a server, or a build script. Never ask the user to invent the words.
- KEY-002: Label the words with their order. Before enabling export, require confirmation of three randomly selected word positions and acknowledge that both the file and phrase are required for recovery.
- KEY-003: Create a new phrase for this app. Do not suggest reusing a cryptocurrency wallet phrase. Provide no wallet or blockchain functionality.
- KEY-004: Keep the local recovery entropy in Android protected secret storage, separate from the financial database and backups. Derive the display phrase only when needed. Do not store words in general application state persistence, logs, crash output, clipboard, exported metadata, or screenshots. Obscure sensitive screens in Android recents and prevent capture while the phrase is visible.
- KEY-005: The phrase can be revealed deliberately in settings, with the same sensitive-screen protections. Erase references to transient phrase state when the view closes or backgrounds; do not claim guaranteed memory erasure in a JavaScript runtime.
- KEY-006: The saved phrase is independent of the installation and device. Restoring on a new device requires no original keystore entry, account, app PIN, or network request.
- KEY-007: If local secret storage is missing or inaccessible, never silently create a replacement key. Ask for the existing phrase or offer explicit creation of a new phrase for future exports. Changing the phrase does not change old backups; each backup requires the phrase used when it was created.
- KEY-008: Neither the app nor a remote service can reset a lost phrase or recover an unavailable backup file. Explain this during backup setup, not only after failure.

### Version 1 cryptographic profile

Use maintained cryptographic libraries and native primitives with published test vectors. Do not implement cryptographic primitives manually.

1. Normalize and validate the English mnemonic, including word count, word membership, word order, and checksum. Decode it to the original 16-byte entropy. Use BIP-39 for mnemonic encoding; this profile does not use wallet seed derivation.
2. Generate a fresh 32-byte random salt for every export. Use HKDF-SHA-256 with the recovery entropy as input keying material, that salt, UTF-8 info `plan-bud/backup/v1`, and a 32-byte output to derive the backup key. A 12-word phrase supplies 128 bits of entropy even though the resulting key is 256 bits long.
3. Encrypt the payload with AES-256-GCM, a fresh random 12-byte nonce, and a 16-byte authentication tag. Authenticate the header as additional authenticated data so format and derivation metadata cannot be changed undetected.
4. The header includes the magic identifier, format/profile version, salt, nonce, and ciphertext length. Specify exact byte layout and encoding in a backup-format document before implementation. Include no personal names, goal names, or financial values in the unencrypted header.
5. Encrypt a consistent snapshot containing profile, currency, categories, plans, transactions, goals, contributions, appearance preference, and schema version. Exclude recovery entropy, mnemonic, transient state, derived totals, logs, and device credentials.
6. Use a proposed 16 MiB limit for the complete container. Check lengths and supported profile parameters before allocation or decryption; validate all payload fields, IDs, references, numeric ranges, and counts before restore. Do not decompress user-controlled input in version 1.

### Restore behavior

- RESTORE-001: Select a file, enter all 12 words, authenticate and decrypt, validate and migrate the supported schema, preview record counts and snapshot date, then confirm replacement of local data. Version 1 replaces data; merging is excluded.
- RESTORE-002: Wrong words, a checksum error, wrong valid phrase, damaged ciphertext, altered metadata, unsupported versions, malformed records, and cancellation leave existing financial data unchanged. Use a combined failure message when a valid phrase fails authentication; do not claim to distinguish the wrong key from corrupted ciphertext.
- RESTORE-003: Perform replacement in one database transaction. Persist the restored recovery secret separately after success. If protected secret storage fails, keep the restored financial data, disable export, and prompt the user to retry saving the secret; never export under a mismatched or newly generated secret.
- RESTORE-004: After restore, future backups use the restored phrase unless the user explicitly changes it. Recompute totals and recommendations from restored source records.
- RESTORE-005: Do not write decrypted backup content to shared storage or plaintext temporary files. Cancellation and failures clean up app-owned temporary files.

## Offline and local data boundary

- OFF-002: Bundle fonts, icons, word list, and all required assets. Release features must work on a fresh install in airplane mode.
- OFF-003: No automatic cloud backup, sync, analytics, remote configuration, or runtime font downloads. Disable automatic Android app-data backup/transfer where supported and inspect the generated release configuration. Do not claim the app controls how a user-selected document provider stores an exported encrypted file.
- OFF-004: Use an app-private local database for financial records and protected secret storage for recovery entropy. Backup encryption does not by itself encrypt the live database; this MVP does not claim additional full-database encryption or protection on a compromised device.
- OFF-005: Development tooling may use a local development server. Verify the packaged release separately so development connectivity does not become a runtime requirement.

## UI and accessibility

- UI-003: Use shared Material 3 color roles, typography roles, component states, and shape tokens. Apply Plus Jakarta Sans consistently to app-owned text, input, and navigation components; platform-owned pickers may use system typography.
- UI-004: Follow the system scheme by default; allow explicit light or dark overrides. Preserve readable financial statuses and charts in both schemes without relying only on color.
- UI-005: Support Android font scaling, screen reader labels, keyboard avoidance, safe areas, and accessible touch targets. Validate dialogs and forms with large text and TalkBack.
- UI-006: Empty views explain the next action. Loading, invalid input, storage failure, rejected restore, and insufficient-budget states have actionable messages.
- UI-007: Proposed information architecture: Overview, Plan, Transactions, Goals; settings contains appearance and backup/recovery. Overview emphasizes remaining planned spending and goals requiring attention. Navigation actions must have implemented destinations.
- UI-008: Use a calm visual direction with ENERGY 1 / RHYTHM 1 / MOTION 1. Use purposeful state transitions and respect reduced motion. Final palette and component examples belong in `DESIGN.md` before UI implementation; Material 3 and the selected font are fixed user choices.

## Architecture and engineering guardrails

The repository currently contains an Expo SDK 58 starter with Expo Router, strict TypeScript, and a pnpm lockfile. Preserve existing user instructions and verify compatible APIs before selecting additional dependencies.

| Area                                   | Proposed boundary                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                             | Routes, layouts, and screen composition only.                                                                                                                         |
| `src/domains/<domain>/domain/`         | Pure domain models, validation, rules, and calculations.                                                                                                              |
| `src/domains/<domain>/application/`    | Use cases and dependency ports owned by each business domain.                                                                                                         |
| `src/domains/<domain>/infrastructure/` | Domain-specific repositories and platform adapters implementing ports.                                                                                                |
| `src/domains/<domain>/presentation/`   | Domain screens, components, hooks, and Zustand store adapters.                                                                                                        |
| `src/shared/`                          | Proven shared primitives, database connection/migration support, and Material UI tokens/components; keep domain, infrastructure, and presentation sublayers separate. |
| `src/composition/`                     | Construct adapters, inject use-case dependencies, and provide stable Context / store instances.                                                                       |

Group budgeting, transactions, goals, backup, and settings by business domain. The [engineering standards](../../engineering/standards.md) own the directory contract, dependency direction, state ownership, coding conventions, patterns, documentation requirements, and enforcement map. Do not introduce parallel top-level feature and data structures that split a business domain across the project.

- ENG-002: Each feature change references requirement IDs, acceptance cases, and its verification evidence. Update the spec before implementing changed behavior.
- ENG-003: Keep canonical product rules here and coding/architecture conventions in the engineering standards. Add architecture, contributor guidance, decision records, `DESIGN.md`, and the exact backup-format contract during foundation work; keep `AGENTS.md` a concise route to those documents without duplicating rules.
- ENG-004: Enforce typechecking, lint, formatting, forbidden dependency imports, and relevant tests in CI. Local hooks provide feedback; required remote checks need separate repository settings and must not be claimed configured until verified.
- ENG-005: Avoid direct database or cryptography calls from screens. Validate untrusted data at import and persistence boundaries. Do not log recovery material or full financial records.
- ENG-006: Pin compatible dependencies through the repository's Expo install workflow, keep pnpm as the package manager, preserve the lockfile, and document decisions to add dependencies. Generate native projects through Expo tooling and configuration rather than hand-editing generated directories.
- ENG-007: Run lint and typecheck before implementation completion, plus relevant tests, Android runtime checks, and review. Report blocked checks accurately. Follow the existing Git and GitHub identity policies; do not auto-commit or publish.

## Acceptance and release evidence

| Requirement group     | Required evidence before release                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MONEY / DATE          | Tests for currency exponents, safe arithmetic, invalid values, leap days, month boundaries, and edits/deletions.                                                                                     |
| DSS                   | Tests for deterministic allocation, completed/overdue/undated goals, zero or insufficient income, ties, rounding, protected essential limits, and changed preview inputs.                            |
| KEY / BACK            | Published BIP-39 and HKDF vectors, fixed AES-GCM vectors, random-source failure handling, repeated exports using fresh salt/nonce, and absence of secrets in containers or logs.                     |
| RESTORE               | Round-trip restore on a separate clean installation, all listed rejection paths, transaction rollback, and protected-secret-storage failure.                                                         |
| DATA                  | Migration tests with previous schema fixtures and persistence after force-stop/restart.                                                                                                              |
| UI                    | Android interaction checks in light and dark, large text, TalkBack, keyboard-visible forms, and sensitive-screen capture/recents checks.                                                             |
| OFF                   | Fresh-install release walkthrough in airplane mode, packaged-asset checks, and release backup/network configuration inspection.                                                                      |
| ENG                   | Passing configured CI checks, spec-to-test mapping, and code review with no unresolved material findings.                                                                                            |
| Engineering standards | Positive and negative checks proving function, promise, JSDoc, dependency-boundary, and artifact-path rules; review evidence for principles and native behavior that static checks cannot establish. |

The first implementation slice should prove this flow with real persistence: create a monthly budget, record an expense, observe updated totals after restart, create a goal and preview its allocation, then export and restore using the 12-word phrase. Staging the slice into smaller implementation tasks belongs in the implementation plan.

## Sources used for the proposed design

- [BIP-39 mnemonic generation and checksum](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [RFC 5869: HKDF](https://www.rfc-editor.org/rfc/rfc5869)
- [Expo SDK 58 Crypto](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/)
- [Expo SDK 58 SecureStore and Android backup lifecycle](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/)
- [Expo SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [Expo SDK 58 Font](https://docs.expo.dev/versions/v58.0.0/sdk/font/)
- [Material Design 3](https://m3.material.io/)
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
