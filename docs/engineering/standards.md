# Engineering standards

Status: Approved by the user on 2026-10-20. Required conventions for in-session implementation. Foundation enforcement tools and CI configuration are implemented; executed checks and remaining native/release acceptance are tracked in [verification](verification.md). Remote required-check settings have not been configured.

This document owns coding conventions and architecture boundaries. The [product specification](../specs/001-budget-planner/spec.md) owns product behavior. Tool examples from external documentation do not override these project rules.

## Principles and patterns

| ID        | Principle             | Application                                                                                                                                                                                          |
| --------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRINC-001 | DRY                   | Give each business rule, validation contract, and persisted value one authoritative owner. Extract shared code when behavior is truly shared; similar-looking screens alone do not justify coupling. |
| PRINC-002 | KISS                  | Implement the simplest behavior satisfying the specification. Avoid speculative extension points, generic frameworks, unnecessary wrappers, and unused interfaces.                                   |
| PRINC-003 | Single responsibility | Each module has one cohesive reason to change. Separate rendering, workflows, financial calculations, and storage.                                                                                   |
| PRINC-004 | Open/closed           | Where a real variation exists, add a policy or adapter behind a stable contract instead of spreading conditionals through consumers. Do not create extension mechanisms without a current need.      |
| PRINC-005 | Liskov substitution   | Implementations of a port must preserve its input, output, error, atomicity, and lifecycle guarantees. Use shared contract tests for interchangeable implementations.                                |
| PRINC-006 | Interface segregation | Define small consumer-owned ports. A goal calculator must not depend on a repository exposing unrelated backup or settings operations.                                                               |
| PRINC-007 | Dependency inversion  | Domain and application code depend on contracts they own. Composition supplies concrete storage and platform adapters.                                                                               |

- PAT-001: Use ports and adapters with functional use cases. Repository ports belong to application code; database repositories implement them in infrastructure. Avoid repositories that only rename every database method without creating a useful boundary.
- PAT-002: Use pure policy functions for decision-support calculations. Inject date, identifier, randomness, or storage capabilities where the caller needs deterministic tests or an external capability.
- PAT-003: Use factory functions and closures for composition and dependency injection. SOLID does not require class hierarchies or inheritance.
- PAT-004: Keep view logic in presentation hooks and selectors. Store actions coordinate use cases and expose state; they do not own financial algorithms or database queries.
- PAT-005: Introduce additional patterns only when they solve a current problem. Record significant choices and rejected trade-offs in decision records.

## Domain directory grouping and layer boundaries

Application code follows this repository-relative structure. Create a layer only when it owns implemented behavior:

```text
src/
  app/                         # Expo Router routes and composition entry points
  composition/                 # Factories, adapter wiring, stable providers
  domains/
    budgeting/
      domain/
      application/
      infrastructure/
      presentation/
    transactions/              # Same layers, created only when needed
    goals/
    backup/
    settings/
  shared/
    domain/                    # Money and calendar-date primitives
    infrastructure/            # Database connection and migration support
    presentation/              # Material UI components and theme tokens
```

- LAYER-001: Group business functionality under its domain. Do not create empty layer directories for symmetry.
- LAYER-002: Domain code imports only its own pure modules and pure shared domain primitives. No React, React Native, Zustand, Expo, filesystem, database, or application imports.
- LAYER-003: Application code imports its own domain, shared domain primitives, and explicitly published pure application contracts. It defines the ports required by its use cases and does not import presentation or infrastructure.
- LAYER-004: Infrastructure implements application ports and may import the relevant domain. Presentation consumes application contracts/use cases and its own presentation state. It never imports concrete database, filesystem, key-storage, or cryptographic adapters.
- LAYER-005: Composition is the place that imports concrete implementations and wires them to consumers. Route files remain thin and may mount composition providers and domain screens; do not place non-route helpers under the route directory.
- LAYER-006: Cross-domain use cases communicate through explicit public application contracts. Never reach into another domain's presentation or infrastructure internals. Keep the cross-domain dependency graph acyclic; let composition inject contracts where needed.
- LAYER-007: Shared domain code does not import a business domain. Shared infrastructure may depend on shared domain contracts but not business-domain internals. Shared presentation does not import infrastructure or business-domain internals.
- LAYER-008: Validate import direction and public entry points with AST-aware checks that resolve aliases and relative imports. Also detect forbidden transitive dependencies and cycles. A folder name or barrel export alone does not enforce a boundary.

