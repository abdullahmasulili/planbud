# Budget Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an Android-only offline personal budget planner with explainable goal allocations and encrypted, 12-word-recoverable backups.

**Architecture:** Group budgeting, transactions, goals, backup, and settings by domain, with pure domain rules, application-owned ports, infrastructure adapters, and presentation consumers. Composition injects dependencies and scoped Zustand stores through Context; SQLite owns durable records. Backup operations authenticate a versioned container and validate a complete snapshot before replacing data.

**Tech Stack:** Existing Expo SDK 58, React 19.3, React Native 0.88, strict TypeScript, Expo Router, pnpm; planned additions are Zustand, React Native Paper, Expo SQLite/Crypto/SecureStore/FileSystem/DocumentPicker/ScreenCapture/Localization, bundled Plus Jakarta Sans, `@scure/bip39`, `@noble/hashes`, Jest 30 with `jest-expo`, React Native Testing Library, and Maestro for Android flows. Compatibility is verified before installation; this list does not claim packages are installed.

**Spec:** [Approved product specification](../../specs/001-budget-planner/spec.md) and [engineering standards](../../engineering/standards.md).

**Status:** Plan awaiting user review and execution-method selection. Source specification and standards approved by the user on 2026-10-20. No product implementation or new enforcement tooling is included in this planning change.

## Global constraints

- PLAT-001: Deliver Android only. Exclude iOS implementation and web delivery.
- OFF-001: All user features work offline, including first launch, planning, backup, and restore.
- BACK-002: Use a generated 12-word mnemonic recovery phrase instead of a backup password.
- UI-001: Use Material Design 3 with Plus Jakarta Sans, interpreting the requested Jakarta Sans font as this family.
- UI-002: Support light and dark schemes.
- ENG-012: Exclude machine-specific local paths from all authored and delivered artifacts.
- Follow every rule in the approved engineering standards, including arrow functions, no class components, async/await, encapsulated catches, meaningful JSDoc, domain grouping, and independent Zustand/Context responsibilities.
- Use the current Expo install workflow and compatible versions; keep the pnpm lockfile and supply-chain policy. Never bypass that policy or silently downgrade the SDK to make a dependency work.
- Never hand-edit generated native projects. Never generate a real recovery phrase outside the running app. Public cryptographic test vectors are labeled fixtures and must never be displayed as a user's phrase.
- Work within the existing Git policy. Task checkpoints mean reviewable changes, not automatic staging, commits, pushes, or GitHub writes. Commit only when separately authorized.

## Review focus

1. Localized monetary input and currency precision: decimal-comma input must not silently become a different amount; reject grouping in editable amounts and reject fractions exceeding the currency exponent. Pin this in Task 2.
2. Repeated taps and retries: submitting one transaction twice must not create two records or increment the data revision twice. A reused operation ID with different input is a conflict. Pin this in Task 6.
3. Stale plan or restore previews: an intervening write invalidates confirmation rather than applying recommendations or replacing newer data under an old preview. Pin this in Tasks 8 and 12.
4. Untrusted file providers: missing/false file sizes, truncated reads, revoked permission, cancellation, and files larger than 16 MiB must not trigger unbounded reads or modify financial data. Pin this in Tasks 10 and 11.
5. Process death between database replacement and secret storage: a restart must disable export until the restored secret is adopted; an old keystore secret must never encrypt a new backup accidentally. Pin this in Task 12.

## Sequence, checkpoints, and current blockers

Execute Tasks 1 through 13 in order. Each task consumes the contracts from earlier tasks; splitting implementation by unrelated screens would duplicate state and storage decisions. Tasks 1-4 establish the foundation; Tasks 5-8 deliver daily planning; Tasks 9-12 deliver recovery; Task 13 qualifies the APK.

Package-manager invocations previously stopped during supply-chain verification because package-registry DNS access was unavailable. Task 1 must resolve access and complete the checks; those attempts are not passing lint/typecheck evidence. Planning does not require installing dependencies or starting a cloud build.

Every code task uses its named tests below: write the test, run it and verify the intended failure, implement the smallest change, run it again, then run the task's verification command. Compilation or missing dependencies alone are not adequate red-phase evidence once the harness exists. Include each test's requirement ID in its name. Tests, callbacks, and scripts also follow the engineering contract.

## File responsibility map

The paths below are repository-relative. Create only the directories actually used by each task. Domain `application/public.ts` files expose only supported types and ports; consumers cannot import private implementations through them.

| Owner                   | Files and responsibility                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tooling                 | `eslint.config.mjs`, `jest.config.cjs`, `tests/setup.ts`, `tooling/eslint-rules.mjs`, `scripts/check-boundaries.mjs`, `scripts/check-artifacts.mjs`, `tests/tooling/guardrails.test.ts`, `.github/workflows/ci.yml`. Test/tool configuration may use required module formats through an exact documented exception. |
| Pure shared types       | `src/shared/domain/money.ts`, `calendar-date.ts`, `result.ts`; money/date parsing and typed outcomes.                                                                                                                                                                                                               |
| Database infrastructure | `src/shared/infrastructure/database/connection.ts`, `migrations.ts`, `schema.ts`; connection, schema versions, transactions, and data revision.                                                                                                                                                                     |
| Composition             | `src/composition/create-services.ts`, `services-provider.tsx`, `bootstrap.ts`; wiring and profile-scoped lifecycle only.                                                                                                                                                                                            |
| Shared presentation     | `src/shared/presentation/theme/{tokens,typography,theme}.ts`, `app-providers.tsx`, `operation-launcher.ts`, `components/{screen,amount-field,async-state}.tsx`; reusable Material wrappers and terminal operation handling.                                                                                         |
| Business domains        | `src/domains/<domain>/{domain,application,infrastructure,presentation}/`; use the exact files introduced by Tasks 3 and 5-12.                                                                                                                                                                                       |
| Routes                  | `src/app/_layout.tsx`, `(tabs)/_layout.tsx`, `(tabs)/index.tsx`, `(tabs)/plan.tsx`, `(tabs)/transactions.tsx`, `(tabs)/goals.tsx`, `setup.tsx`, `settings.tsx`, `recovery.tsx`, `backup.tsx`, `restore.tsx`; thin composition and route exports.                                                                    |
| Evidence                | `docs/architecture.md`, `docs/engineering/verification.md`, `docs/decisions/001-foundation.md`, `docs/security/backup-format-v1.md`, `docs/release/android-checklist.md`, `CONTRIBUTING.md`, `DESIGN.md`, `.maestro/`; portable, requirement-linked contracts and results.                                          |

