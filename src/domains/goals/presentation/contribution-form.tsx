import { useI18n } from '@/shared/presentation/i18n';
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
  const { t } = useI18n();
  // Keep an open draft's decimal separator stable when Settings changes language.
  const [inputLocale] = useState(profile.locale);
  const [id] = useState(() => initial?.id ?? newId());
  const [operationId] = useState(newId);
  const [deleteId] = useState(newId);
  const originalAmount = initial ? amountInput(initial.amount, profile.currency, inputLocale) : '';
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
      const parsed = parseAmount(amount, profile.currency, inputLocale);
      if (!parsed.ok) return parsed;
      return await onSave({ operationId, input: { id, goalId, amount: parsed.value, date } });
    }, onClose);
  return (
    <AppDialog visible dismissable={!operation.busy} onDismiss={close} style={{ maxHeight: '90%' }}>
      <Dialog.Title>
        {phase === 'delete'
          ? t('Delete contribution?')
          : phase === 'discard'
            ? t('Discard unsaved edits?')
            : initial
              ? t('Edit contribution')
              : t('New contribution')}
      </Dialog.Title>
      <Dialog.ScrollArea>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
        >
          {phase === 'edit' ? (
            <>
              <Text>
                {t(
                  'Record money actually earmarked for this goal. Planned allocations do not count as savings.',
                )}
              </Text>
              <AppInput
                label={t('Amount ({0})', { 0: profile.currency.code })}
                accessibilityLabel={t('Contribution amount')}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                maxLength={40}
                disabled={operation.busy}
              />
              <AppInput
                label={t('Contribution date')}
                accessibilityLabel={t('Contribution date')}
                value={date}
                onChangeText={setDate}
                maxLength={10}
                placeholder={t('YYYY-MM-DD')}
                disabled={operation.busy}
              />
              <FormMessage message={operation.message} />
              <ActionButton
                mode="contained"
                onPress={save}
                disabled={operation.busy}
                loading={operation.busy}
              >
                {t('Save contribution')}
              </ActionButton>
              {initial ? (
                <ActionButton
                  disabled={operation.busy}
                  onPress={() => {
                    operation.clearMessage();
                    setPhase('delete');
                  }}
                >
                  {t('Delete contribution')}
                </ActionButton>
              ) : null}
              <ActionButton onPress={close} disabled={operation.busy}>
                {t('Cancel')}
              </ActionButton>
            </>
          ) : phase === 'delete' ? (
            <>
              <Text>
                {t('Actual goal savings will be recalculated after this record is removed.')}
              </Text>
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
                {t('Delete')}
              </ActionButton>
              <ActionButton disabled={operation.busy} onPress={() => setPhase('edit')}>
                {t('Keep contribution')}
              </ActionButton>
            </>
          ) : (
            <>
              <Text>{t('Your saved history stays unchanged.')}</Text>
              <ActionButton mode="contained" onPress={onClose}>
                {t('Discard edits')}
              </ActionButton>
              <ActionButton onPress={() => setPhase('edit')}>{t('Keep editing')}</ActionButton>
            </>
          )}
        </ScrollView>
      </Dialog.ScrollArea>
    </AppDialog>
  );
};
