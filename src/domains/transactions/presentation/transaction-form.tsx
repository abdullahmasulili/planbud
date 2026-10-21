import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Dialog, Text } from 'react-native-paper';
import { AppDialog } from '@/shared/presentation/dialog';
import type { Command, Result } from '@/shared/domain/result';
import { parseAmount } from '@/shared/domain/money';
import type { Profile } from '@/domains/settings/application/public';
import type { Category } from '@/domains/budgeting/application/public';
import type { Transaction } from '../application/public';
import { amountInput } from '@/shared/presentation/money-format';
import { AppInput, ActionButton } from '@/shared/presentation/controls';
import { FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';
import { CategoryPicker } from './category-picker';
import { ChoiceGroup } from '@/shared/presentation/choice-group';

/** Edits one source entry with stable retry identities and explicit deletion/discard actions.
 * @param props Validated profile, category metadata, and durable form capabilities.
 * @param props.profile Confirmed currency and locale.
 * @param props.categories Category labels retaining archived history.
 * @param props.initial Existing record or an empty creation draft.
 * @param props.today Local calendar date suggested for a new record.
 * @param props.newId Supplies record and operation identities once per mounted form.
 * @param props.onSave Returns the durable save outcome, independently of UI refresh.
 * @param props.onRemove Returns the durable deletion outcome.
 * @param props.onClose Dismisses the form after success or explicit discard.
 * @param props.onCommitted Announces a durable outcome only while the form remains mounted.
 * @param props.categoryError Explains a failed category read without claiming categories are missing.
 * @returns A keyboard-accessible Material record form without direct storage access.
 */
export const TransactionForm = ({
  profile,
  categories,
  initial,
  today,
  newId,
  onSave,
  onRemove,
  onClose,
  onCommitted,
  categoryError = '',
}: {
  profile: Profile;
  categories: readonly Category[];
  initial: Transaction | null;
  today: string;
  newId: () => string;
  onSave: (command: Command<Transaction>) => Promise<Result<Transaction>>;
  onRemove: (command: Command<{ readonly id: string }>) => Promise<Result<void>>;
  onClose: () => void;
  onCommitted?: (kind: 'save' | 'remove') => void;
  categoryError?: string;
}) => {
  const [id] = useState(() => initial?.id ?? newId());
  const [operationId] = useState(newId);
  const [deleteId] = useState(newId);
  const originalAmount = initial
    ? amountInput(initial.amount, profile.currency, profile.locale)
    : '';
  const [type, setType] = useState<Transaction['type']>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(originalAmount);
  const [date, setDate] = useState(initial?.date ?? today);
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [phase, setPhase] = useState<'edit' | 'delete' | 'discard'>('edit');
  const [picking, setPicking] = useState(false);
  const operation = useOperation();
  const available = categories.filter(
    (category) => !category.archived || category.id === initial?.categoryId,
  );
  const selected = categories.find((category) => category.id === categoryId);
  const dirty =
    type !== (initial?.type ?? 'expense') ||
    amount !== originalAmount ||
    date !== (initial?.date ?? today) ||
    categoryId !== (initial?.categoryId ?? null) ||
    note !== (initial?.note ?? '');
  /** Prevents accidental dismissal of an unsaved or in-flight financial change. */
  const requestClose = () => {
    if (operation.busy) return;
    if (phase !== 'edit') setPhase('edit');
    else if (dirty) setPhase('discard');
    else onClose();
  };
  /** Parses locale input before submitting the same action identity on every retry. */
  const save = () => {
    operation.run(
      async () => {
        const parsed = parseAmount(amount, profile.currency, profile.locale);
        if (!parsed.ok) return parsed;
        return await onSave({
          operationId,
          input: {
            id,
            type,
            amount: parsed.value,
            date,
            categoryId: type === 'income' ? null : categoryId,
            note,
          },
        });
      },
      () => {
        onCommitted?.('save');
        onClose();
      },
    );
  };
  return (
    <>
      <AppDialog
        visible
        dismissable={!operation.busy}
        onDismiss={requestClose}
        style={{ maxHeight: '90%' }}
      >
        <Dialog.Title>
          {phase === 'delete'
            ? 'Delete transaction?'
            : phase === 'discard'
              ? 'Discard unsaved edits?'
              : initial
                ? 'Edit transaction'
                : 'New transaction'}
        </Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
          >
            {phase === 'edit' ? (
              <>
                <ChoiceGroup<Transaction['type']>
                  label="Transaction type"
                  value={type}
                  options={[
                    { value: 'expense', label: 'Expense' },
                    { value: 'income', label: 'Income' },
                  ]}
                  onChange={setType}
                  disabled={operation.busy}
                />
                <AppInput
                  label={`Amount (${profile.currency.code})`}
                  accessibilityLabel={`Amount (${profile.currency.code})`}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  maxLength={40}
                  disabled={operation.busy}
                />
                <AppInput
                  label="Transaction date"
                  accessibilityLabel="Transaction date"
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  disabled={operation.busy}
                />
                {type === 'expense' ? (
                  <>
                    <Text variant="titleMedium">Expense category</Text>
                    <Text>
                      {selected
                        ? `${selected.name}${selected.archived ? ' · archived' : ''}`
                        : 'Choose a category for this expense.'}
                    </Text>
                    {available.length ? (
                      <ActionButton
                        mode="outlined"
                        disabled={operation.busy}
                        onPress={() => setPicking(true)}
                      >
                        Choose category
                      </ActionButton>
                    ) : categoryError ? (
                      <FormMessage message={categoryError} />
                    ) : (
                      <Text>Create a category in Plan before entering an expense.</Text>
                    )}
                  </>
                ) : null}
                <AppInput
                  label="Note (optional)"
                  accessibilityLabel="Transaction note"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  maxLength={2000}
                  disabled={operation.busy}
                />
                <FormMessage message={operation.message} />
                <ActionButton
                  mode="contained"
                  loading={operation.busy}
                  disabled={operation.busy}
                  onPress={save}
                >
                  Save transaction
                </ActionButton>
                {initial ? (
                  <ActionButton
                    disabled={operation.busy}
                    onPress={() => {
                      operation.clearMessage();
                      setPhase('delete');
                    }}
                  >
                    Delete transaction
                  </ActionButton>
                ) : null}
                <ActionButton disabled={operation.busy} onPress={requestClose}>
                  Cancel
                </ActionButton>
              </>
            ) : phase === 'delete' ? (
              <>
                <Text>The record will be removed and monthly totals recalculated.</Text>
                <FormMessage message={operation.message} />
                <ActionButton
                  mode="contained"
                  loading={operation.busy}
                  disabled={operation.busy}
                  onPress={() =>
                    operation.run(
                      async () => await onRemove({ operationId: deleteId, input: { id } }),
                      () => {
                        onCommitted?.('remove');
                        onClose();
                      },
                    )
                  }
                >
                  Delete
                </ActionButton>
                <ActionButton disabled={operation.busy} onPress={() => setPhase('edit')}>
                  Keep transaction
                </ActionButton>
              </>
            ) : (
              <>
                <Text>Your saved record stays unchanged.</Text>
                <ActionButton mode="contained" onPress={onClose}>
                  Discard edits
                </ActionButton>
                <ActionButton onPress={() => setPhase('edit')}>Keep editing</ActionButton>
              </>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
      </AppDialog>
      {picking ? (
        <CategoryPicker
          categories={available}
          selected={categoryId}
          onClose={() => setPicking(false)}
          onSelected={(value) => {
            setCategoryId(value);
            setPicking(false);
          }}
        />
      ) : null}
    </>
  );
};