## Function syntax and ES6+

- FUNC-001: Interpret strict anonymous-function usage as arrow-function expressions. Assign reusable functions, components, custom hooks, factories, and selectors to descriptive `const` bindings. An inferred runtime name from a binding is permitted and helps debugging; a separate named function expression is not permitted.
- FUNC-002: Forbid authored function declarations, named and anonymous `function` expressions, generator functions, and object method shorthand implementations. Object callbacks and function-valued properties use arrow expressions. Type-level callable signatures are allowed because they are contracts, not implementations.
- FUNC-003: Export a component binding separately when a default export is required by routing. Do not use an anonymous default-exported component or declare component types inside another component's render.
- FUNC-004: Use function components and Hooks exclusively. No authored class components, `React.Component` / `PureComponent` subclasses, or `createReactClass`. Do not add a custom class-based error boundary; evaluate a compatible existing router boundary API during planning.
- LANG-001: Use strict TypeScript with modern ES6+ modules, `const` by default, justified `let`, arrow functions, destructuring, and immutable updates. Forbid `var` and CommonJS in app-owned source. Keep Expo's compatible compilation configuration; ES6+ is a source convention, not an instruction to force the compiler target to ES2015.
- LANG-002: Treat external input as `unknown` and narrow it. Avoid explicit `any`, unchecked assertions, non-null assertions, and suppression comments that bypass contracts. Derive types from canonical models rather than maintaining duplicate shapes.
- LANG-003: Apply rules to authored app code, tests, and scripts. Generated files and dependencies are excluded. A required tooling format or external contract that cannot follow a rule needs a narrow documented exception and a scoped checker override; never silently relax the project-wide policy.

The exact-version Expo crypto patch documented in `patches/README.md` preserves upstream Kotlin syntax and changes one native output conversion. Its upstream class context is dependency code, not an exception for authored application classes. Native vector acceptance and frozen patch installation are required for upgrades.

## Zustand and Context API

- STATE-001: Zustand owns reactive state shared by presentation consumers: loaded record projections, query status, selected month, filters, and current planning previews. Subscribe to focused selectors rather than entire stores.
- STATE-002: React Context API provides stable service dependencies and scoped vanilla Zustand store instances. Construct each provided instance once per intended provider lifetime. Context is not a second copy of financial records or a high-frequency broadcast store.
- STATE-003: SQLite remains the durable source of financial truth. Zustand may hold replaceable projections, invalidated or refreshed after successful writes and restore. Do not also persist these records through Zustand persistence, AsyncStorage, or Context.
- STATE-004: Keep short-lived field input, focus, and open/closed UI state local when there is one owner. Do not move all state into a global store merely because Zustand is available. Persist settings through their application use cases and load them into presentation state.
- STATE-005: Expose immutable updates, typed actions, and stable selectors. Prefer primitive or stable-reference selections; use a supported shallow selector when combining values would otherwise create a fresh reference on every read.
- STATE-006: Custom Context consumers fail clearly outside the required provider. Provider values and stores have explicit initialization, reset, and teardown behavior so tests and restored profiles do not share stale module-level state.
- STATE-007: Never put recovery phrases, key material, or decrypted backup contents into Zustand, developer-tools middleware, Context values, or persisted UI state. Keep secret handling in the backup workflow with a short-lived reveal/input view.

## Promise and error-handling conventions

