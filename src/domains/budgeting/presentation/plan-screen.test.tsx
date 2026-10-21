import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { EffectCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { createHostDatabase } from '../../../../tests/helpers/host-database';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createProfileRepository } from '@/domains/settings/infrastructure/profile-repository';
import { createBudgetRepository } from '../infrastructure/budget-repository';
import { createBudgetService } from '../application/budget-service';
import { createBudgetStore } from './budget-store';
import { PlanScreen } from './plan-screen';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
let focus: EffectCallback | undefined;
/** Registers initial focus and retains the explicit native-tab refocus boundary.
 * @param effect Screen focus synchronization.
 * @returns Effect registration result.
 */
const useTestFocus = (effect: EffectCallback) => {
  useEffect(() => {
    focus = effect;
    return () => {
      focus = undefined;
    };
  }, [effect]);
  return useEffect(effect, [effect]);
};
beforeEach(() => {
  jest.mocked(useFocusEffect).mockImplementation(useTestFocus);
});

it('BUD-003 validates currency amounts and discards edits before switching months', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    await migrateDatabase(database);
    const profile = await createProfileRepository(database).initialize({
      id: 'personal',
      currency: { code: 'USD', exponent: 2 },
      locale: 'en-US',
      appearance: 'system',
    });
    const service = createBudgetService(createBudgetRepository(database));
    await service.saveCategory({ id: 'food', name: 'Food', kind: 'essential', archived: false });
    await service.savePlan({
      plan: {
        month: '2026-10',
        plannedIncome: 100000,
        limits: [{ categoryId: 'food', amount: 60000 }],
      },
      expectedRevision: await database.revision(),
    });
    const store = createBudgetStore(service);
    const view = await render(
      <TestScreen>
        <PlanScreen
          profile={profile}
          service={service}
          store={store}
          initialMonth="2026-10"
          newId={() => 'new-category'}
        />
      </TestScreen>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Planned income (USD)')).toHaveDisplayValue('1000.00'),
    );
    await fireEvent.changeText(screen.getByLabelText('Planned income (USD)'), '-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Save budget' }));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(await service.readMonth('2026-10')).toMatchObject({
      ok: true,
      value: { plan: { plannedIncome: 100000 } },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Discard edits' }));
    expect(screen.getByLabelText('Planned income (USD)')).toHaveDisplayValue('1000.00');
    await service.saveCategory({
      id: 'food',
      name: 'Groceries',
      kind: 'essential',
      archived: false,
    });
    await act(async () => {
      focus?.();
    });
    await waitFor(() => expect(store.getState().version?.revision).toBe(4));
    expect(screen.getByLabelText('Groceries limit (USD)')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Planned income (USD)'), '1200');
    await service.saveCategory({ id: 'food', name: 'Food', kind: 'essential', archived: false });
    await act(async () => {
      focus?.();
    });
    expect(
      await screen.findByText('Your data changed. Discard this draft and reload before saving.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Planned income (USD)')).toHaveDisplayValue('1200');
    await fireEvent.press(screen.getByRole('button', { name: 'Reload changed plan' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Discard and open' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Planned income (USD)')).toHaveDisplayValue('1000.00'),
    );
    await fireEvent.changeText(screen.getByLabelText('Planning month'), '2026-11');
    await fireEvent.press(screen.getByRole('button', { name: 'Open month' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Planned income (USD)')).toHaveDisplayValue('0.00'),
    );
    await fireEvent.changeText(screen.getByLabelText('Planned income (USD)'), '2000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save budget' }));
    await waitFor(() => expect(store.getState().version?.plan.plannedIncome).toBe(200000));
    expect(await service.readMonth('2026-10')).toMatchObject({
      ok: true,
      value: { plan: { plannedIncome: 100000 } },
    });
    await view.unmount();
  } finally {
    await database.close();
  }
}, 60000);
