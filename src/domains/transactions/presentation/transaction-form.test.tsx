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