- ASYNC-001: Use `async` arrow functions and `await` for authored asynchronous workflows. Use `for await` when consuming an asynchronous iterable. Await dependent operations in order and return the workflow's result. Do not replace clear sequential code with `.then()` / `.catch()` / `.finally()` chains.
- ASYNC-002: Restrict promise-chain methods to narrow integration boundaries where a callback contract or terminal rejection observer requires them. Each exception must name the external contract or observation requirement, live in a focused adapter or operation-launch helper, and have a scoped checker allowance. Do not use exceptions to reintroduce chains in screens, stores, or ordinary use cases. Type-aware checks distinguish Promise methods from unrelated methods with the same name.
- ASYNC-003: No floating promises, async callbacks passed to `forEach`, async Promise executors, or `void` used to hide rejection. Use `Promise.all` or `allSettled` only for independent operations, with an explicit policy for failure and partial results. Every rejected outcome from `allSettled` must be inspected.
- ASYNC-004: Encapsulate `try` / `catch` at boundaries that can translate an external failure, recover, roll back, or present the final error. Infrastructure adapters translate platform failures to their documented port contract; application boundaries translate expected failures to typed outcomes; terminal presentation operations handle remaining failures and expose sanitized UI state. Extract repeated handling into focused helpers without creating a generic wrapper around every function. Pure calculations and pass-through functions must not add redundant catches.
- ASYNC-005: Treat caught errors as `unknown`. Narrow and translate them at the correct boundary; preserve useful causes internally without exposing financial records, recovery material, or machine paths to the UI or delivered reports.
- ASYNC-006: Use `try` / `finally` for necessary resource cleanup at the owning boundary. Preserve the primary failure if cleanup also fails and handle the secondary failure explicitly. Do not swallow errors, log and return success, silently return `undefined` on failure, or erase useful causes. Catch synchronous parsing/native failures at the same responsible boundary rather than scattering handlers through consumers.
- ASYNC-007: An Effect callback remains synchronous and returns cleanup. It starts an `async` operation through a documented launcher that owns terminal rejection handling; apply the same rule to native event callbacks whose caller does not await returned promises. Cancel or ignore stale completions on cleanup and prevent state writes after teardown or when a newer request supersedes the operation. The launcher's callbacks and cleanup must also have observed failure paths.
- ASYNC-008: Test callbacks await asynchronous operations and assertions or return their promise to the runner. For rejection assertions, the runner is the terminal rejection handler; do not attach a catch that accidentally converts a failed assertion into a passing test. Verify translation, propagation, cleanup, and cancellation with behavior tests.

## JSDoc contracts

- DOC-001: Require JSDoc immediately above every authored module-level callable binding, component, custom hook, factory, selector, and object-property function used as a public action or port implementation. Document exported domain types and dependency ports as contracts.
- DOC-002: Describe purpose and meaningful behavior: units, rounding, input constraints, side effects, rejection conditions, and lifecycle where relevant. Include `@param` and `@returns` for applicable callables and `@throws` for synchronous exceptions. Describe rejected promises explicitly; a rejection is not a synchronous throw. Use `@example` where a calculation or security-sensitive format needs clarification.
- DOC-003: TypeScript owns type declarations. Do not duplicate type expressions in JSDoc or fill comments with restatements of names. Meaningful contract documentation is required even when lint can only prove a comment exists.
- DOC-004: Short inline arrows used only as JSX handlers, promise callbacks, selectors within a call, array callbacks, or test callbacks are covered by the enclosing documented operation. Extract complex or reusable callbacks to documented `const` bindings rather than adding repetitive JSDoc to every closure.
- DOC-005: Enforce coverage and tag consistency statically. Reviewers check accuracy against implementation and tests, especially financial and backup invariants. A change to behavior requires updating its contract documentation.

## React and React Native practices