## Task 1: Establish and prove the engineering gate

**Files:** Modify `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `README.md`; create the tooling files above, `.prettierrc.json`, `.prettierignore`, `.nvmrc`, `.npmrc`, `CONTRIBUTING.md`, `docs/decisions/001-foundation.md`, `docs/engineering/verification.md`. Modify existing starter `src/app/_layout.tsx`, `src/app/index.tsx`; remove the unused starter routes/components/hooks/styles and `scripts/reset-project.js` only after confirming no remaining references.

**Interfaces:** Produce package scripts `typecheck`, `test`, `format:check`, `check:boundaries`, `check:artifacts`, and `check`. `test` runs Jest in band; `check` runs format, lint, typecheck, boundary checks, artifact checks, and tests in sequence. Guardrail commands exit nonzero on violations and emit repository-relative diagnostics. The initial app renders a functional empty shell, with starter tutorials removed rather than exempted from rules.

- [x] Confirm package-registry access, choose a Node release meeting the installed SDK/package engine requirements, record it in `.nvmrc`/package engines, install from the frozen lockfile, and run Expo dependency checking and doctor. If access or compatibility fails, report that blocker without changing supply-chain settings.
- [x] Install SDK-compatible Expo lint/test dependencies through `pnpm exec expo install ... --dev`, including Jest 30, `jest-expo`, Jest types, React Native Testing Library, ESLint/Expo config, type-aware TypeScript lint rules, JSDoc checks, and Prettier. Add further runtime dependencies only in their owning tasks. Pin resolved direct versions in the lockfile and decision record.
- [x] Write `tests/tooling/guardrails.test.ts`: invoke checks against temporary synthetic sources and assert nonzero exits for a function declaration, named/anonymous function expression, method shorthand, class component, anonymous default component export, `var`, missing required JSDoc, floating promise, ordinary Promise chain, forbidden domain import via alias or relative path, re-export bypass, transitive forbidden dependency, cycle, and nonportable artifact reference. Assert zero for an arrow component with separate default export, documented async use case, legal port/adapter dependency, and the exact launcher exception. Build synthetic machine-path strings at runtime; never commit real workstation locations.
- [x] Configure and run the tooling tests red, then implement ESLint policy rules, TypeScript-resolved import graph checks, and artifact scanning. Limit the CommonJS exception to `jest.config.cjs` if required. Limit promise-chain allowances to the eventual `operation-launcher.ts`; validate its terminal catch rather than permitting arbitrary chains. Exclude generated/native/dependency files explicitly, not whole business domains.
- [x] Replace the starter with the minimal arrow-component shell and meaningful JSDoc. Remove iOS/web scripts and dead starter files; preserve needed launcher assets. Add the CI workflow using frozen dependencies and the same `pnpm check` command; document local hooks as convenience and remote required-check settings as separately verified administrative work.
- [x] Run `pnpm test -- tests/tooling/guardrails.test.ts`, then `pnpm check`. Expected: all positive and negative fixtures pass and the live repository passes every configured check. Record actual output summaries and installed compatibility findings without paths or secrets. Review the complete foundation diff before moving on.

## Task 2: Implement canonical money, calendar, and outcome contracts

**Files:** Create `src/shared/domain/{money,calendar-date,result,record-limits}.ts` and colocated `.test.ts` files; create `src/shared/presentation/operation-launcher.ts` and its test.

**Interfaces:** `MinorAmount` is a validated nonnegative safe integer; `Currency` is `{code: string; exponent: number}`; `CalendarDate` and `MonthKey` are validated `YYYY-MM-DD` and `YYYY-MM` strings. `Result<T>` is `{ok: true; value: T} | {ok: false; error: {code: string; message: string}}`, with sanitized messages. Produce `parseAmount(text: string, currency: Currency, locale: string): Result<MinorAmount>`, `addAmounts(values: readonly MinorAmount[]): Result<MinorAmount>`, `parseDate(text: string): Result<CalendarDate>`, `monthOf(date: CalendarDate): MonthKey`, `monthsInclusive(from: MonthKey, through: MonthKey): Result<number>`. `launchOperation(work: (isActive: () => boolean) => Promise<void>, onFailure: (error: unknown) => void): () => void` starts an observed operation and returns cancellation. Owning presentation hooks check the supplied active-lifecycle guard before UI callbacks; this is not a second financial-state store.

- [x] Write assertions: `parseAmount('12,50', {code: 'USD', exponent: 2}, 'id-ID')` succeeds with `1250`; JPY `1.5` fails; KWD `1.234` becomes `1234`; grouped input, negative input, `NaN`, infinity, unsafe sums, and excess precision fail. `monthOf('2028-02-29')` stays `2028-02` in different device timezones, invalid leap days fail, and inclusive October-December yields `3`.

```ts
it('MONEY-001 preserves a decimal-comma amount without floating-point rounding', () => {
  expect(parseAmount('12,50', { code: 'USD', exponent: 2 }, 'id-ID')).toEqual({
    ok: true,
    value: 1250,
  });
});
```

- [x] Write launcher tests: rejected work reaches the failure sink once, cancellation blocks view updates, and a failing sink never creates an unhandled rejection. Implement one contained terminal observer with a documented, tested Promise-method exception; ordinary workflows remain async/await.
- [x] Run those tests red; implement parsing without float multiplication for monetary conversion. Editable amounts accept digits plus the locale decimal separator, without grouping; formatting may group read-only values. Keep all date calculations independent of UTC timestamp conversion. Define canonical limits of 120 code points per name, 2,000 per note, 100 per ID, and 50,000 total snapshot array records in `record-limits.ts`; live field validation and backup validation reuse these values.
- [x] Run `pnpm test -- src/shared/domain src/shared/presentation/operation-launcher.test.ts`, then `pnpm check`. Expected: the exact parsing, rounding, calendar, and async-lifecycle assertions pass.

## Task 3: Build versioned persistence and the local profile lifecycle

**Files:** Create shared database files from the map, `src/domains/settings/domain/profile.ts`, `application/{public,profile-service}.ts`, `infrastructure/profile-repository.ts`, and their tests; create `tests/native/{contract-report,database-contract}.ts`, `docs/architecture.md`.

**Interfaces:** `Profile` is `{id: string; currency: Currency; locale: string; appearance: 'system'|'light'|'dark'}`. `ProfilePort` exposes `read: () => Promise<Profile|null>`, `initialize: (profile: Profile) => Promise<Profile>`, `setAppearance: (mode: Profile['appearance']) => Promise<void>`. `openDatabase(): Promise<DatabaseHandle>` and `migrateDatabase(db: DatabaseHandle): Promise<void>` are infrastructure-only. A transactional `dataRevision` advances once per successful mutation, never on rollback; public read snapshots expose `{profileId: string; revision: number}` without leaking SQL types.

- [x] Install Expo SQLite and Localization through the Expo install workflow. Write repository-contract assertions for one profile only, confirmed currency, retained appearance after reopening, failure to relabel currency after records exist, idempotent migrations, migration rollback, and revision rollback on failure.
- [x] Define schema version 1 in `schema.ts`: profile/settings, categories, monthly plans/category limits, transactions, goals, goal contributions, planned goal allocations, idempotency records, and local recovery-state metadata. Specify foreign keys, safe integer bounds, unique plan/category keys, command IDs, and cascade/restrict behavior explicitly. The local recovery metadata contains generation/status only, never entropy. Keep schema support centralized; domain repositories own their queries.
- [x] Run the contracts red; implement parameterized queries, connection lifecycle, exclusive write transactions, read-consistent snapshots, and migration transactions. Future-schema databases show a recoverable unsupported-version state, never an automatic reset.
- [x] Run `pnpm test -- src/domains/settings src/shared/infrastructure/database`, then `pnpm check`. Export a framework-independent `runDatabaseContract(db: DatabaseHandle): Promise<ContractReport>` from `tests/native/database-contract.ts`; `ContractReport` is `{passed: readonly string[]; failed: readonly {name: string; code: string}[]}`. It uses an isolated test database and covers real rollback, reopen, revision, and migration behavior. Execute this Android contract through Task 4's temporary diagnostics screen; do not report the mocked tests as native SQLite evidence.

## Task 4: Create the Android Material shell and scoped state composition

**Files:** Create composition/shared presentation files from the map, `src/domains/settings/presentation/settings-store.ts`, `src/domains/settings/presentation/{settings-screen,setup-screen}.tsx`, their tests, `src/app/{setup,settings,diagnostics}.tsx`, `src/composition/native-contract-screen.tsx`, `tests/native/run-contracts.ts`, `src/app/(tabs)/{_layout,index}.tsx`, `assets/fonts/` with font/license files, `DESIGN.md`; modify `src/app/_layout.tsx` and `app.json`; delete `src/app/index.tsx` after moving its shell into the grouped index so two routes never claim `/`.

**Interfaces:** `createSettingsStore(profile: Profile)` returns a vanilla Zustand store; `ServicesProvider` provides stable services and store instances. `useServices()` fails clearly outside its provider. `buildTheme(mode: 'light'|'dark')` returns coordinated Paper/router tokens with Plus Jakarta Sans. `bootstrap(): Promise<Result<{profile: Profile|null; recoveryReady: boolean}>>` selects setup, app, or actionable startup failure without deleting data. Screens export documented const-bound arrow components separately from default exports.

- [x] Install Zustand, React Native Paper, Expo DevClient, and required icon/font dependencies through Expo's installer; verify peers against React 19.3/RN 0.88. Set the Android package to `com.planbud.app` now so development and release address the same local profile. Bundle only used static Plus Jakarta Sans weights (400, 500, 600, 700) and their license with the `expo-font` config plugin. Do not use runtime font fetches or add a second navigation container.
- [x] Write provider/component tests for separate store instances, stable provider lifetime, selector stability, first-run currency confirmation, persisted theme override, system scheme changes, missing-provider errors, and bootstrap failure recovery. Add an explicit router functional `ErrorBoundary` export with retry; no authored class boundary.
- [x] Run tests red; document the Material role palette in `DESIGN.md` using existing splash color `#208AEF` as the source identity, a restrained neutral surface system, and light/dark contrast checks. Keep ENERGY/RHYTHM/MOTION at `1/1/1`. Define type, spacing, shape, status, and focus roles; use 48 dp minimum actionable touch areas and preserve text scaling.
- [x] Implement setup and settings as complete flows. The initial grouped index shows profile readiness and a working Settings action; introduce budget/transaction/goal actions and tabs only when their owning tasks finish. Use Expo Router layouts/navigation and compatible Material tab controls. Theme app-owned input/navigation text consistently; handle Android keyboard, insets, system bars, and back behavior. Temporary forms stay local; services/vanilla stores travel through Context; SQLite owns settings. Add a clearly development-only diagnostics route that runs `runNativeContracts(): Promise<ContractReport>` and shows sanitized pass/fail names, using isolated database/secret namespaces. This is a test composition entry, never a production feature; Task 13 deletes both the diagnostics route and its composition screen before release bundling.
- [x] Run `pnpm test -- src/composition src/shared/presentation src/domains/settings/presentation`, then `pnpm check` and an Android development build. Expected: fresh setup works in airplane mode with bundled fonts; light/dark/system changes stay coherent, including restart, large text, and settings navigation.

