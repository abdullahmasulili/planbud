import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';
import { OverviewScreen } from './overview-screen';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
beforeEach(() => {
  jest.mocked(useFocusEffect).mockImplementation((effect) => useEffect(effect, [effect]));
});

it('reveals both Home shortcuts, closes on Back, and invokes each creation flow', async () => {
  const fixture = await createTransactionFixture();
  try {
    const onNewPlanning = jest.fn();
    const onRecordSpending = jest.fn();
    const back = jest.spyOn(BackHandler, 'addEventListener');
    const view = await render(
      <TestScreen>
        <OverviewScreen
          profile={fixture.profile}
          budgets={fixture.budgets}
          transactions={fixture.transactions}
          initialMonth="2026-10"
          onPlan={jest.fn()}
          onSettings={jest.fn()}
          onNewPlanning={onNewPlanning}
          onRecordSpending={onRecordSpending}
        />
      </TestScreen>,
    );
    await screen.findByText('Your month');
    expect(screen.queryByRole('button', { name: 'New Planning' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open quick actions' }));
    expect(
      screen.getByRole('button', { name: 'Close quick actions', expanded: true }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'New Planning' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Record Spending' })).toBeOnTheScreen();
    await act(() => {
      expect(back.mock.calls.at(-1)?.[1]({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);
    });
    expect(screen.getByRole('button', { name: 'Open quick actions' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open quick actions' }));
    await fireEvent.press(screen.getByText('New Planning', { includeHiddenElements: true }));
    expect(onNewPlanning).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Open quick actions' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open quick actions' }));
    await fireEvent.press(screen.getByText('Record Spending', { includeHiddenElements: true }));
    expect(onRecordSpending).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Open quick actions' })).toBeOnTheScreen();
    await view.unmount();
  } finally {
    await fixture.database.close();
  }
}, 30000);
