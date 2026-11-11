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

it('opens an expense draft once per Home request, including on an already mounted tab', async () => {
  const fixture = await createTransactionFixture();
  try {
    const store = createTransactionStore(fixture.transactions);
    let sequence = 0;
    const props = {
      profile: fixture.profile,
      store,
      loadCategories: fixture.budgets.readCategories,
      initialMonth: '2026-10',
      today: '2026-10-20',
      onNewPlanning: jest.fn(),
      /** Supplies deterministic identities for each newly opened expense draft.
       * @returns A unique fixture record or operation identity.
       */
      newId: () => `quick-${++sequence}`,
    };
    const view = await render(
      <TestScreen>
        <TransactionsScreen {...props} />
      </TestScreen>,
    );
    await waitFor(() => expect(store.getState().status).toBe('ready'));
    await view.rerender(
      <TestScreen>
        <TransactionsScreen {...props} createRequest="first" />
      </TestScreen>,
    );
    expect(await screen.findByRole('radio', { name: 'Expense', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await act(() => {
      blur?.();
      focus?.();
    });
    expect(screen.queryByLabelText('Amount (USD)')).toBeNull();
    await view.rerender(
      <TestScreen>
        <TransactionsScreen {...props} createRequest="second" />
      </TestScreen>,
    );
    expect(await screen.findByLabelText('Amount (USD)')).toHaveDisplayValue('');
    await view.unmount();
  } finally {
    await fixture.database.close();
  }
}, 30000);

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
          onNewPlanning={jest.fn()}
        />
      </TestScreen>,
    );
    await waitFor(() => expect(store.getState().status).toBe('ready'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Income' }));
    expect(
      screen.getByText('No income in the loaded entries. Load more or change the filter.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'History month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'November 2026' }));
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
          onNewPlanning={jest.fn()}
        />
      </TestScreen>,
    );
    await waitFor(() => expect(store.getState().status).toBe('ready'));
    await fireEvent.press(screen.getByRole('button', { name: 'History month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'September 2026' }));
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
    expect(screen.getByRole('button', { name: 'History month' })).toHaveAccessibilityValue({
      text: '2026-09',
    });
    expect(screen.queryByRole('button', { name: 'New transaction' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open quick actions' }));
    await fireEvent.press(screen.getByText('Record Spending', { includeHiddenElements: true }));
    expect(await screen.findByRole('radio', { name: 'Expense', checked: true })).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose category' }));
    expect(await screen.findByText('Groceries')).toBeOnTheScreen();
    await view.unmount();
  } finally {
    await fixture.database.close();
  }
}, 30000);