## Task 5: Deliver monthly budgets and category planning

**Files:** Create `src/domains/budgeting/domain/{category,monthly-plan}.ts`, `application/{public,budget-service}.ts`, `infrastructure/budget-repository.ts`, `presentation/budget-store.ts`, `presentation/plan-screen.tsx`, colocated tests, `src/app/(tabs)/plan.tsx`.

**Interfaces:** `Category` is `{id: string; name: string; kind: 'essential'|'flexible'; archived: boolean}`. `MonthlyPlan` is `{month: MonthKey; plannedIncome: MinorAmount; limits: readonly {categoryId: string; amount: MinorAmount}[]}`. `PlanVersion` is `{plan: MonthlyPlan; revision: number}`. `createBudgetService(port: BudgetPort)` produces `saveCategory(category: Category): Promise<Result<Category>>`, `savePlan(input: {plan: MonthlyPlan; expectedRevision: number}): Promise<Result<PlanVersion>>`, and `readMonth(month: MonthKey): Promise<Result<PlanVersion>>`. Define `BudgetPort` in `application/budget-service.ts` with those same input signatures and raw awaited value types (`Category`/`PlanVersion`) instead of `Result`; the application boundary translates expected adapter failures. Publish immutable planner inputs, not concrete repository access.

- [x] Write domain/repository tests for valid zero limits, negative/overflow rejection, duplicate category limits, missing category references, archived categories retaining history, and separate October/November plans. Save failure leaves the previous plan and revision intact.
- [x] Run tests red; implement use cases/repository and the Plan screen with explicit save/error state, category editing, and planned income. Archive referenced categories rather than deleting their historical transactions. Guard against concurrent saves with revision checking.
- [x] Write and pass component tests for keyboard-visible amounts, currency units, essential/flexible selection, invalid fields, saving/canceling edits, and month switching without overwriting another month.
- [x] Run `pnpm test -- src/domains/budgeting`, then `pnpm check`. Verify Android persistence after force-stop/restart before recording this slice as complete.

