import { createHostDatabase } from '../../../../tests/helpers/host-database';
import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createProfileRepository } from '@/domains/settings/infrastructure/profile-repository';
import { createBudgetRepository } from '@/domains/budgeting/infrastructure/budget-repository';
import { createTransactionRepository } from './transaction-repository';
import { createTransactionService } from '../application/transaction-service';
import type { Transaction } from '../domain/transaction';
import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';

it('MONEY-001 rejects unsafe monthly inserts and date moves without changing revision or records', async () => {
  const fixture = await createTransactionFixture();
  try {
    const record: Transaction = {
      id: 'large',
      type: 'income',
      amount: Number.MAX_SAFE_INTEGER,
      date: '2026-10-20',
      categoryId: null,
      note: '',
    };
    expect(await fixture.transactions.save({ operationId: 'large', input: record })).toMatchObject({
      ok: true,
    });
    const one = { ...record, id: 'one', amount: 1, date: '2026-11-01' };
    expect(await fixture.transactions.save({ operationId: 'one', input: one })).toMatchObject({
      ok: true,
    });
    const before = await fixture.database.revision();
    for (const [operationId, input] of [
      ['overflow-insert', { ...one, id: 'extra', date: record.date }],
      ['overflow-move', { ...one, date: record.date }],
    ] satisfies readonly (readonly [string, Transaction])[]) {
      expect(await fixture.transactions.save({ operationId, input })).toMatchObject({
        ok: false,
        error: { code: 'amount-overflow' },
      });
      expect(await fixture.database.revision()).toBe(before);
    }
    expect(await fixture.transactions.summary('2026-10')).toMatchObject({
      ok: true,
      value: { income: Number.MAX_SAFE_INTEGER },
    });
    expect(await fixture.transactions.summary('2026-11')).toMatchObject({
      ok: true,
      value: { income: 1 },
    });
  } finally {
    await fixture.database.close();
  }
});

it('TXN-001 commits one idempotent record, rejects conflicts, and updates both months on a date move', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    await migrateDatabase(database);
    await createProfileRepository(database).initialize({
      id: 'personal',
      currency: { code: 'USD', exponent: 2 },
      locale: 'en-US',
      appearance: 'system',
    });
    await createBudgetRepository(database).saveCategory({
      id: 'food',
      name: 'Food',
      kind: 'essential',
      archived: false,
    });
    const service = createTransactionService(createTransactionRepository(database));
    const input: Transaction = {
      id: 'expense-one',
      type: 'expense',
      amount: 1250,
      date: '2026-10-20',
      categoryId: 'food',
      note: 'Lunch',
    };
    const before = await database.revision();
    const outcomes = await Promise.all([
      service.save({ operationId: 'create-one', input }),
      service.save({ operationId: 'create-one', input }),
    ]);
    expect(outcomes.every((result) => result.ok)).toBe(true);
    expect(await database.revision()).toBe(before + 1);
    expect(
      await service.save({ operationId: 'create-one', input: { ...input, amount: 1500 } }),
    ).toMatchObject({ ok: false, error: { code: 'command-conflict' } });
    expect(await service.summary('2026-10')).toMatchObject({
      ok: true,
      value: { income: 0, spending: 1250 },
    });
    expect(
      await service.save({
        operationId: 'move-one',
        input: { ...input, amount: 1500, date: '2026-11-01' },
      }),
    ).toMatchObject({ ok: true });
    expect(await service.summary('2026-10')).toMatchObject({ ok: true, value: { spending: 0 } });
    expect(await service.summary('2026-11')).toMatchObject({ ok: true, value: { spending: 1500 } });
    expect(
      await service.remove({ operationId: 'delete-one', input: { id: input.id } }),
    ).toMatchObject({ ok: true });
    const deleted = await database.revision();
    expect(
      await service.remove({ operationId: 'delete-one', input: { id: input.id } }),
    ).toMatchObject({ ok: true });
    expect(await database.revision()).toBe(deleted);
    expect(await service.summary('2026-11')).toMatchObject({ ok: true, value: { spending: 0 } });
  } finally {
    await database.close();
  }
});

it('TXN-002 uses stable date/ID keyset pages and excludes goal contributions from spending', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    await migrateDatabase(database);
    await createProfileRepository(database).initialize({
      id: 'personal',
      currency: { code: 'USD', exponent: 2 },
      locale: 'en-US',
      appearance: 'system',
    });
    const service = createTransactionService(createTransactionRepository(database));
    for (const id of ['a', 'b', 'c'])
      await service.save({
        operationId: `create-${id}`,
        input: { id, type: 'income', amount: 100, date: '2026-10-20', categoryId: null, note: '' },
      });
    await database.write(async (sql) => {
      await sql.execute(
        "INSERT INTO goals(id,name,target_amount,starting_saved,priority,goal_state) VALUES ('goal','Goal',10000,0,'high','active')",
      );
      await sql.execute(
        "INSERT INTO goal_contributions(id,goal_id,amount,record_date) VALUES ('contribution','goal',500,'2026-10-20')",
      );
      return { value: undefined, changed: true };
    });
    const first = await service.list({ month: '2026-10', cursor: null, limit: 2 });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Unable to read first test page.');
    expect(first.value.records.map((record) => record.id)).toEqual(['c', 'b']);
    const next = await service.list({ month: '2026-10', cursor: first.value.nextCursor, limit: 2 });
    expect(next).toMatchObject({ ok: true, value: { records: [{ id: 'a' }], nextCursor: null } });
    expect(await service.summary('2026-10')).toMatchObject({
      ok: true,
      value: { income: 300, spending: 0, byCategory: [] },
    });
  } finally {
    await database.close();
  }
});