- REACT-001: Keep rendering pure and props/state immutable. Follow the installed React Hooks lint rules, including hook placement and dependency correctness. Never suppress a dependency warning to hide a stale closure.
- REACT-002: Derive computed values from existing data instead of storing a second copy or synchronizing it with an Effect. Use Effects to synchronize external resources, not to orchestrate ordinary user actions or business rules.
- REACT-003: Use stable record IDs for list keys. Use a virtualized native list for unbounded transaction history. Avoid large mapped arrays inside a ScrollView and avoid nested competing scroll owners.
- REACT-004: Measure before adding memoization. Respect the project's React Compiler configuration; do not add `memo`, `useMemo`, or `useCallback` everywhere as a convention. Stabilize identities where required by a contract or supported by observed rendering cost.
- REACT-005: Use React Native primitives and shared Material wrappers. Keep styles and state colors token-based, preserve font scaling, provide semantic accessibility labels/states, and handle Android insets, back navigation, keyboard visibility, and touch targets.
- REACT-006: Test affected behavior in Android, including dark and light appearance, large text, TalkBack, empty/error states, long lists, and force-stop/restart. Static typing or a browser preview alone does not prove native behavior.

## Portable artifacts

- ART-001: Authored documentation, examples, specifications, decision records, generated reports, fixtures, and delivered build metadata must not contain machine-specific absolute filesystem paths or file URIs. Use repository-relative references, import aliases, portable placeholders, and public source URLs.
- ART-002: Do not embed developer usernames, home directories, workstation-specific build paths, or selected Android document-provider locations in exports. A backup stores product data and portable schema metadata only.
- ART-003: Sanitize diagnostics before saving reports. Scan source maps, packaged metadata, and release outputs for leaked build paths; strip or regenerate offending metadata without hiding application failures. Private execution-tool arguments may resolve files locally, but do not copy those resolved paths into authored or delivered artifacts.
- ART-004: The artifact check must cover both newly authored sources and deliverables, without rewriting user-supplied data. Use synthetic path samples in temporary checker tests; do not commit real workstation paths as fixtures.

## Enforcement and evidence

The checks below are required foundation work, not tools already installed by this documentation change.

| Requirement                                | Planned enforcement                                                                                                                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Function syntax, no class components, ES6+ | AST-aware ESLint rules for arrow function definitions and callbacks, prohibited declarations/expressions/class components, modern module syntax, and variable declarations.                                                                           |
| Async/await and encapsulated errors        | Prefer async/await; type-aware restrictions on promise-chain methods with exact adapter/launcher allowances; floating-promise and misused-promise checks; reviewed catch ownership and tests for propagation, translation, cleanup, and cancellation. |
| JSDoc                                      | TypeScript-aware JSDoc coverage/tag checks with exact scopes for callable bindings, object properties, inline callbacks, and generated files.                                                                                                         |
| Layer and domain boundaries                | Resolved-import restrictions, public-contract allowlists, transitive graph checks, and cycle detection.                                                                                                                                               |
| Zustand / Context ownership                | Code review and targeted tests for provider isolation, stable selectors, write/invalidation flow, and restored-profile reset.                                                                                                                         |
| DRY, KISS, SOLID, patterns                 | Reviewer checklist grounded in changed code and contract tests; no claim that a generic complexity score proves these principles.                                                                                                                     |
| Portable artifacts                         | Repository text/path checks and release-output/source-map scans.                                                                                                                                                                                      |
| Product acceptance                         | Requirement-linked domain, integration, component, and Android interaction tests.                                                                                                                                                                     |

Verify each new checker with a passing example and an intentionally failing example so a configured rule cannot silently do nothing. A dependency or framework contract must not be exempted by weakening unrelated checks. Migrate the Expo starter during approved foundation implementation, then run the full configured checks in CI and report actual results.

## Documentation consulted

- [Zustand scoped stores with Context](https://zustand.docs.pmnd.rs/hooks/use-store)
- [Zustand v5 stable selector outputs](https://zustand.docs.pmnd.rs/migrations/migrating-to-v5)
- [React component and Hook purity](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
- [React Effects](https://react.dev/learn/you-might-not-need-an-effect)
- [React Native list rendering](https://reactnative.dev/docs/using-a-listview)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