## Task 6: Deliver transaction recording and accurate monthly summaries

**Files:** Create `src/domains/transactions/domain/{transaction,summary}.ts`, `application/{public,transaction-service}.ts`, `infrastructure/transaction-repository.ts`, `presentation/transaction-store.ts`, `presentation/{transactions-screen,transaction-form}.tsx`, their tests, `src/app/(tabs)/transactions.tsx`, `src/domains/budgeting/presentation/overview-screen.tsx`; modify `src/app/(tabs)/index.tsx` to render the real Overview.

**Interfaces:** `Transaction` is `{id: string; type: 'income'|'expense'; amount: MinorAmount; date: CalendarDate; categoryId: string|null; note: string}`. `Command<T>` is `{operationId: string; input: T}` and lives in `src/shared/domain/result.ts`. `createTransactionService(port: TransactionPort)` produces `save(command: Command<Transaction>): Promise<Result<Transaction>>`, `remove(command: Command<{id: string}>): Promise<Result<void>>`, `list(query: {month: MonthKey; cursor: string|null; limit: number}): Promise<Result<{records: readonly Transaction[]; nextCursor: string|null}>>`. Define `TransactionPort` in `application/transaction-service.ts` with the same operations/input signatures and raw awaited values instead of `Result`. Expense category is required; income category is null. Public monthly summaries include actual income and spending grouped by category; goal contributions are not transactions.

- [x] Write tests: adding/editing/deleting expenses changes the correct monthly totals; moving a date changes both affected months; income has no expense category; contributing to a goal never counts again as spending. Assert `save` called twice with one operation ID yields one transaction and one revision increment; different input under the same operation ID yields a conflict.
- [x] Run tests red; implement atomic idempotency records and paginated stable ordering by date then ID. Refresh disposable Zustand projections only after successful writes. On a failed refresh, show stale/error state instead of claiming the transaction failed if it committed.
- [x] Implement a FlatList-based history, add/edit/delete form flows, filters, and Overview planned-versus-actual amounts. Disable duplicate in-flight submits, preserve operation IDs across retries, and distinguish first-run empty history from empty filtered results. Add tabs only for implemented destinations.
- [ ] Run `pnpm test -- src/domains/transactions src/domains/budgeting/presentation`, then `pnpm check`. Android acceptance: one submit, retry/double tap, edit, delete, date move, paginated history, restart, and both themes produce accurate persisted totals.

## Task 7: Deliver financial goals and actual contribution history

**Files:** Create `src/domains/goals/domain/{goal,contribution}.ts`, `application/{public,goal-service}.ts`, `infrastructure/goal-repository.ts`, `presentation/goal-store.ts`, `presentation/{goals-screen,goal-form}.tsx`, tests, `src/app/(tabs)/goals.tsx`.

**Interfaces:** `Goal` is `{id: string; name: string; target: MinorAmount; startingSaved: MinorAmount; deadline: CalendarDate|null; priority: 'high'|'medium'|'low'; desiredMonthly: MinorAmount|null; state: 'active'|'completed'|'archived'}`. `Contribution` is `{id: string; goalId: string; amount: MinorAmount; date: CalendarDate}`. `createGoalService(port: GoalPort, today: () => CalendarDate)` exposes `saveGoal(command: Command<Goal>): Promise<Result<Goal>>`, `saveContribution(command: Command<Contribution>): Promise<Result<Contribution>>`, `removeContribution(command: Command<{id: string}>): Promise<Result<void>>`, and `readGoals(): Promise<Result<readonly GoalProgress[]>>`. `GoalProgress` adds `saved`, `remaining`, and `overdue` as derived fields; never persist redundant totals. Define `GoalPort` in `application/goal-service.ts`; writes have the same inputs/raw awaited outputs, and `readGoals` returns raw goals with their contributions for application derivation using the injected date.

- [x] Write tests for positive targets/contributions, starting savings, edits/deletions, saved above target (remaining zero), deadlines in the past, undated goals, archive/history preservation, and completing/reopening a goal without fabricating a contribution. Completion changes eligibility; actual savings remains derived.
- [x] Run tests red; implement storage and use cases with stable command IDs. Goal contributions reserve money in the planning month but do not create duplicate expense entries. Publish planner read models and executable validators through `application/public.ts`.
- [x] Implement complete goal/contribution forms, progress and priority editing, archive/completion controls, meaningful empty states, and accessible progress labels that include amounts rather than color alone.
- [x] Run `pnpm test -- src/domains/goals`, then `pnpm check`. Verify Android editing, contribution correction, restart, large text, and goal history.

## Task 8: Deliver explainable goal allocation and safe plan application

**Files:** Create `src/domains/budgeting/domain/allocate-goals.ts`, `application/{planning-contract,planning-service}.ts`, `presentation/planning-preview.tsx`, their tests; extend budget repository/store and Plan/Overview screens.

