import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { GoalForm } from './goal-form';
import type { Goal } from '../application/public';
import type { Command } from '@/shared/domain/result';

it('GOAL-001 edits priority and completion without changing actual savings', async () => {
  const initial: Goal = {
    id: 'g',
    name: 'Fund',
    target: 10000,
    startingSaved: 1000,
    deadline: null,
    priority: 'low',
    desiredMonthly: null,
    state: 'active',
  };
  const commands: Command<Goal>[] = [];
  await render(
    <TestScreen>
      <GoalForm
        profile={{
          id: 'p',
          currency: { code: 'USD', exponent: 2 },
          locale: 'en-US',
          appearance: 'system',
        }}
        initial={initial}
        newId={() => 'operation'}
        onSave={async (command) => {
          commands.push(command);
          return { ok: true, value: command.input };
        }}
        onClose={() => undefined}
      />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('radio', { name: 'High' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Completed' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
  expect(commands).toEqual([
    { operationId: 'operation', input: { ...initial, priority: 'high', state: 'completed' } },
  ]);
}, 30000);
