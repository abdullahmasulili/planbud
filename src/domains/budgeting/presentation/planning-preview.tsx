import { FlatList, View } from 'react-native';
import { useStore } from 'zustand';
import { Checkbox, Dialog, Text } from 'react-native-paper';
import { AppDialog } from '@/shared/presentation/dialog';
import type { Profile } from '@/domains/settings/application/public';
import type { createPlanningStore } from './planning-store';
import { formatMoney } from '@/shared/presentation/money-format';
import { ActionButton } from '@/shared/presentation/controls';
import { FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';

/** Presents deterministic estimates and a separate review step for selected flexible adjustments.
 * @param props Confirmed profile, scoped review state, labels, and implemented navigation.
 * @param props.profile Currency and locale used for visible minor-unit calculations.
 * @param props.store Scoped disposable preview state.
 * @param props.categoryNames Labels from published budget projections.
 * @param props.goalNames Labels from published goal projections.
 * @param props.onClose Cancels and disposes the review session.
 * @param props.onApplied Refreshes durable monthly estimates after an explicit apply.
 * @param props.onGoals Opens existing target, deadline and priority editing.
 * @returns Virtualized review rows with amounts, shortfalls and explanatory formulas.
 */
export const PlanningPreviewDialog = ({
  profile,
  store,
  categoryNames,
  goalNames,
  onClose,
  onApplied,
  onGoals,
}: {
  profile: Profile;
  store: ReturnType<typeof createPlanningStore>;
  categoryNames: readonly { readonly id: string; readonly name: string }[];
  goalNames: readonly { readonly id: string; readonly name: string }[];
  onClose: () => void;
  onApplied: () => void;
  onGoals: () => void;
}) => {
  const preview = useStore(store, (state) => state.preview);
  const suggestions = useStore(store, (state) => state.suggestions);
  const selected = useStore(store, (state) => state.selected);
  const reviewed = useStore(store, (state) => state.reviewed);
  const message = useStore(store, (state) => state.message);
  const operation = useOperation();
  /** Formats exact amounts consistently with the confirmed currency.
   * @param amount Minor-unit amount.
   * @returns Localized currency text.
   */
  const money = (amount: number) => formatMoney(amount, profile.currency, profile.locale);
  return (
    <AppDialog
      visible
      dismissable={!operation.busy}
      onDismiss={onClose}
      style={{ maxHeight: '90%' }}
    >
      <Dialog.Title>Planning preview</Dialog.Title>
      <Dialog.ScrollArea style={{ minHeight: 180, maxHeight: 600 }}>
        <FlatList
          data={preview?.allocations ?? []}
          keyExtractor={(row) => row.goalId}
          contentContainerStyle={{ paddingVertical: 16, gap: 24 }}
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              <Text>
                Estimates for {preview?.month}. These allocations do not increase actual savings or
                guarantee deadlines.
              </Text>
              <Text>
                Capacity: {money(preview?.capacity ?? 0)} · deficit: {money(preview?.deficit ?? 0)}
              </Text>
              <FormMessage message={message || operation.message} />
              {suggestions.length ? (
                <Text>Optional flexible-limit reductions. Essential limits are protected.</Text>
              ) : null}
              {suggestions.map((edit) => {
                const label = `Set ${categoryNames.find((item) => item.id === edit.categoryId)?.name ?? edit.categoryId} limit to ${money(edit.amount)}`;
                return (
                  <Checkbox.Item
                    key={edit.categoryId}
                    label={label}
                    labelMaxFontSizeMultiplier={0}
                    status={
                      selected.some((item) => item.categoryId === edit.categoryId)
                        ? 'checked'
                        : 'unchecked'
                    }
                    disabled={operation.busy}
                    onPress={() => store.getState().toggle(edit)}
                  />
                );
              })}
              <ActionButton
                mode="outlined"
                disabled={operation.busy}
                onPress={() => operation.run(store.getState().review, () => undefined)}
              >
                Preview selected adjustments
              </ActionButton>
              {!reviewed ? <Text>Review the changed selection before applying.</Text> : null}
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ gap: 8 }}>
              <Text variant="titleMedium">
                {goalNames.find((goal) => goal.id === item.goalId)?.name ?? item.goalId}
              </Text>
              <Text>Required {money(item.requested)}</Text>
              <Text>
                Proposed {money(item.allocated)} · gap {money(item.gap)}
              </Text>
              {item.reasons.map((reason) => (
                <Text key={reason}>{reason}</Text>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <Text>
              No eligible goal allocation. Add an active goal or review its deadline and monthly
              amount.
            </Text>
          }
          ListFooterComponent={
            <View style={{ gap: 16 }}>
              <ActionButton onPress={onGoals} disabled={operation.busy}>
                Edit goals, priorities or deadlines
              </ActionButton>
              <ActionButton
                mode="contained"
                disabled={!reviewed || !preview || operation.busy}
                loading={operation.busy}
                onPress={() => operation.run(store.getState().apply, onApplied)}
              >
                Apply reviewed plan
              </ActionButton>
              <ActionButton onPress={onClose} disabled={operation.busy}>
                Cancel preview
              </ActionButton>
            </View>
          }
        />
      </Dialog.ScrollArea>
    </AppDialog>
  );
};
