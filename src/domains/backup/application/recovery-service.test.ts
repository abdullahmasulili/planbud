import { createRecoveryService } from './recovery-service';
import type { RecoveryPorts, LocalRecoveryState, RecoveryRecord } from './recovery-ports';
import {
  encodeMnemonic,
  decodeMnemonic,
  recoveryFingerprint,
} from '../infrastructure/mnemonic-codec';

/** Supplies deterministic public-vector bytes and in-memory native-port failures for lifecycle tests.
 * @returns Isolated capabilities and controls; never production entropy generation.
 */
const fixture = () => {
  const records = new Map<string, RecoveryRecord>();
  let metadata: LocalRecoveryState | null = null;
  let failWrite = false;
  let failActivate = false;
  let generation = 0;
  const ports: RecoveryPorts = {
    random: {
      /** Supplies deterministic vector-only bytes.
       * @param length Test-requested byte count.
       * @returns Zero-filled BIP-39 public-vector bytes.
       */ bytes: (length) => new Uint8Array(length),
    },
    encode: encodeMnemonic,
    decode: decodeMnemonic,
    fingerprint: recoveryFingerprint,
    /** Supplies distinct test-only recovery slot names.
     * @returns A deterministic generation ID.
     */ newGeneration: () => `generation-${++generation}`,
    metadata: {
      /** Returns the test profile and nonsecret active reference.
       * @returns Current recovery metadata.
       */ read: async () => ({ profileId: 'p', state: metadata, revision: 1 }),
      /** Activates after a secure write, or simulates an atomic failure.
       * @param input New generation activation.
       * @returns Completion or a rejected write.
       */ activate: async (input) => {
        if (failActivate) throw new Error('database unavailable');
        metadata = input.state;
      },
    },
    store: {
      /** Reads an isolated test slot.
       * @param ref Nonsecret generation reference.
       * @returns Stored vector entropy or absence.
       */ read: async (ref) => records.get(ref.generation) ?? null,
      /** Saves one isolated slot or simulates native failure.
       * @param record Vector entropy and slot identity.
       * @returns Completion or rejected secure write.
       */ write: async (record) => {
        if (failWrite) throw new Error('keystore unavailable');
        records.set(record.generation, { ...record, entropy: record.entropy.slice() });
      },
      /** Removes one isolated slot.
       * @param ref Nonsecret generation identity.
       * @returns Completion.
       */ remove: async (ref) => {
        records.delete(ref.generation);
      },
    },
  };
  return {
    ports,
    records,
    /** Fails or permits secure writes.
     * @param value Failure control.
     */ setWriteFailure: (value: boolean) => {
      failWrite = value;
    },
    /** Fails or permits active-reference writes.
     * @param value Failure control.
     */ setActivationFailure: (value: boolean) => {
      failActivate = value;
    },
  };
};

it('KEY-002 requires all three distinct positions and explicit file/phrase acknowledgment before persistence', async () => {
  const test = fixture();
  const service = createRecoveryService(test.ports);
  const result = await service.create(false);
  if (!result.ok) throw new Error('Vector setup failed');
  const session = result.value;
  expect(new Set(session.positions).size).toBe(3);
  expect(test.records.size).toBe(0);
  const words = session.words().split(' ');
  const answers = session.positions.map((position) => ({
    position,
    word: words[position - 1] ?? '',
  }));
  expect(await session.confirm(answers.slice(0, 2), true)).toMatchObject({ ok: false });
  expect(await session.confirm(answers, false)).toMatchObject({ ok: false });
  expect(await session.confirm(answers, true)).toMatchObject({ ok: true });
  expect(await service.status()).toMatchObject({ ok: true, value: 'ready' });
  session.dispose();
  expect(session.words()).toBe('');
  expect(await session.confirm(answers, true)).toMatchObject({ ok: false });
});

it('KEY-007 refuses silent replacement; failures and cancellation preserve the previous active secret', async () => {
  const test = fixture();
  const service = createRecoveryService(test.ports);
  const first = await service.create(false);
  if (!first.ok) throw new Error('Vector setup failed');
  const firstWords = first.value.words().split(' ');
  await first.value.confirm(
    first.value.positions.map((position) => ({ position, word: firstWords[position - 1] ?? '' })),
    true,
  );
  expect(await service.create(false)).toMatchObject({ ok: false });
  const replacement = await service.create(true);
  if (!replacement.ok) throw new Error('Replacement setup failed');
  const words = replacement.value.words().split(' ');
  const answers = replacement.value.positions.map((position) => ({
    position,
    word: words[position - 1] ?? '',
  }));
  test.setWriteFailure(true);
  expect(await replacement.value.confirm(answers, true)).toMatchObject({ ok: false });
  expect(await service.status()).toMatchObject({ ok: true, value: 'ready' });
  test.setWriteFailure(false);
  test.setActivationFailure(true);
  expect(await replacement.value.confirm(answers, true)).toMatchObject({ ok: false });
  expect(test.records.size).toBe(1);
  replacement.value.dispose();
  test.setActivationFailure(false);
  const reveal = await service.reveal();
  if (!reveal.ok) throw new Error('Reveal failed');
  expect(reveal.value.words().split(' ')).toHaveLength(12);
  reveal.value.dispose();
  expect(reveal.value.words()).toBe('');
  test.records.clear();
  expect(await service.status()).toMatchObject({ ok: true, value: 'missing-secret' });
  expect(await service.reveal()).toMatchObject({ ok: false });
});

it('KEY-001 stops when native randomness fails and never falls back to a predictable generator', async () => {
  const test = fixture();
  const service = createRecoveryService({
    ...test.ports,
    random: {
      /** Simulates native CSPRNG failure.
       * @returns Never succeeds.
       */ bytes: () => {
        throw new Error('unavailable');
      },
    },
  });
  expect(await service.create(false)).toMatchObject({ ok: false });
  expect(test.records.size).toBe(0);
});
