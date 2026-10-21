import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { createHostDatabase } from '../../../../tests/helpers/host-database';
import { createDatabaseHandle } from '@/shared/infrastructure/database/connection';
import { migrateDatabase } from '@/shared/infrastructure/database/migrations';
import { createProfileRepository } from '@/domains/settings/infrastructure/profile-repository';
import { createBudgetRepository } from '../infrastructure/budget-repository';
import { createBudgetService } from '../application/budget-service';
import { CategoryDialog } from './category-dialog';

it('BUD-002 saves the explicitly checked category kind and preserves data on cancel', async () => {
  const database = createDatabaseHandle(createHostDatabase());
  try {
    await migrateDatabase(database);
    await createProfileRepository(database).initialize({
      id: 'personal',
      currency: { code: 'USD', exponent: 2 },
      locale: 'en-US',
      appearance: 'system',
    });
    const service = createBudgetService(createBudgetRepository(database));
    const category = {
      id: 'food',
      name: 'Food',
      kind: 'essential',
      archived: false,
    } satisfies Parameters<typeof service.saveCategory>[0];
    await service.saveCategory(category);
    const saved = jest.fn();
    const cancelled = jest.fn();
    const view = await render(
      <TestScreen>
        <CategoryDialog
          category={category}
          service={service}
          newId={() => 'unused'}
          onSaved={saved}
          onCancel={cancelled}
        />
      </TestScreen>,
    );
    expect(screen.getByRole('radio', { name: 'Essential', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Flexible' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(await service.readCategories()).toMatchObject({
      ok: true,
      value: [{ kind: 'essential' }],
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Save category' }));
    expect(await service.readCategories()).toMatchObject({
      ok: true,
      value: [{ kind: 'flexible' }],
    });
    expect(saved).toHaveBeenCalledTimes(1);
    await view.unmount();
  } finally {
    await database.close();
  }
}, 30000);
