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
  const [id] = useState(() => initial?.id ?? newId());
  const [name, setName] = useState(initial?.name ?? '');
  const originalFunding = amountInput(initial?.funding ?? 0, profile.currency, profile.locale);
  const [funding, setFunding] = useState(originalFunding);
  const [originalItems] = useState(() =>
    (initial?.items ?? []).map((item) => ({
      ...item,
      amount: amountInput(item.amount, profile.currency, profile.locale),
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
    const parsedFunding = parseAmount(funding, profile.currency, profile.locale);
    if (!parsedFunding.ok) return parsedFunding;
    const parsedItems: NamedPlan['items'][number][] = [];
    for (const item of items) {
      const amount = parseAmount(item.amount, profile.currency, profile.locale);
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
        {discard ? 'Discard unsaved edits?' : initial ? 'Edit plan' : 'New plan'}
      </Dialog.Title>
      <Dialog.ScrollArea style={styles.scroll}>
        {discard ? (
          <View style={styles.content}>
            <Text>Your saved plans stay unchanged.</Text>
            <ActionButton onPress={() => setDiscard(false)}>Keep editing</ActionButton>
            <ActionButton mode="contained" onPress={onClose}>
              Discard edits
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
                  Plan a vacation, an event, or another expense. These estimates stay separate from
                  monthly transactions.
                </Text>
                <AppInput
                  label="Plan name"
                  accessibilityLabel="Plan name"
                  value={name}
                  onChangeText={setName}
                  maxLength={120}
                  disabled={operation.busy}
                />
                <AppInput
                  label={`Plan funding (${profile.currency.code})`}
                  accessibilityLabel={`Plan funding (${profile.currency.code})`}
                  value={funding}
                  onChangeText={setFunding}
                  keyboardType="decimal-pad"
                  maxLength={40}
                  disabled={operation.busy}
                />
                {draft.ok && totals ? (
                  <>
                    <BudgetGauge
                      label="Funding allocated"
                      value={totals.allocated}
                      limit={draft.value.funding}
                    />
                    <Text>
                      {totals.remaining < 0 ? 'Overallocated by' : 'Unallocated'}{' '}
                      {formatMoney(Math.abs(totals.remaining), profile.currency, profile.locale)}
                    </Text>
                  </>
                ) : null}
                <Text variant="titleLarge">Expense estimates</Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <Card mode="outlined">
                <Card.Content style={styles.section}>
                  <AppInput
                    label={`Expense ${index + 1} name`}
                    accessibilityLabel={`Expense ${index + 1} name`}
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
                    label={`Expense ${index + 1} amount (${profile.currency.code})`}
                    accessibilityLabel={`Expense ${index + 1} amount (${profile.currency.code})`}
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
                    accessibilityLabel={`Remove expense ${index + 1}`}
                    disabled={operation.busy}
                    onPress={() =>
                      setItems((current) => current.filter((row) => row.id !== item.id))
                    }
                  >
                    Remove expense
                  </ActionButton>
                </Card.Content>
              </Card>
            )}
            ListEmptyComponent={
              <Text>No estimates yet. Add expenses such as travel and accommodation.</Text>
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
                      amount: amountInput(0, profile.currency, profile.locale),
                    };
                    setItems((current) => [...current, nextItem]);
                  }}
                >
                  Add expense
                </ActionButton>
                {items.length >= MAX_PLAN_ITEMS ? (
                  <Text>A plan supports up to 100 expense estimates.</Text>
                ) : null}
                <FormMessage message={operation.message} />
                <ActionButton
                  mode="contained"
                  onPress={save}
                  disabled={operation.busy}
                  loading={operation.busy}
                >
                  Save plan
                </ActionButton>
                <ActionButton onPress={close} disabled={operation.busy}>
                  Cancel
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
