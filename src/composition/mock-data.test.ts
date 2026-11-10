import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { createHostDatabase } from '../../tests/helpers/host-database';
import { bootstrap } from './bootstrap';
import { bootstrapMockData } from './mock-data';

it('loads editable sample records for the current month without touching the local database', async () => {
  const local = createDatabaseHandle(createHostDatabase());
  const preview = createDatabaseHandle(createHostDatabase());
  const month = '2026-11';
  try {
    const personal = await bootstrap(async () => local);
    const sample = await bootstrapMockData(async () => preview, `${month}-08`);
    if (!personal.ok || !sample.ok) throw new Error('Expected both app sessions to start.');

    const { budgets, transactions, goals, namedPlans } = sample.value.services;
    expect(sample.value.profile?.id).toBe('mock-profile');
    await expect(budgets.readMonth(month)).resolves.toMatchObject({
      ok: true,
      value: {
        plan: { month, limits: expect.arrayContaining([{ categoryId: 'rent', amount: 135_000 }]) },
      },
    });
    await expect(transactions.list({ month, cursor: null, limit: 10 })).resolves.toMatchObject({
      ok: true,
      value: { records: expect.arrayContaining([expect.objectContaining({ note: 'Paycheck' })]) },
    });
    await expect(goals.readGoals()).resolves.toMatchObject({
      ok: true,
      value: [expect.objectContaining({ saved: 100_000 })],
    });
    await expect(namedPlans.read()).resolves.toMatchObject({
      ok: true,
      value: { plans: [expect.objectContaining({ name: 'Weekend trip' })] },
    });
    await expect(
      transactions.remove({ operationId: 'remove-pay', input: { id: 'pay' } }),
    ).resolves.toMatchObject({ ok: true });
    await expect(personal.value.services.profiles.load()).resolves.toEqual({
      ok: true,
      value: null,
    });
    await expect(local.revision()).resolves.toBe(0);
  } finally {
    await preview.close();
    await local.close();
  }
});

it('closes a partially seeded preview when initialization fails', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  const close = jest.spyOn(database, 'close');
  await expect(bootstrapMockData(async () => database, 'invalid-date')).rejects.toThrow();
  expect(close).toHaveBeenCalledTimes(1);
});
