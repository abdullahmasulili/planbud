import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { createHostDatabase } from '../../../../tests/helpers/host-database';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createProfileRepository } from '@/domains/settings/infrastructure/profile-repository';
import { createNamedPlanRepository } from '../infrastructure/named-plan-repository';
import { createNamedPlanService } from '../application/named-plan-service';
import { createNamedPlanStore } from './named-plan-store';
import { NamedPlansScreen } from './named-plans-screen';
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
beforeEach(() => {
  jest.mocked(useFocusEffect).mockImplementation((effect) => useEffect(effect, [effect]));
});

it('PLAN-001/UI-010 creates multiple plans and protects drafts and confirmed deletion', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    await migrateDatabase(database);
    const profile = await createProfileRepository(database).initialize({
      id: 'p',
      currency: { code: 'USD', exponent: 2 },
      locale: 'en-US',
      appearance: 'system',
    });
    const service = createNamedPlanService(createNamedPlanRepository(database));
    const store = createNamedPlanStore(service);
    let sequence = 0;
    const view = await render(
      <TestScreen>
        <NamedPlansScreen
          profile={profile}
          service={service}
          store={store}
          newId={() => `id-${++sequence}`}
        />
      </TestScreen>,
    );
    await screen.findByText('No named plans yet');
    await fireEvent.press(screen.getByRole('button', { name: 'New plan' }));
    await fireEvent.changeText(screen.getByLabelText('Plan name'), 'Vacation');
    await fireEvent.changeText(screen.getByLabelText('Plan funding (USD)'), '1000');
    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));
    await fireEvent.changeText(screen.getByLabelText('Expense 1 name'), 'Hotel');
    await fireEvent.changeText(screen.getByLabelText('Expense 1 amount (USD)'), '1200');
    await fireEvent.press(screen.getByRole('button', { name: 'Save plan' }));
    await screen.findByText('Vacation');
    expect(screen.getByText('Overallocated by $200.00')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'New plan' }));
    await fireEvent.changeText(screen.getByLabelText('Plan name'), 'Wedding');
    await fireEvent.changeText(screen.getByLabelText('Plan funding (USD)'), '2000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save plan' }));
    await screen.findByText('Wedding');
    expect(store.getState().version?.plans).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Vacation' }));
    await fireEvent.changeText(screen.getByLabelText('Plan name'), 'Unsaved rename');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('Discard unsaved edits?');
    await fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Plan name')).toHaveDisplayValue('Unsaved rename');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Discard edits' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Vacation' }));
    await screen.findByText('Delete Vacation?');
    expect(store.getState().version?.plans).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete plan' }));
    await waitFor(() => expect(store.getState().version?.plans).toHaveLength(1));
    expect(store.getState().version?.plans[0]?.name).toBe('Wedding');
    await view.unmount();
  } finally {
    await database.close();
  }
}, 60000);
