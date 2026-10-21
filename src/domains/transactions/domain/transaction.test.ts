import { parseTransaction } from './transaction';
import { summarizeTransactions } from './summary';

const expense = {
  id: 'expense-one',
  type: 'expense',
  amount: 1250,
  date: '2026-10-20',
  categoryId: 'food',
  note: '',
};
it('TXN-001 validates positive amounts, dates, and the income/category relationship', () => {
  expect(parseTransaction(expense).ok).toBe(true);
  for (const input of [
    { ...expense, amount: 0 },
    { ...expense, amount: -1 },
    { ...expense, amount: Number.MAX_SAFE_INTEGER + 1 },
    { ...expense, date: '2026-02-30' },
    { ...expense, categoryId: null },
    { ...expense, note: 'x'.repeat(2001) },
    { ...expense, type: 'income' },
  ])
    expect(parseTransaction(input).ok).toBe(false);
  expect(parseTransaction({ ...expense, type: 'income', categoryId: null }).ok).toBe(true);
});
it('MONEY-003 derives exact totals from records and rejects unsafe aggregate arithmetic', () => {
  const parsed = parseTransaction(expense);
  if (!parsed.ok) throw new Error('Invalid test expense.');
  expect(
    summarizeTransactions([
      parsed.value,
      { ...parsed.value, id: 'income', type: 'income', amount: 100000, categoryId: null },
    ]),
  ).toEqual({
    ok: true,
    value: { income: 100000, spending: 1250, byCategory: [{ categoryId: 'food', amount: 1250 }] },
  });
  expect(
    summarizeTransactions([{ ...parsed.value, amount: Number.MAX_SAFE_INTEGER }, parsed.value]).ok,
  ).toBe(false);
});