**Interfaces:** Define consumer-owned `PlanningGoal` in `domain/allocate-goals.ts`: `{id: string; state: 'active'|'completed'|'archived'; remaining: MinorAmount; deadline: CalendarDate|null; priority: 'high'|'medium'|'low'; desiredMonthly: MinorAmount|null}`. `PlanningInput` contains `{month: MonthKey; revision: number; plannedIncome: MinorAmount; categories: readonly {id: string; kind: 'essential'|'flexible'; limit: MinorAmount; spent: MinorAmount}[]; contributionsThisMonth: MinorAmount; goals: readonly PlanningGoal[]}`. `allocateGoals(input: PlanningInput): Result<PlanningPreview>` is pure. `PlanningPreview` is `{month: MonthKey; revision: number; capacity: MinorAmount; deficit: MinorAmount; allocations: readonly {goalId: string; requested: MinorAmount; allocated: MinorAmount; gap: MinorAmount; reasons: readonly string[]}[]; edits: readonly CategoryLimitEdit[]}`. `CategoryLimitEdit` is `{categoryId: string; amount: MinorAmount}`. `createPlanningService(ports: PlanningPorts)` exposes `preview(month: MonthKey): Promise<Result<PlanningPreview>>` and `apply(input: {preview: PlanningPreview; selectedEdits: readonly CategoryLimitEdit[]}): Promise<Result<void>>`. Define `PlanningPorts` in `application/planning-contract.ts` with `readInput(month: MonthKey): Promise<PlanningInput>` and `commit(input: {expectedRevision: number; month: MonthKey; edits: readonly CategoryLimitEdit[]; allocations: readonly {goalId: string; amount: MinorAmount}[]}): Promise<void>`. Composition supplies a consistent read adapter mapping published models into this consumer-owned DTO; domain code imports no other domain or application modules.

- [x] Write the specification fixture using minor units: income `100000`, essential `60000`, flexible `20000`, high-priority request `15000`, lower request `10000` produces allocations `[15000, 5000]` and gaps `[0, 5000]`. Add assertions for ceiling division, current-month deadlines, overdue/undated goals, completed/archived goals, stable ID ties, overspending, actual contributions already made, insufficient income, and arithmetic overflow.

```ts
it('DSS-006 funds the higher-priority goal and exposes the remaining shortfall', () => {
  const result = allocateGoals({
    month: '2026-10',
    revision: 1,
    plannedIncome: 100000,
    categories: [
      { id: 'essential', kind: 'essential', limit: 60000, spent: 0 },
      { id: 'flexible', kind: 'flexible', limit: 20000, spent: 0 },
    ],
    contributionsThisMonth: 0,
    goals: [
      {
        id: 'a',
        state: 'active',
        remaining: 15000,
        deadline: '2026-10-31',
        priority: 'high',
        desiredMonthly: null,
      },
      {
        id: 'b',
        state: 'active',
        remaining: 10000,
        deadline: '2026-10-31',
        priority: 'low',
        desiredMonthly: null,
      },
    ],
  });
  expect(result).toMatchObject({
    ok: true,
    value: {
      capacity: 20000,
      allocations: [
        { goalId: 'a', allocated: 15000, gap: 0 },
        { goalId: 'b', allocated: 5000, gap: 5000 },
      ],
    },
  });
});
```

- [x] Run tests red; implement category reserves as `max(limit, spent)` and allocate only nonnegative remaining capacity. Request no more than the remaining goal target; sort by priority, dated deadline, then ID. Undated goals need desired monthly input; overdue goals show their shortfall separately. Show explicit estimate labels and formulas from actual inputs.
- [x] Add tests that essential limits cannot be reduced, flexible edits cannot fall below spent, applying twice cannot double allocation, and an intervening transaction/contribution rejects a stale preview. Implement application validation and atomic revision comparison with recalculation; planned allocations do not create actual contributions.
- [x] Implement preview, selected adjustment controls, explicit apply/cancel, and actionable shortfall options linking to existing goal and category editing flows. Refresh previews on input change without silently applying them.
- [x] Run `pnpm test -- src/domains/budgeting`, then `pnpm check`. Verify the fixture and insufficient-capacity flow through Android screens. This checkpoint delivers the complete offline daily planner; do not label backup complete yet.

## Task 9: Implement mnemonic recovery and its protected local lifecycle

**Files:** Create `src/domains/backup/application/{public,recovery-service,recovery-ports}.ts`, `infrastructure/{mnemonic-codec,secure-recovery-store,random-source,sensitive-screen}.ts`, `presentation/recovery-screen.tsx`, `presentation/use-recovery-flow.ts`, `tests/native/recovery-contract.ts`, tests, `src/app/recovery.tsx`; extend local recovery metadata, `tests/native/run-contracts.ts`, and `app.json`.

**Interfaces:** `RandomPort.bytes(length: number): Uint8Array`; `RecoveryRecord` is `{profileId: string; generation: string; entropy: Uint8Array}` and exists only inside secret-handling workflows/adapters, never a store/Context value. `RecoveryRef` is `{profileId: string; generation: string}`. `RecoveryStorePort.read(ref: RecoveryRef): Promise<RecoveryRecord|null>`, `write(record: RecoveryRecord): Promise<void>`, `remove(ref: RecoveryRef): Promise<void>` use generation-specific secure slots. `LocalRecoveryState` is `{profileId: string; generation: string; fingerprint: string; status: 'pending'|'ready'}`. Its fingerprint is lowercase SHA-256 hex of UTF-8 `plan-bud/recovery/v1` followed by the 16 entropy bytes; it is nonsecret local metadata excluded from backup snapshots. `encodeMnemonic(entropy: Uint8Array): string` and `decodeMnemonic(words: string): Result<Uint8Array>` are infrastructure adapters. `createRecoveryService(ports)` creates/reveals/confirms/changes a phrase through a short-lived session; sessions expose `confirm(answers: readonly {position: number; word: string}[]): Promise<Result<void>>` and `dispose(): void`. Persist a generated secret only after all three positions are confirmed; update the database's active reference only after the new secure slot is saved, keeping the previous active key until explicit replacement succeeds.

