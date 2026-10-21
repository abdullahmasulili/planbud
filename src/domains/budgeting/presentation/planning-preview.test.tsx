import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { createTransactionFixture } from '../../../../tests/helpers/transaction-fixture';
import { createPlanningAdapter } from '@/composition/planning-adapter';
import { createPlanningService } from '../application/planning-service';
import { createPlanningStore } from './planning-store';
import { PlanningPreviewDialog } from './planning-preview';

it('DSS-010 previews a selected cut before explicit apply and preserves actual savings', async () => {
  const fixture = await createTransactionFixture();
  try {
    await fixture.budgets.saveCategory({
      id: 'flex',
      name: 'Fun',
      kind: 'flexible',
      archived: false,
    });
    await fixture.budgets.savePlan({
      expectedRevision: await fixture.database.revision(),
      plan: {
        month: '2026-10',
        plannedIncome: 10000,
        limits: [{ categoryId: 'flex', amount: 6000 }],
      },
    });
    await fixture.goals.saveGoal({
      operationId: 'g',
      input: {
        id: 'g',
        name: 'Fund',
        target: 5000,
        startingSaved: 0,
        deadline: '2026-10-31',
        priority: 'high',
        desiredMonthly: null,
        state: 'active',
      },
    });
    const store = createPlanningStore(
      createPlanningService(createPlanningAdapter(fixture.database)),
    );
    await store.getState().open('2026-10');
    await render(
      <TestScreen>
        <PlanningPreviewDialog
          profile={fixture.profile}
          store={store}
          categoryNames={[{ id: 'flex', name: 'Fun' }]}
          goalNames={[{ id: 'g', name: 'Fund' }]}
          onClose={() => undefined}
          onApplied={() => undefined}
          onGoals={() => undefined}
        />
      </TestScreen>,
    );
    expect(screen.getByText('Proposed $40.00 · gap $10.00')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Set Fun limit to $50.00' }));
    expect(screen.getByRole('button', { name: 'Apply reviewed plan' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Preview selected adjustments' }));
    expect(screen.getByText('Proposed $50.00 · gap $0.00')).toBeOnTheScreen();
    expect(
      await fixture.database.read(async (sql) => await sql.all('SELECT * FROM goal_allocations')),
    ).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Apply reviewed plan' }));
    expect(
      await fixture.database.read(
        async (sql) => await sql.all('SELECT amount FROM goal_allocations'),
      ),
    ).toEqual([{ amount: 5000 }]);
    expect(await fixture.goals.readGoals()).toMatchObject({ ok: true, value: [{ saved: 0 }] });
  } finally {
    await fixture.database.close();
  }
}, 30000);
