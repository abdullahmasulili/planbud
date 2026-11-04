import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import type { Command, Result } from '@/shared/domain/result';
import type { Transaction } from '../application/public';
import { TransactionForm } from './transaction-form';

it('TXN-001 preserves a save operation ID across retries and parses exact input units', async () => {
  const submitted: Command<Transaction>[] = [];
  let nextId = 0;
  const closed = jest.fn();
  /** Simulates an uncertain first save and a successful retry.
   * @param command Canonical form command.
   * @returns A retryable failure followed by the committed input.
   */
  const save = async (command: Command<Transaction>): Promise<Result<Transaction>> => {
    submitted.push(command);
    return submitted.length === 1
      ? { ok: false, error: { code: 'unavailable', message: 'Try saving again.' } }
      : { ok: true, value: command.input };
  };
  await render(
    <TestScreen>
      <TransactionForm
        profile={{
          id: 'personal',
          currency: { code: 'USD', exponent: 2 },
          locale: 'en-US',
          appearance: 'system',
        }}
        categories={[]}
        initial={null}
        today="2026-10-20"
        newId={() => `id-${++nextId}`}
        onSave={save}
        onRemove={async () => ({ ok: true, value: undefined })}
        onClose={closed}
      />
    </TestScreen>,
  );
  expect(screen.getByTestId('dialog-window')).toHaveProp('visible', true);
  await fireEvent.press(screen.getByRole('radio', { name: 'Income' }));
  await fireEvent.changeText(screen.getByLabelText('Amount (USD)'), '12.50');
  await fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));
  expect(screen.getByText('Try saving again.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));
  expect(submitted).toHaveLength(2);
  expect(submitted[0]?.operationId).toBe(submitted[1]?.operationId);
  expect(submitted[1]?.input).toMatchObject({
    type: 'income',
    amount: 1250,
    categoryId: null,
    date: '2026-10-20',
  });
  expect(closed).toHaveBeenCalledTimes(1);
}, 30000);

it('keeps an open amount draft in its original format after a display-language change', async () => {
  const save = jest.fn(async (command: Command<Transaction>): Promise<Result<Transaction>> => ({
    ok: true,
    value: command.input,
  }));
  const props = {
    categories: [],
    initial: null,
    today: '2026-10-20',
    /** Supplies a stable synthetic form identity.
     * @returns Test-only identity.
     */
    newId: () => 'id',
    onSave: save,
    /** Completes the unused deletion boundary.
     * @returns Successful deletion outcome.
     */
    onRemove: async (): Promise<Result<void>> => ({ ok: true, value: undefined }),
    onClose: jest.fn(),
  };
  const profile = {
    id: 'personal',
    currency: { code: 'USD', exponent: 2 },
    locale: 'en-US',
    appearance: 'system',
  } satisfies import('@/domains/settings/application/public').Profile;
  const view = await render(
    <TestScreen>
      <TransactionForm {...props} profile={profile} />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('radio', { name: 'Income' }));
  await fireEvent.changeText(screen.getByLabelText('Amount (USD)'), '12.50');
  await view.rerender(
    <TestScreen>
      <TransactionForm {...props} profile={{ ...profile, locale: 'id-ID' }} />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ input: expect.objectContaining({ amount: 1250 }) }),
  );
});
