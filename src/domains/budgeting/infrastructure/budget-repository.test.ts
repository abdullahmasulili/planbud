import { createHostDatabase } from '../../../../tests/helpers/host-database';
import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createProfileRepository } from '@/domains/settings/infrastructure/profile-repository';
import { createBudgetRepository } from './budget-repository';
import { createBudgetService } from '../application/budget-service';

it('BUD-001 keeps months independent, checks revisions, and rolls back missing references', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    await migrateDatabase(database);
    await createProfileRepository(database).initialize({
      id: 'personal',
      currency: { code: 'USD', exponent: 2 },
      locale: 'en-US',
      appearance: 'system',
    });
    const service = createBudgetService(createBudgetRepository(database));
    await service.saveCategory({ id: 'food', name: 'Food', kind: 'essential', archived: false });
    const before = await database.revision();
    const october = {
      month: '2026-10',
      plannedIncome: 100000,
      limits: [{ categoryId: 'food', amount: 60000 }],
    };
    expect(await service.savePlan({ plan: october, expectedRevision: before })).toMatchObject({
      ok: true,
      value: { plan: october, revision: before + 1 },
    });
    expect(
      await service.savePlan({
        plan: { ...october, plannedIncome: 200000 },
        expectedRevision: before,
      }),
    ).toMatchObject({ ok: false, error: { code: 'stale-data' } });
    const after = await database.revision();
    expect(
      await service.savePlan({
        plan: { ...october, limits: [{ categoryId: 'missing', amount: 0 }] },
        expectedRevision: after,
      }),
    ).toMatchObject({ ok: false });
    expect(await database.revision()).toBe(after);
    expect(await service.readMonth('2026-10')).toMatchObject({
      ok: true,
      value: { plan: october },
    });
    expect(await service.readMonth('2026-11')).toMatchObject({
      ok: true,
      value: { plan: { month: '2026-11', plannedIncome: 0, limits: [] } },
    });
    expect(
      await service.savePlan({
        plan: { ...october, month: '2026-11', plannedIncome: 200000 },
        expectedRevision: after,
      }),
    ).toMatchObject({ ok: true });
    expect(await service.readMonth('2026-10')).toMatchObject({
      ok: true,
      value: { plan: october },
    });
    await service.saveCategory({ id: 'food', name: 'Food', kind: 'essential', archived: true });
    expect(await service.readCategories()).toMatchObject({
      ok: true,
      value: [{ id: 'food', archived: true }],
    });
    expect(await service.readMonth('2026-10')).toMatchObject({
      ok: true,
      value: { plan: october },
    });
  } finally {
    await database.close();
  }
});