- [x] Install Expo Crypto, SecureStore, ScreenCapture, `@scure/bip39`, and `@noble/hashes` through the Expo workflow. Verify Android bundling and byte APIs; use only the English word list and native Expo randomness, not an assumed Node/global crypto implementation. Use published vectors for phrase round trips and checksum failures; do not use mnemonic-to-wallet-seed APIs.
- [x] Write tests for exactly 16 entropy bytes/12 words, normalization and order, incorrect checksum, three distinct uniformly selected positions, all three answers required, missing/failed secure storage, explicit key replacement, cancellation, and reveal teardown. Inject deterministic entropy only for labeled vectors. Random-source failure must prevent setup/export, never use a fallback PRNG.
- [x] Run tests red; implement key storage and confirmation. No phrases, entropy, or decrypted data in Zustand/Context/devtools, logs, clipboard, snapshots, or crash messages. Reveal/input is local ephemeral state; clear it on blur/background. Prevent Android capture and recents visibility while secrets are present, and restore protection correctly on navigation/cancellation. Explain that the phrase and file are both required and cannot be reset.
- [x] Run `pnpm test -- src/domains/backup`, then `pnpm check`; run Android native checks for secret persistence across restart, loss after uninstall, and screenshot/recents protection. Missing secrets never cause silent key generation. `tests/native/recovery-contract.ts` exports `runRecoveryContract(): Promise<ContractReport>` using an isolated secure-storage namespace; register it with `runNativeContracts`. Tests and secrets must not ship through the release entry graph.

## Task 10: Specify and implement the authenticated backup container

**Files:** Create `docs/security/backup-format-v1.md`, `src/domains/backup/domain/container.ts`, `infrastructure/{backup-codec,key-derivation}.ts`, `tests/native/crypto-contract.ts`, tests, and `tests/fixtures/crypto/` with explicitly labeled public vectors; extend `tests/native/run-contracts.ts`.

**Interfaces:** `deriveBackupKey(entropy: Uint8Array, salt: Uint8Array): Uint8Array`; `sealBackup(payload: Uint8Array, entropy: Uint8Array): Promise<Uint8Array>`; `openBackup(container: Uint8Array, entropy: Uint8Array): Promise<Result<Uint8Array>>`. These live in infrastructure and use native AES-GCM plus maintained HKDF-SHA-256. Caller input is bounded; return no partially authenticated plaintext.

- [x] Write the format contract before code: bytes `0..7` are ASCII `PLANBUD` plus a zero byte; `8..9` is unsigned big-endian format version `1`; `10..11` is profile `1`; `12..43` is a fresh 32-byte salt; `44..55` is a fresh 12-byte nonce; `56..59` is unsigned big-endian ciphertext length excluding tag. The full 60-byte header is GCM additional authenticated data. Follow it with exactly that ciphertext and a 16-byte tag, with no trailing bytes. Total maximum size is `16777216` bytes; no compression. The encrypted UTF-8 JSON payload carries schema version and snapshot timestamp.
- [x] Write tests for published HKDF vectors and a fixed independent AES-GCM fixture; verify native adapter interoperability on Android. Assert the exact header offsets/endianness, 32-byte key derivation with info `plan-bud/backup/v1`, empty/short/oversized input rejection, bad magic/version/profile/length, all header fields and ciphertext/tag tampering, wrong valid phrase, and fresh salt/nonce on repeated export. Do not claim a 256-bit entropy strength for a 128-bit mnemonic.
- [x] Run tests red; implement strict parsing, header authentication, and nonce/tag mapping without accidentally duplicating a native sealed-data nonce in the container. Never implement primitives manually. Validate structural bounds before decryption/allocation, and use one sanitized authentication-failure outcome for wrong valid keys and damaged ciphertext.
- [x] Run `pnpm test -- src/domains/backup`, then `pnpm check`. `tests/native/crypto-contract.ts` exports `runCryptoContract(): Promise<ContractReport>` using the same independent fixed fixtures and native adapters; register it with `runNativeContracts` and execute on Android. Round trips alone are insufficient; the independent fixed fixture must pass. Public vector data is never shown on recovery setup screens.

## Task 11: Deliver consistent snapshots and encrypted export

**Files:** Create `src/domains/backup/application/{snapshot,validate-snapshot,export-service,file-ports}.ts`, `infrastructure/{snapshot-repository,android-backup-files}.ts`, `presentation/backup-screen.tsx`, tests, `src/app/backup.tsx`; extend each domain's `application/public.ts` with its canonical portable model validators, and link backup settings.

**Interfaces:** `SnapshotV1` contains `{schemaVersion: 1; createdAt: string; profile: Profile; categories: readonly Category[]; plans: readonly MonthlyPlan[]; transactions: readonly Transaction[]; goals: readonly Goal[]; contributions: readonly Contribution[]; allocations: readonly GoalAllocation[]}`. Publish canonical `GoalAllocation` (`{month: MonthKey; goalId: string; amount: MinorAmount}`) from budgeting's `application/public.ts`, with its model owned by `domain/monthly-plan.ts`; do not duplicate the persisted shape. `validateSnapshot(value: unknown): Result<SnapshotV1>` composes published canonical validators and verifies relationships, uniqueness, and bounds. `SnapshotPort.readConsistent(): Promise<{snapshot: SnapshotV1; revision: number}>`. `BackupFilesPort` exposes `saveEncrypted(bytes: Uint8Array): Promise<Result<'saved'|'canceled'>>` and `pickEncrypted(): Promise<Result<Uint8Array|null>>`; document-provider references stay inside the adapter. `exportBackup(): Promise<Result<'saved'|'canceled'>>` gates export on confirmed matching profile/generation and encrypts before file I/O.

