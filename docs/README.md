# Project documentation

The Android application implements the approved specification and engineering standards. Release qualification and checks actually executed are recorded separately from source implementation.

- [Budget planner product and engineering specification](specs/001-budget-planner/spec.md): confirmed requirements, proposed MVP behavior, offline decision support, 12-word encrypted backup recovery, UI direction, and engineering guardrails.
- [Engineering standards](engineering/standards.md): required DRY, KISS, SOLID, functional patterns, layer boundaries, Zustand and Context responsibilities, arrow functions, async/await, JSDoc and portable artifacts.
- [Implementation plan](superpowers/plans/2026-10-20-budget-planner.md): approved 13-task sequence and requirement coverage. An unchecked acceptance item remains unverified.
- [Architecture](architecture.md): source ownership, durable storage, financial projections and secret lifecycle.
- [Backup format](security/backup-format-v1.md): authenticated container layout, limits and recovery contract.
- [Verification](engineering/verification.md): executed checks and remaining release acceptance.
- [Additional Android qualification](engineering/android-qualification.md): Samsung, API 24, accessibility and bounded stress evidence.

Feature changes start with specification requirement IDs and provide verification evidence.
