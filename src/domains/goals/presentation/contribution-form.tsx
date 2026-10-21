import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Dialog, Text } from 'react-native-paper';
import { AppDialog } from '@/shared/presentation/dialog';
import type { Command, Result } from '@/shared/domain/result';
import { parseAmount } from '@/shared/domain/money';
import type { Profile } from '@/domains/settings/application/public';
import type { Contribution } from '../application/public';
import { amountInput } from '@/shared/presentation/money-format';
import { AppInput, ActionButton } from '@/shared/presentation/controls';
import { FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';

/** Edits actual goal earmarking with stable retry IDs and explicit deletion/discard.
 * @param props Source owner, currency, initial history record, and durable capabilities.
 * @param props.profile Confirmed currency and locale.
 * @param props.goalId Stable goal owner; corrections cannot silently move records between goals.
 * @param props.initial Existing contribution or a new draft.
 * @param props.today Suggested local calendar date.
 * @param props.newId Supplies record and action identities once per mounted form.
 * @param props.onSave Saves an actual contribution without generating an expense.
 * @param props.onRemove Deletes one source contribution.
 * @param props.onClose Dismisses after success or explicit discard.
 * @returns Scrollable Material form with accessible amount/date fields.
 */
export const ContributionForm = ({
  profile,
  goalId,
  initial,
  today,
  newId,
  onSave,
  onRemove,
  onClose,
}: {
  profile: Profile;
  goalId: string;
  initial: Contribution | null;
  today: string;
  newId: () => string;
  onSave: (command: Command<Contribution>) => Promise<Result<Contribution>>;
  onRemove: (command: Command<{ readonly id: string }>) => Promise<Result<void>>;
  onClose: () => void;
}) => {
  const [id] = useState(() => initial?.id ?? newId());
  const [operationId] = useState(newId);
  const [deleteId] = useState(newId);
  const originalAmount = initial
    ? amountInput(initial.amount, profile.currency, profile.locale)
    : '';
  const [amount, setAmount] = useState(originalAmount);
  const [date, setDate] = useState(initial?.date ?? today);
  const [phase, setPhase] = useState<'edit' | 'discard' | 'delete'>('edit');
  const operation = useOperation();
  const dirty = amount !== originalAmount || date !== (initial?.date ?? today);
  /** Requests explicit discard while preventing dismissal during an awaited mutation. */
  const close = () => {
    if (operation.busy) return;
    if (phase !== 'edit') setPhase('edit');
    else if (dirty) setPhase('discard');
    else onClose();
  };
  /** Parses exact local input and preserves action identity across retries. */
  const save = () =>
    operation.run(async () => {
      const parsed = parseAmount(amount, profile.currency, profile.locale);
      if (!parsed.ok) return parsed;
      return await onSave({ operationId, input: { id, goalId, amount: parsed.value, date } });
    }, onClose);
  return (
    <AppDialog visible dismissable={!operation.busy} onDismiss={close} style={{ maxHeight: '90%' }}>
      <Dialog.Title>
        {phase === 'delete'
          ? 'Delete contribution?'
          : phase === 'discard'
            ? 'Discard unsaved edits?'
            : initial
              ? 'Edit contribution'
              : 'New contribution'}
      </Dialog.Title>
      <Dialog.ScrollArea>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
        >
          {phase === 'edit' ? (
            <>
              <Text>
                Record money actually earmarked for this goal. Planned allocations do not count as
                savings.
              </Text>
              <AppInput
                label={`Amount (${profile.currency.code})`}
                accessibilityLabel="Contribution amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                maxLength={40}
                disabled={operation.busy}
              />
              <AppInput
                label="Contribution date"
                accessibilityLabel="Contribution date"
                value={date}
                onChangeText={setDate}
                maxLength={10}
                placeholder="YYYY-MM-DD"
                disabled={operation.busy}
              />
              <FormMessage message={operation.message} />
              <ActionButton
                mode="contained"
                onPress={save}
                disabled={operation.busy}
                loading={operation.busy}
              >
                Save contribution
              </ActionButton>
              {initial ? (
                <ActionButton
                  disabled={operation.busy}
                  onPress={() => {
                    operation.clearMessage();
                    setPhase('delete');
                  }}
                >
                  Delete contribution
                </ActionButton>
              ) : null}
              <ActionButton onPress={close} disabled={operation.busy}>
                Cancel
              </ActionButton>
            </>
          ) : phase === 'delete' ? (
            <>
              <Text>Actual goal savings will be recalculated after this record is removed.</Text>
              <FormMessage message={operation.message} />
              <ActionButton
                mode="contained"
                disabled={operation.busy}
                loading={operation.busy}
                onPress={() =>
                  operation.run(
                    async () => await onRemove({ operationId: deleteId, input: { id } }),
                    onClose,
                  )
                }
              >
                Delete
              </ActionButton>
              <ActionButton disabled={operation.busy} onPress={() => setPhase('edit')}>
                Keep contribution
              </ActionButton>
            </>
          ) : (
            <>
              <Text>Your saved history stays unchanged.</Text>
              <ActionButton mode="contained" onPress={onClose}>
                Discard edits
              </ActionButton>
              <ActionButton onPress={() => setPhase('edit')}>Keep editing</ActionButton>
            </>
          )}
        </ScrollView>
      </Dialog.ScrollArea>
    </AppDialog>
  );
};