- [x] Install Expo FileSystem and DocumentPicker. Write snapshot assertions that every source record and appearance setting survives serialization, totals are excluded, and no key, recovery metadata, command cache, provider location, or workstation field is included. Concurrent writes cannot mix two revisions into one snapshot. Validate outgoing snapshots with the same canonical schema/limits as import; if a snapshot exceeds supported bounds, report the limit without deleting or truncating records, and never save an unrestorable container.
- [x] Write file-port contract tests: cancellation at selection/save, revoked grants, no reported size, false reported size, chunked/truncated read, more than `16777216` bytes, and storage-full failure. Bound actual reads even when provider metadata is absent/wrong; never call an unbounded whole-file reader before checking content size. Reject compressed/nonmatching formats rather than attempting decompression.
- [x] Run tests red; implement consistent database reads and encrypted-only saves through Android directory/document selection using SDK 58 FileSystem APIs. Import may cache ciphertext only. Write no plaintext temporary files. Clean app-owned temporary files in owning `finally` blocks; never delete a user-selected existing document on cancellation.
- [x] Implement Backup settings with readiness state, last successful export status, explicit export action, canceled versus failed feedback, and navigation to recovery setup when needed. A failed export never reports success or changes the active phrase.
- [ ] Run `pnpm test -- src/domains/backup`, then `pnpm check`. Verify Android export in airplane mode, file picker cancellation/permission failures, and an encrypted file that contains no readable financial fields or phrases.

## Task 12: Deliver validated atomic restore and crash-safe key adoption

**Files:** Create `src/domains/backup/application/restore-service.ts`, `infrastructure/restore-repository.ts`, `presentation/restore-screen.tsx`, `presentation/use-restore-flow.ts`, tests, `src/app/restore.tsx`; extend `application/validate-snapshot.ts`, recovery metadata, bootstrap, settings reset, and store refresh lifecycle.

**Interfaces:** `validateSnapshot(value: unknown): Result<SnapshotV1>` uses the published canonical validators and checks all relationships/uniqueness/ranges. `RestorePreview` is `{token: string; sourceRevision: number; createdAt: string; counts: Record<string, number>}` and contains no plaintext records or secrets. `prepareRestore(bytes: Uint8Array, words: string): Promise<Result<RestorePreview>>` owns a disposable private session. `confirmRestore(token: string): Promise<Result<{recoveryReady: boolean}>>` compares current revision, replaces records atomically, adopts the key, and refreshes the profile. `cancelRestore(token: string): void` disposes session references. Define `RestorePort` in `application/restore-service.ts`: `replace(input: {snapshot: SnapshotV1; expectedRevision: number; recovery: LocalRecoveryState}): Promise<void>`, `markRecoveryReady(ref: RecoveryRef): Promise<void>`. `replace` commits restored records and pending recovery metadata together; adoption uses Task 9's `RecoveryStorePort`. `resetProfile(): Promise<Result<void>>` requires explicit destructive confirmation and never deletes external backup files.

- [x] Write rejection tests for malformed JSON/UTF-8, future/unsupported schema, unknown currency/exponent, invalid dates, excessive string/record lengths, duplicate IDs, orphan references, overflow, inconsistent saved amounts, unexpected executable/device fields, invalid phrase, authentication failure, migration failure, cancellation, and stale tokens/revisions. None may change current records. Pin limits in the format contract and shared validators: at most 50,000 records summed across snapshot arrays, 120 code points per name, 2,000 per note, and 100 per ID. Currency/date/locale/settings fields use their canonical parsers. These limits do not permit an encrypted container above 16 MiB, and user-entered text is never executed or rewritten by artifact scanners.
- [x] Write success/rollback tests covering all snapshot fields, theme and currency restoration, source-derived totals, repeat confirmation, and failure at each database write. Restoration is replacement only. Show the counts/timestamp and destructive confirmation before any write; reauthenticate or require phrase reentry if backgrounding disposed the session.
- [x] Write process-death tests: persist a new nonsecret recovery generation/fingerprint with export status `pending` in the same database transaction as restored records; simulate restart before SecureStore write, after its write, and before marking readiness. Export stays disabled unless protected record profile/generation/fingerprint matches the committed database and readiness is complete. A retained old secret or a newly entered different valid phrase never passes this check. Recovery prompts for the matching phrase, without resetting restored financial data.
- [x] Run tests red; implement serialized destructive operations, revision-checked transaction replacement, generation-based adoption, explicit retry on SecureStore failure, and stale-preview invalidation. Only nonsecret preview/status enters stores; keep plaintext/phrase in private ephemeral sessions. Refresh/reset every scoped domain projection after commit. A failure to refresh must not undo or misreport an already committed restore.
- [x] Implement Restore and explicit clear-data flows, including Android back/cancel and secret-state cleanup. Verify a backup restores on a separate clean Android installation without original keystore state, an app PIN, an account, or network access. Wrong phrase/corrupted data leave the original database intact.
- [x] Run `pnpm test -- src/domains/backup src/composition src/domains/settings`, then `pnpm check` and native rollback/restart/restore contracts. Expected: all crash stages resume with consistent data and guarded export; no plaintext files remain.

## Task 13: Qualify and package the offline Android release

**Files:** Create `eas.json`, `.maestro/{planner,goal-shortfall,theme-and-large-text,backup-restore,restore-rejection}.yaml`, `docs/release/android-checklist.md`; extend `app.json`, `.github/workflows/ci.yml`, `README.md`, `CONTRIBUTING.md`, verification records; delete `src/app/diagnostics.tsx` and `src/composition/native-contract-screen.tsx` after native contract evidence is recorded.

**Interfaces:** `eas.json` has Android `development` and standalone `preview` profiles; `preview.android.buildType` is `apk` without a development client. A release candidate means an installable signed APK, frozen dependency evidence, native test evidence, and a path/secret-clean artifact scan, not merely a JavaScript export. Signing keys remain outside authored artifacts. No iOS/cloud publishing or store submission is authorized by this plan.

