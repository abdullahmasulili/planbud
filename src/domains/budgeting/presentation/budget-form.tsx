import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dialog, Text, useTheme } from 'react-native-paper';
import { AppDialog } from '@/shared/presentation/dialog';
import type { BudgetService, Category, PlanVersion } from '../application/public';
import type { Profile } from '@/domains/settings/application/public';
import { parseAmount } from '@/shared/domain/money';
import { parseDate } from '@/shared/domain/calendar-date';
import { amountInput } from '@/shared/presentation/money-format';
import { AppInput, ActionButton } from '@/shared/presentation/controls';
import { FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';

/** Owns unsaved month fields while durable records remain behind application operations.
 * @param props Loaded estimates and explicit save, edit, and month-switch capabilities.
 * @param props.version Plan and original revision used to reject stale saves.
 * @param props.categories Active and archived category labels.
 * @param props.profile Confirmed currency and display locale.
 * @param props.service Validated budget mutation boundary.
 * @param props.onSaved Reloads the committed projection.
 * @param props.onOpenMonth Opens a validated month after discarding any local draft.
 * @param props.onEditCategory Opens metadata editing after budget drafts are resolved.
 * @param props.onPreview Opens decision support for the saved plan after resolving drafts.
 * @param props.onDirtyChange Reports draft ownership to the focus refresh coordinator.
 * @param props.staleDraft Whether source changes require explicit draft disposal and reload.
 * @returns One virtualized keyboard-aware scroll owner for monthly estimates.
 */
export const BudgetForm = ({
  version,
  categories,
  profile,
  service,
  onSaved,
  onOpenMonth,
  onEditCategory,
  onPreview,
  onDirtyChange,
  staleDraft = false,
}: {
  version: PlanVersion;
  categories: readonly Category[];
  profile: Profile;
  service: BudgetService;
  onSaved: () => void;
  onOpenMonth: (month: string) => void;
  onEditCategory: (category: Category | null) => void;
  onPreview?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  staleDraft?: boolean;
}) => {
  const theme = useTheme();
  const rows = categories.filter(
    (category) =>
      !category.archived || version.plan.limits.some((limit) => limit.categoryId === category.id),
  );
  const originalIncome = amountInput(version.plan.plannedIncome, profile.currency, profile.locale);
  /** Resolves an existing limit or a legal zero for an unplanned category.
   * @param id Stable category identity.
   * @returns Exact locale-decimal initial input.
   */
  const originalLimit = (id: string) =>
    amountInput(
      version.plan.limits.find((limit) => limit.categoryId === id)?.amount ?? 0,
      profile.currency,
      profile.locale,
    );
  const [income, setIncome] = useState(originalIncome);
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((category) => [category.id, originalLimit(category.id)])),
  );
  const [month, setMonth] = useState(version.plan.month);
  const [monthError, setMonthError] = useState('');
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const operation = useOperation();
  const dirty =
    income !== originalIncome ||
    rows.some((category) => limits[category.id] !== originalLimit(category.id));
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  /** Clears local edits without mutating the saved plan. */
  const discard = () => {
    setIncome(originalIncome);
    setLimits(
      Object.fromEntries(rows.map((category) => [category.id, originalLimit(category.id)])),
    );
    operation.clearMessage();
  };
  /** Opens a valid calendar month only after any unsaved edits are explicitly discarded. */
  const openMonth = () => {
    if (!/^\d{4}-\d{2}$/.test(month) || !parseDate(month + '-01').ok) {
      setMonthError('Use a calendar month in YYYY-MM format.');
      return;
    }
    setMonthError('');
    if (dirty) setPendingMonth(month);
    else onOpenMonth(month);
  };
  /** Parses exact minor units before saving against the original data revision. */
  const save = () => {
    operation.run(async () => {
      const parsedIncome = parseAmount(income, profile.currency, profile.locale);
      if (!parsedIncome.ok) return parsedIncome;
      const nextLimits: { categoryId: string; amount: number }[] = [];
      for (const category of rows) {
        const parsed = parseAmount(limits[category.id] ?? '', profile.currency, profile.locale);
        if (!parsed.ok) return parsed;
        nextLimits.push({ categoryId: category.id, amount: parsed.value });
      }
      return await service.savePlan({
        plan: { month: version.plan.month, plannedIncome: parsedIncome.value, limits: nextLimits },
        expectedRevision: version.revision,
      });
    }, onSaved);
  };
  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView behavior="height" style={styles.fill}>
        <FlatList
          data={rows}
          keyExtractor={(category) => category.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.section}>
              <Text variant="headlineMedium">Monthly plan</Text>
              <Text>
                Estimates for {version.plan.month}. Saving one month keeps every other month
                independent.
              </Text>
              <AppInput
                label="Planning month"
                accessibilityLabel="Planning month"
                value={month}
                onChangeText={setMonth}
                placeholder="YYYY-MM"
                maxLength={7}
                disabled={operation.busy}
              />
              <ActionButton mode="outlined" onPress={openMonth} disabled={operation.busy}>
                Open month
              </ActionButton>
              <FormMessage message={monthError} />
              <AppInput
                label={`Planned income (${profile.currency.code})`}
                accessibilityLabel={`Planned income (${profile.currency.code})`}
                value={income}
                onChangeText={setIncome}
                keyboardType="decimal-pad"
                maxLength={40}
                disabled={operation.busy}
              />
              <Text variant="titleLarge">Category limits</Text>
              <Text>Enter amounts without grouping separators. Zero is a valid limit.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.section}>
              <Text variant="titleMedium">
                {item.name}
                {item.archived ? ' · archived' : ''}
              </Text>
              <Text>{item.kind === 'essential' ? 'Essential' : 'Flexible'}</Text>
              <AppInput
                label={`${item.name} limit (${profile.currency.code})`}
                accessibilityLabel={`${item.name} limit (${profile.currency.code})`}
                keyboardType="decimal-pad"
                maxLength={40}
                value={limits[item.id] ?? ''}
                onChangeText={(text) => setLimits((current) => ({ ...current, [item.id]: text }))}
                disabled={operation.busy}
              />
              <ActionButton
                accessibilityLabel={`Edit category ${item.name}`}
                disabled={dirty || operation.busy}
                onPress={() => onEditCategory(item)}
              >
                Edit category
              </ActionButton>
            </View>
          )}
          ListEmptyComponent={<Text>Add a category to plan essential and flexible spending.</Text>}
          ListFooterComponent={
            <View style={styles.section}>
              {dirty ? <Text>Save or discard budget edits before changing categories.</Text> : null}
              <ActionButton
                mode="outlined"
                disabled={dirty || operation.busy}
                onPress={() => onEditCategory(null)}
              >
                Add category
              </ActionButton>
              <FormMessage message={operation.message} />
              {staleDraft ? (
                <>
                  <Text>Your data changed. Discard this draft and reload before saving.</Text>
                  <ActionButton
                    onPress={() =>
                      dirty ? setPendingMonth(version.plan.month) : onOpenMonth(version.plan.month)
                    }
                  >
                    Reload changed plan
                  </ActionButton>
                </>
              ) : null}
              <ActionButton
                mode="contained"
                onPress={save}
                loading={operation.busy}
                disabled={operation.busy || staleDraft}
              >
                Save budget
              </ActionButton>
              <ActionButton onPress={discard} disabled={!dirty || operation.busy}>
                Discard edits
              </ActionButton>
              {onPreview ? (
                <>
                  <Text>Save or discard edits before previewing goal allocations.</Text>
                  <ActionButton
                    mode="outlined"
                    onPress={onPreview}
                    disabled={dirty || operation.busy}
                  >
                    Preview goal allocations
                  </ActionButton>
                </>
              ) : null}
            </View>
          }
        />
      </KeyboardAvoidingView>
      <AppDialog visible={pendingMonth !== null} onDismiss={() => setPendingMonth(null)}>
        <Dialog.Title>Discard unsaved edits?</Dialog.Title>
        <Dialog.Content style={styles.section}>
          <Text>Your saved plan stays unchanged. Open {pendingMonth} and discard this draft?</Text>
          <ActionButton
            mode="contained"
            onPress={() => {
              if (pendingMonth) onOpenMonth(pendingMonth);
              setPendingMonth(null);
            }}
          >
            Discard and open
          </ActionButton>
          <ActionButton onPress={() => setPendingMonth(null)}>Keep editing</ActionButton>
        </Dialog.Content>
      </AppDialog>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 24, gap: 24 },
  section: { gap: 16 },
});
