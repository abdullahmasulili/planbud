import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';
import { createSnapshotRepository } from './snapshot-repository';

it('BACK-001 reads one consistent portable revision and excludes recovery metadata and command logs', async () => {
  const fixture = await createTransactionFixture();
  try {
    await fixture.budgets.savePlan({
      expectedRevision: await fixture.database.revision(),
      plan: {
        month: '2026-10',
        plannedIncome: 10000,
        limits: [{ categoryId: 'food', amount: 1000 }],
      },
    });
    const service = createSnapshotRepository(fixture.database, () => '2026-10-20T00:00:00.000Z');
    const [read] = await Promise.all([
      service.readConsistent(),
      fixture.transactions.save({
        operationId: 'new',
        input: {
          id: 't',
          type: 'income',
          amount: 5000,
          categoryId: null,
          note: '',
          date: '2026-10-20',
        },
      }),
    ]);
    expect(read.snapshot.transactions).toEqual([]);
    expect(read.revision).toBeLessThan(await fixture.database.revision());
    const current = await service.readConsistent();
    expect(current.snapshot.transactions).toMatchObject([{ id: 't', amount: 5000 }]);
    expect(Object.keys(current.snapshot).sort()).toEqual(
      [
        'schemaVersion',
        'createdAt',
        'profile',
        'categories',
        'plans',
        'transactions',
        'goals',
        'contributions',
        'allocations',
      ].sort(),
    );
    expect(JSON.stringify(current.snapshot)).not.toMatch(
      /recovery|operationId|input_json|revision|savedTotal/,
    );
  } finally {
    await fixture.database.close();
  }
});