- [x] Write offline-release policy checks that fail for runtime updates, remote assets/telemetry, automatic plaintext app-data backup, test-runner/vector imports, accidental iOS/web targets, and build-path/secret leaks. Include a failing synthetic artifact and a passing release fixture; do not rewrite user-owned backup data to make scanners pass.
- [ ] Configure Android-only platform output, stable package identifier `com.planbud.app`, existing launcher assets, automatic scheme support, disabled Expo runtime updates, and Android backup exclusions through Expo app config/plugins. Record passing native contracts, then delete the temporary diagnostics route and composition screen so no release imports reach `tests/native` or public vectors. Inspect generated release manifest and data-extraction rules; verify the oldest Android version supported by SDK 58 and a current target device. Do not invent a lower minimum or hand-edit generated native files.
- [ ] Run `pnpm check`, Expo dependency checking and doctor, and `maestro test .maestro/release.yaml` against an Android development/release-like build. Validate positive and negative guardrail checks in CI. Record manual TalkBack, 200% font scaling, long lists, keyboard, both schemes, reduced motion, back navigation, storage exhaustion, capture protection, and process-death checks that automation does not prove.
- [x] Prepare the standalone APK through `pnpm dlx eas-cli build --platform android --profile preview`, or `--local` with the same profile if cloud access/account limits block the build. Use the configured project/account; do not create a paid plan or bypass signing. Build services may require connectivity; the installed app must not. If build credentials or tooling are unavailable, preserve prepared configuration and report the exact missing prerequisite rather than labeling an export as an APK.
- [x] Install the standalone APK with the development server stopped and airplane mode enabled. Execute fresh setup, budget/transaction edits, goals and shortfall adjustment, export, force-stop/restart, clean-install restore, wrong-phrase rejection, and light/dark persistence. Confirm Android cloud backup exclusion where the platform honors it; encrypted export destination behavior belongs to the chosen document provider.
- [x] Scan the APK, JavaScript bundle, delivered metadata, source maps, and portable reports for build paths, phrases, and accidental test material. Exclude private/debug source maps from delivery or regenerate them without machine paths. Record requirement-linked evidence in `docs/engineering/verification.md`, perform whole-change code review, and resolve material findings before handing over the APK. No automatic commits, pushes, or PRs.

## Requirement-to-task coverage

| Product requirements                                                                                       | Owning tasks                                             |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| PLAT-001; OFF-001, OFF-002, OFF-003, OFF-004, OFF-005                                                      | 1, 3, 4, 9, 11, 13                                       |
| BACK-001, BACK-002, BACK-003; KEY-001, KEY-002, KEY-003, KEY-004, KEY-005, KEY-006, KEY-007, KEY-008       | 9, 10, 11, 12, 13                                        |
| RESTORE-001, RESTORE-002, RESTORE-003, RESTORE-004, RESTORE-005                                            | 10, 11, 12, 13                                           |
| GOAL-001; DSS-001, DSS-002                                                                                 | 7, 8                                                     |
| DSS-003, DSS-004, DSS-005, DSS-006, DSS-007, DSS-008, DSS-009, DSS-010                                     | 5, 6, 7, 8, 12                                           |
| MONEY-001, MONEY-002, MONEY-003; DATE-001, DATE-002; DATA-001                                              | 2, 3, 5, 6, 7, 8, 12                                     |
| UI-001, UI-002, UI-003, UI-004, UI-005, UI-006, UI-007, UI-008                                             | 4, 5, 6, 7, 8, 9, 11, 12, 13                             |
| ENG-001, ENG-002, ENG-003, ENG-004, ENG-005, ENG-006, ENG-007, ENG-008, ENG-009, ENG-010, ENG-011, ENG-012 | 1 and every owning code task; release verification in 13 |

| Engineering rule groups                              | Enforcement and review ownership                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| PRINC-001 through PRINC-007; PAT-001 through PAT-005 | Architecture contracts in 1-3; per-task review and whole-change review in 13.                                      |
| LAYER-001 through LAYER-008                          | Executable alias/relative/transitive/cycle checks in 1; public ports and composition in 3-12.                      |
| FUNC-001 through FUNC-004; LANG-001 through LANG-003 | Positive/negative lint fixtures and starter migration in 1; SDK-compatible configuration retained throughout.      |
| STATE-001 through STATE-007                          | Context/store lifetime in 4; projection writes/invalidation in 5-8; secret isolation and restore resets in 9-12.   |
| ASYNC-001 through ASYNC-008                          | Type-aware checks in 1, terminal operation tests in 2, boundary error/cleanup tests in storage and recovery tasks. |
| DOC-001 through DOC-005                              | JSDoc scope fixtures in 1, meaningful contracts in each task, reviewer accuracy checks before release.             |
| REACT-001 through REACT-006                          | Hooks rules in 1, component/state/accessibility work in 4-12, native qualification in 13.                          |
| ART-001 through ART-004                              | Synthetic path-check fixtures in 1, safe snapshot schema in 11, packaged-output scanning in 13.                    |

## Planning review and execution handoff

Self-review must confirm complete requirement coverage, consistent public signatures, dependency order, focused test cycles, and tests for all five review-focus items. Mark tasks checked only after their actual implementation and verification; this document is not passing test evidence.

Planning self-review completed on 2026-10-20: all 59 product requirement IDs and all 57 engineering rule IDs map to owning tasks. The 13 task numbers, document links, portable references, and approval states passed document checks. Interface review corrected route collisions, cross-domain calculation DTOs, export/import validator ownership, and crash-safe key matching. All five review-focus conditions have explicit owning tests. Existing lint/typecheck attempts still stop before execution during package-registry access; no implementation check is marked passed.

Recommended execution is native implementation in this session, task by task, because database revisions, state projections, and recovery generation are tightly coupled contracts. Alternatively, use subagent-driven execution with explicitly owned tasks and independent reviews. The user selects the method after reviewing this plan; do not start product implementation from source-spec approval alone.

## Documentation consulted for planning

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) and [documentation index](https://docs.expo.dev/llms.txt).
- [Expo testing and SDK 58 Jest 30 requirement](https://docs.expo.dev/develop/unit-testing/).
- [React Native Paper themes](https://oss.callstack.com/react-native-paper/docs/guides/theming) and [custom fonts](https://oss.callstack.com/react-native-paper/docs/guides/fonts).
- [SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/), [Crypto](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Font](https://docs.expo.dev/versions/v58.0.0/sdk/font/), [FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/), [DocumentPicker](https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/), and [ScreenCapture](https://docs.expo.dev/versions/v58.0.0/sdk/screen-capture/).
- [Scure BIP-39](https://github.com/paulmillr/scure-bip39) and [Noble HKDF](https://github.com/paulmillr/noble-hashes): primary package documentation used because Context7 did not resolve the requested mnemonic package accurately.
- [Android APK profiles](https://docs.expo.dev/build-reference/apk/).
