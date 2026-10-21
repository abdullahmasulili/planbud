import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { ContributionForm } from './contribution-form';
import type { Command } from '@/shared/domain/result';
import type { Contribution } from '../application/public';

it('MONEY-003 corrects actual contribution amount/date and requires explicit deletion', async () => {
  const saved: Command<Contribution>[] = [];
  const removed: string[] = [];
  await render(
    <TestScreen>
      <ContributionForm
        profile={{
          id: 'p',
          currency: { code: 'USD', exponent: 2 },
          locale: 'en-US',
          appearance: 'system',
        }}
        goalId="g"
        initial={{ id: 'c', goalId: 'g', amount: 100, date: '2026-10-20' }}
        today="2026-10-20"
        newId={() => 'op'}
        onSave={async (command) => {
          saved.push(command);
          return { ok: true, value: command.input };
        }}
        onRemove={async (command) => {
          removed.push(command.input.id);
          return { ok: true, value: undefined };
        }}
        onClose={() => undefined}
      />
    </TestScreen>,
  );
  await fireEvent.changeText(screen.getByLabelText('Contribution amount'), '2.50');
  await fireEvent.changeText(screen.getByLabelText('Contribution date'), '2026-11-01');
  await fireEvent.press(screen.getByRole('button', { name: 'Save contribution' }));
  expect(saved).toMatchObject([{ input: { amount: 250, date: '2026-11-01' } }]);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete contribution' }));
  expect(removed).toEqual([]);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(removed).toEqual(['c']);
}, 30000);
