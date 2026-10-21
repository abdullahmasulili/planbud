# Architecture

Status: application implemented; Android release qualification is in progress. Native acceptance is recorded separately in [verification](engineering/verification.md).

Domain folders own business policies, application ports, infrastructure adapters, and presentation. Composition alone wires concrete adapters to services. SQLite is durable truth; presentation stores hold replaceable projections. Shared money uses safe integer minor units and bundled ISO currency exponents. Calendar dates are Gregorian strings without time-zone conversion.

## Database lifecycle

A private SQLite connection enables foreign keys, WAL, and a busy timeout before migration. A FIFO queue serializes every read, schema operation, write, and close. Each operation runs in `BEGIN IMMEDIATE` on that same connection. Expo's separate exclusive-transaction connection was rejected because connection-local foreign-key configuration must remain explicit. Repositories must not retain the scoped SQL executor or use it after its transaction. Application ports expose neither SQL nor native handles.

A changed write advances the safe integer revision once inside its transaction. No-op retries and rollbacks leave revision unchanged. Consistent reads obtain records and revision together. Repositories must call transaction-scoped revision reads rather than reenter the database handle. Schema migrations commit atomically and reject newer versions without resetting user data.

Each queued write captures a private connection session before joining the FIFO. Replacement and reset advance that session only after a successful commit, before releasing the next waiter. Writes captured against the previous dataset fail before executing source work. A rolled-back replacement preserves the session, so valid queued edits remain usable. Protected-key readiness writes capture the new session after replacement.

The singleton profile confirms currency before entry; later settings can change appearance but cannot relabel monetary data. Foreign keys restrict deletion of referenced categories and goals. Idempotency commands belong to the local database and are excluded from portable snapshots.

## Verification boundaries

Colocated test files are composition roots and may import host adapters. Production modules cannot import tests. This narrow exception does not relax syntax, async, or documentation rules. Host contracts use actual SQLite through Node's experimental test-host API; they do not establish native Android behavior. Development diagnostics run the same portable assertions with Expo SQLite in a disposable database. Release composition must exclude diagnostics.

## Secret sessions and replacement

Recovery secrets remain in generation-specific Android protected storage. Only a nonsecret profile/generation/fingerprint/status binding enters SQLite. Private recovery/restore closures own short-lived entropy and phrase references; views dispose them on background and navigation. Keyed capture protection is acquired before secret exposure. JavaScript memory erasure cannot be guaranteed.

Restore validates a complete authenticated snapshot before a counts-only preview. A reviewed revision guards replacement. The source records and pending key binding commit in one SQLite transaction; the protected secret is then adopted separately. An adoption failure preserves restored source data and blocks export. Only the original matching phrase can finish pending recovery. Committed profile notifications reset all scoped projections and remount retained forms so a restored currency cannot relabel an old draft.

The Expo config plugin is the sole owner of generated Android backup exclusions and release-only network permission removal. Debug tooling retains local development connectivity. The exact `plugins/with-offline-android.cjs` entry uses CommonJS because Expo's plugin resolver requires that module contract; arrow, documentation and async rules still apply. `jest.config.cjs` is the other narrow external-tool CommonJS entry.
