import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { EffectCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';
import { createTransactionStore } from './transaction-store';
import { TransactionsScreen } from './transactions-screen';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
let focus: EffectCallback | undefined;
let blur: (() => void) | undefined;
/** Models a retained tab's initial focus, blur and return without unmounting its history state.
 * @param effect Screen focus synchronization under test.
 * @returns Effect registration and final cleanup.
 */
const useTestFocus = (effect: EffectCallback) =>
  useEffect(() => {
    focus = effect;
    const cleanup = effect();
    blur = typeof cleanup === 'function' ? cleanup : undefined;
    return () => {
      if (typeof cleanup === 'function') cleanup();
      focus = undefined;
      blur = undefined;
    };
  }, [effect]);
beforeEach(() => {
  jest.mocked(useFocusEffect).mockImplementation(useTestFocus);
});

it('TXN-002 filters loaded entries without mutating records and distinguishes empty months', async () => {
  const fixture = await createTransactionFixture();
  try {
    await fixture.transactions.save({
      operationId: 'create-expense',
      input: {
        id: 'expense',
        type: 'expense',
        amount: 1250,
        date: '2026-10-20',
        categoryId: 'food',
        note: '',
      },
    });
    const store = createTransactionStore(fixture.transactions);
    const view = await render(
      <TestScreen>
        <TransactionsScreen
          profile={fixture.profile}
          store={store}
          loadCategories={fixture.budgets.readCategories}
          initialMonth="2026-10"
          today="2026-10-20"
          newId={() => 'unused'}
        />
      </TestScreen>,
    );
    await waitFor(() => expect(store.getState().status).toBe('ready'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Income' }));
    expect(
      screen.getByText('No income in the loaded entries. Load more or change the filter.'),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('History month'), '2026-11');
    await fireEvent.press(screen.getByRole('button', { name: 'Open month' }));
    await waitFor(() => expect(store.getState().month).toBe('2026-11'));
    await waitFor(() => expect(store.getState().status).toBe('ready'));
    expect(
      screen.getByText('No transactions for this month. Add an income or expense to begin.'),
    ).toBeOnTheScreen();
    expect(await fixture.transactions.summary('2026-10')).toMatchObject({
      ok: true,
      value: { spending: 1250 },
    });
    await view.unmount();
  } finally {
    await fixture.database.close();
  }
}, 30000);

it('TXN-002 refreshes new categories on tab return while retaining the selected month and filter', async () => {
  const fixture = await createTransactionFixture();
  try {
    await fixture.budgets.saveCategory({
      id: 'food',
      name: 'Food',
      kind: 'essential',
      archived: true,
    });
    const store = createTransactionStore(fixture.transactions);
    const view = await render(
      <TestScreen>
        <TransactionsScreen
          profile={fixture.profile}
          store={store}
          loadCategories={fixture.budgets.readCategories}
          initialMonth="2026-10"
          today="2026-10-20"
          newId={() => 'unused'}
        />
      </TestScreen>,
    );
    await waitFor(() => expect(store.getState().status).toBe('ready'));
    await fireEvent.changeText(screen.getByLabelText('History month'), '2026-09');
    await fireEvent.press(screen.getByRole('button', { name: 'Open month' }));
    await waitFor(() => expect(store.getState().status).toBe('ready'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Expenses' }));
    await act(async () => {
      blur?.();
    });
    await fixture.budgets.saveCategory({
      id: 'groceries',
      name: 'Groceries',
      kind: 'essential',
      archived: false,
    });
    await act(async () => {
      focus?.();
    });
    await waitFor(() => expect(store.getState().status).toBe('ready'));
    expect(store.getState()).toMatchObject({ month: '2026-09', filter: 'expense' });
    expect(screen.getByLabelText('History month')).toHaveDisplayValue('2026-09');
    await fireEvent.press(screen.getByRole('button', { name: 'New transaction' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose category' }));
    expect(await screen.findByText('Groceries')).toBeOnTheScreen();
    await view.unmount();
  } finally {
    await fixture.database.close();
  }
}, 30000);
