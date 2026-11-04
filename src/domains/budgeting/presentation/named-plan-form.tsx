import { useI18n } from '@/shared/presentation/i18n';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Card, Dialog, Text } from 'react-native-paper';
import { AppDialog } from '@/shared/presentation/dialog';
import { AppInput, ActionButton } from '@/shared/presentation/controls';
import { FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';
import { BudgetGauge } from '@/shared/presentation/charts';
import { parseAmount } from '@/shared/domain/money';
import { amountInput, formatMoney } from '@/shared/presentation/money-format';
import type { Result } from '@/shared/domain/result';
import type { Profile } from '@/domains/settings/application/public';
import { MAX_PLAN_ITEMS, parseNamedPlan, summarizeNamedPlan } from '../application/public';
import type { NamedPlan, NamedPlanService } from '../application/public';

/** Edits one independent set of estimates with an original revision and explicit draft ownership.
 * @param props Source record, confirmed currency, stable identities, and revision-checked save capability.
 * @param props.initial Existing plan or a new empty draft.
 * @param props.revision Source revision captured when the form opened.
 * @param props.profile Confirmed currency and locale for exact monetary input.
 * @param props.newId Generates identities once for each new plan or expense.
 * @param props.onSave Application mutation capability.
 * @param props.onSaved Closes and refreshes after a successful save.
 * @param props.onClose Closes after cancel or explicit discard.
 * @returns Keyboard-aware bounded expense editor with allocation preview and inline errors.
 */
export const NamedPlanForm = ({
  initial,
  revision,
  profile,
  newId,
  onSave,
  onSaved,
  onClose,
}: {
  initial: NamedPlan | null;
  revision: number;
  profile: Profile;
  newId: () => string;
  onSave: NamedPlanService['save'];
  onSaved: () => void;
  onClose: () => void;
}) => {
  const { t } = useI18n();
  // Keep an open draft's decimal separator stable when Settings changes language.
  const [inputLocale] = useState(profile.locale);
  const [id] = useState(() => initial?.id ?? newId());
  const [name, setName] = useState(initial?.name ?? '');
  const originalFunding = amountInput(initial?.funding ?? 0, profile.currency, inputLocale);
  const [funding, setFunding] = useState(originalFunding);
  const [originalItems] = useState(() =>
    (initial?.items ?? []).map((item) => ({
      ...item,
      amount: amountInput(item.amount, profile.currency, inputLocale),
    })),
  );
  const [items, setItems] = useState(originalItems);
  const [discard, setDiscard] = useState(false);
  const operation = useOperation();
  const dirty =
    name !== (initial?.name ?? '') ||
    funding !== originalFunding ||
    JSON.stringify(items) !== JSON.stringify(originalItems);
  /** Parses editable amounts before preview or persistence, preserving the exact currency exponent.
   * @returns Canonical draft or the first field/domain failure, without modifying records.
   */
  const parseDraft = (): Result<NamedPlan> => {
    const parsedFunding = parseAmount(funding, profile.currency, inputLocale);
    if (!parsedFunding.ok) return parsedFunding;
    const parsedItems: NamedPlan['items'][number][] = [];
    for (const item of items) {
      const amount = parseAmount(item.amount, profile.currency, inputLocale);
      if (!amount.ok) return amount;
      parsedItems.push({ ...item, amount: amount.value });
    }
    return parseNamedPlan({ id, name, funding: parsedFunding.value, items: parsedItems });
  };
  const draft = parseDraft();
  const totals = draft.ok ? summarizeNamedPlan(draft.value) : null;
  /** Requires explicit discard for dirty estimates; repeated back presses keep the confirmation open. */
  const close = () => {
    if (operation.busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  /** Saves against the original revision; storage failures keep every draft field intact. */
  const save = () =>
    operation.run(async () => {
      const parsed = parseDraft();
      if (!parsed.ok) return parsed;
      return await onSave({ plan: parsed.value, expectedRevision: revision });
    }, onSaved);
  return (
    <AppDialog visible onDismiss={close} dismissable={!operation.busy} style={styles.dialog}>
      <Dialog.Title>
        {discard ? t('Discard unsaved edits?') : initial ? t('Edit plan') : t('New plan')}
      </Dialog.Title>
      <Dialog.ScrollArea style={styles.scroll}>
        {discard ? (
          <View style={styles.content}>
            <Text>{t('Your saved plans stay unchanged.')}</Text>
            <ActionButton onPress={() => setDiscard(false)}>{t('Keep editing')}</ActionButton>
            <ActionButton mode="contained" onPress={onClose}>
              {t('Discard edits')}
            </ActionButton>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <View style={styles.section}>
                <Text>
                  {t(
                    'Plan a vacation, an event, or another expense. These estimates stay separate from monthly transactions.',
                  )}
                </Text>
                <AppInput
                  label={t('Plan name')}
                  accessibilityLabel={t('Plan name')}
                  value={name}
                  onChangeText={setName}
                  maxLength={120}
                  disabled={operation.busy}
                />
                <AppInput
                  label={t('Plan funding ({0})', { 0: profile.currency.code })}
                  accessibilityLabel={t('Plan funding ({0})', { 0: profile.currency.code })}
                  value={funding}
                  onChangeText={setFunding}
                  keyboardType="decimal-pad"
                  maxLength={40}
                  disabled={operation.busy}
                />
                {draft.ok && totals ? (
                  <>
                    <BudgetGauge
                      label={t('Funding allocated')}
                      value={totals.allocated}
                      limit={draft.value.funding}
                    />
                    <Text>
                      {totals.remaining < 0 ? t('Overallocated by') : t('Unallocated')}{' '}
                      {formatMoney(Math.abs(totals.remaining), profile.currency, profile.locale)}
                    </Text>
                  </>
                ) : null}
                <Text variant="titleLarge">{t('Expense estimates')}</Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <Card mode="outlined">
                <Card.Content style={styles.section}>
                  <AppInput
                    label={t('Expense {0} name', { 0: index + 1 })}
                    accessibilityLabel={t('Expense {0} name', { 0: index + 1 })}
                    value={item.name}
                    maxLength={120}
                    disabled={operation.busy}
                    onChangeText={(text) =>
                      setItems((current) =>
                        current.map((row) => (row.id === item.id ? { ...row, name: text } : row)),
                      )
                    }
                  />
                  <AppInput
                    label={t('Expense {0} amount ({1})', {
                      0: index + 1,
                      1: profile.currency.code,
                    })}
                    accessibilityLabel={t('Expense {0} amount ({1})', {
                      0: index + 1,
                      1: profile.currency.code,
                    })}
                    value={item.amount}
                    keyboardType="decimal-pad"
                    maxLength={40}
                    disabled={operation.busy}
                    onChangeText={(text) =>
                      setItems((current) =>
                        current.map((row) => (row.id === item.id ? { ...row, amount: text } : row)),
                      )
                    }
                  />
                  <ActionButton
                    accessibilityLabel={t('Remove expense {0}', { 0: index + 1 })}
                    disabled={operation.busy}
                    onPress={() =>
                      setItems((current) => current.filter((row) => row.id !== item.id))
                    }
                  >
                    {t('Remove expense')}
                  </ActionButton>
                </Card.Content>
              </Card>
            )}
            ListEmptyComponent={
              <Text>{t('No estimates yet. Add expenses such as travel and accommodation.')}</Text>
            }
            ListFooterComponent={
              <View style={styles.section}>
                <ActionButton
                  mode="outlined"
                  disabled={operation.busy || items.length >= MAX_PLAN_ITEMS}
                  onPress={() => {
                    const nextItem = {
                      id: newId(),
                      name: '',
                      amount: amountInput(0, profile.currency, inputLocale),
                    };
                    setItems((current) => [...current, nextItem]);
                  }}
                >
                  {t('Add expense')}
                </ActionButton>
                {items.length >= MAX_PLAN_ITEMS ? (
                  <Text>{t('A plan supports up to 100 expense estimates.')}</Text>
                ) : null}
                <FormMessage message={operation.message} />
                <ActionButton
                  mode="contained"
                  onPress={save}
                  disabled={operation.busy}
                  loading={operation.busy}
                >
                  {t('Save plan')}
                </ActionButton>
                <ActionButton onPress={close} disabled={operation.busy}>
                  {t('Cancel')}
                </ActionButton>
              </View>
            }
          />
        )}
      </Dialog.ScrollArea>
    </AppDialog>
  );
};
const styles = StyleSheet.create({
  dialog: { maxHeight: '90%' },
  scroll: { paddingHorizontal: 0, flexShrink: 1 },
  content: { padding: 24, gap: 24 },
  section: { gap: 16 },
});
