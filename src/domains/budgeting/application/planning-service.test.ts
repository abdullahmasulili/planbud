import { createPlanningService } from './planning-service';
import { createPlanningAdapter } from '@/composition/planning-adapter';
import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';
import type { PlanningPreview } from './planning-contract';

it('DSS-010 rejects stale previews and unsafe edits; applying allocations does not create actual savings', async () => {
  const fixture = await createTransactionFixture();
  try {
    await fixture.budgets.saveCategory({
      id: 'flex',
      name: 'Fun',
      kind: 'flexible',
      archived: false,
    });
    await fixture.budgets.savePlan({
      expectedRevision: await fixture.database.revision(),
      plan: {
        month: '2026-10',
        plannedIncome: 100000,
        limits: [
          { categoryId: 'food', amount: 60000 },
          { categoryId: 'flex', amount: 20000 },
        ],
      },
    });
    await fixture.goals.saveGoal({
      operationId: 'g',
      input: {
        id: 'g',
        name: 'Goal',
        target: 25000,
        startingSaved: 0,
        deadline: '2026-10-31',
        priority: 'high',
        desiredMonthly: null,
        state: 'active',
      },
    });
    await fixture.transactions.save({
      operationId: 'spend',
      input: {
        id: 'spend',
        type: 'expense',
        categoryId: 'flex',
        amount: 5000,
        date: '2026-10-20',
        note: '',
      },
    });
    const service = createPlanningService(createPlanningAdapter(fixture.database));
    const preview = await service.preview('2026-10');
    if (!preview.ok) throw new Error('Fixture preview failed');
    expect(preview.value).toMatchObject({
      capacity: 20000,
      allocations: [{ allocated: 20000, gap: 5000 }],
      edits: [{ categoryId: 'flex', amount: 15000 }],
    });
    expect(
      await service.apply({
        preview: preview.value,
        selectedEdits: [{ categoryId: 'food', amount: 50000 }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid-adjustment' } });
    expect(
      await service.apply({
        preview: preview.value,
        selectedEdits: [{ categoryId: 'flex', amount: 4000 }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid-adjustment' } });
    const selectedEdits = [{ categoryId: 'flex', amount: 15000 }];
    const adjusted = await service.preview('2026-10', selectedEdits);
    if (!adjusted.ok) throw new Error('Adjusted preview failed');
    expect(adjusted.value).toMatchObject({
      capacity: 25000,
      allocations: [{ allocated: 25000, gap: 0 }],
    });
    const forged: PlanningPreview = {
      ...adjusted.value,
      allocations: adjusted.value.allocations.map((item) => ({ ...item, allocated: 1 })),
    };
    expect(await service.apply({ preview: forged, selectedEdits })).toMatchObject({
      ok: false,
      error: { code: 'stale-preview' },
    });
    expect(await service.apply({ preview: adjusted.value, selectedEdits })).toMatchObject({
      ok: true,
    });
    const committed = await fixture.database.revision();
    expect(await service.apply({ preview: adjusted.value, selectedEdits })).toMatchObject({
      ok: false,
      error: { code: 'stale-data' },
    });
    expect(await fixture.database.revision()).toBe(committed);
    expect(await fixture.goals.readGoals()).toMatchObject({
      ok: true,
      value: [{ saved: 0, contributions: [] }],
    });
    expect(
      await fixture.database.read(
        async (sql) => await sql.all('SELECT amount FROM goal_allocations'),
      ),
    ).toEqual([{ amount: 25000 }]);
    const current = await service.preview('2026-10');
    if (!current.ok) throw new Error('Current preview failed');
    await fixture.goals.saveContribution({
      operationId: 'c',
      input: { id: 'c', goalId: 'g', amount: 100, date: '2026-10-20' },
    });
    expect(await service.apply({ preview: current.value, selectedEdits: [] })).toMatchObject({
      ok: false,
      error: { code: 'stale-data' },
    });
  } finally {
    await fixture.database.close();
  }
});
