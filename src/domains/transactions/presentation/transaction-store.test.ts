import { createTransactionStore } from './transaction-store';
import { createTransactionService } from '../application/transaction-service';
import type { Transaction } from '../application/public';

it('STATE-003 keeps editable history available when only aggregate totals fail', async () => {
  const record: Transaction = {
    id: 'entry',
    type: 'income',
    amount: 100,
    date: '2026-10-20',
    categoryId: null,
    note: '',
  };
  const service = createTransactionService({
    /** Returns the saved fixture. @param command Source mutation. @returns Source record. */
    save: async (command) => command.input,
    /** Completes the unused deletion boundary. */ remove: async () => {},
    /** Returns independently readable correction history. @returns One source record. */
    list: async () => ({ records: [record], nextCursor: 'next-page' }),
    /** Models an unavailable aggregate without losing its underlying source. */
    summary: async () => {
      throw new Error('Totals unavailable.');
    },
  });
  const store = createTransactionStore(service);
  await store.getState().loadMonth('2026-10');
  expect(store.getState()).toMatchObject({
    records: [record],
    summary: null,
    nextCursor: 'next-page',
    status: 'stale',
  });
});

it('STATE-003 distinguishes a committed transaction from a failed projection refresh', async () => {
  let failRead = false;
  const records: Transaction[] = [];
  const service = createTransactionService({
    /** Records the committed test entry before simulating a failed subsequent read.
     * @param command Validated test mutation.
     * @returns Committed entry even when later reads fail.
     */
    save: async (command) => {
      records.push(command.input);
      failRead = true;
      return command.input;
    },
    /** Completes the unused deletion operation. */
    remove: async () => {},
    /** Supplies initial empty history and later exposes the simulated refresh failure.
     * @returns The current test source projection or a rejected read.
     */
    list: async () => {
      if (failRead) throw new Error('Simulated read failure.');
      return { records: [...records], nextCursor: null };
    },
    /** Supplies stable actual totals for this refresh-outcome test.
     * @returns Zero initial actual activity.
     */
    summary: async () => ({ income: 0, spending: 0, byCategory: [] }),
  });
  const store = createTransactionStore(service);
  await store.getState().loadMonth('2026-10');
  const result = await store.getState().save({
    operationId: 'create-income',
    input: {
      id: 'income',
      type: 'income',
      amount: 100,
      date: '2026-10-20',
      categoryId: null,
      note: '',
    },
  });
  expect(result.ok).toBe(true);
  expect(records).toHaveLength(1);
  expect(store.getState().status).toBe('stale');
  expect(store.getState().message).toContain('Saved');
  store.getState().reset();
  expect(store.getState().records).toEqual([]);
  expect(store.getState().summary).toBeNull();
});
