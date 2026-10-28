# Budget cards and named plans implementation plan

**Goal:** Add financial cards, bar charts, gauges, and multiple independent planning estimates; open a PR against `dev`.

**Scope:** User confirmed separate estimates on 2026-10-27. Keep monthly transactions and goal calculations independent. Follow PLAN-001–003 and UI-009–010 in the specification and the existing Android Material design.

**Architecture:** Budgeting owns named-plan validation, application ports, SQLite repository, and scoped Zustand projections. Shared presentation owns accessible chart primitives; existing theme tokens own colors and type. Backup snapshot version 2 includes named plans while retaining version-1 import. No new dependencies.

## Sequence and verification

1. Add failing named-plan validation, independent-save/stale-revision, schema-upgrade, and backup round-trip tests. Implement bounded safe-integer models and revision-checked atomic storage. Verify with host SQLite integration tests.
2. Add failing chart accessibility/zero/overshoot and named-plan interaction tests. Implement shared cards/charts, overview and goal cards, and the named-plan list/editor reached from Plan. Preserve local drafts and explicit discard/deletion confirmations.
3. Run formatting, lint, typecheck, layer/artifact/release checks and the full suite. Bundle Android and exercise changed flows on an available Android target; record actual evidence and limitations.
4. Review the complete diff, commit the authorized change, check GitHub identity immediately before each write, push the feature branch, and create/attach a PR targeting `dev`.

## Review focus

- Zero limits with actual spending show a missing-limit state, never NaN or a false zero percentage.
- Overallocated plans retain the exact deficit; graphical fill alone is clamped.
- Named-plan mutations do not change monthly estimates or actuals; stale saves/deletes preserve current records.
- Old backups import without named plans; new backups preserve every estimate and clear old named plans on replacement/reset.
- Long names and large text wrap; modal forms keep actions reachable with the keyboard open.
