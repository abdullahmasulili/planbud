import { useCallback, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Card, Dialog, Snackbar, Text, useTheme } from 'react-native-paper';
import { useStore } from 'zustand';
import type { Profile } from '@/domains/settings/application/public';
import type { NamedPlan, NamedPlanService } from '../application/public';
import { summarizeNamedPlan } from '../application/public';
import type { createNamedPlanStore } from './named-plan-store';
import { NamedPlanForm } from './named-plan-form';
import { AppDialog } from '@/shared/presentation/dialog';
import { BudgetGauge } from '@/shared/presentation/charts';
import { ActionButton } from '@/shared/presentation/controls';
import { FormMessage } from '@/shared/presentation/screen';
import { formatMoney } from '@/shared/presentation/money-format';
import { launchOperation } from '@/shared/presentation/operation-launcher';
import { useOperation } from '@/shared/presentation/use-operation';

/** Presents independent planning estimates with explicit create/edit/delete and refresh states.
 * @param props Stable capabilities, scoped projections, and profile formatting.
 * @param props.profile Confirmed currency and locale.
 * @param props.service Revision-checked source mutations.
 * @param props.store Provider-owned named-plan projections.
 * @param props.newId Generates stable new plan and expense identities.
 * @returns Virtualized plan cards and guarded editors, without changing actual activity.
 */
export const NamedPlansScreen = ({
  profile,
  service,
  store,
  newId,
}: {
  profile: Profile;
  service: NamedPlanService;
  store: ReturnType<typeof createNamedPlanStore>;
  newId: () => string;
}) => {
  const theme = useTheme();
  const version = useStore(store, (state) => state.version);
  const status = useStore(store, (state) => state.status);
  const message = useStore(store, (state) => state.message);
  const [editing, setEditing] = useState<{ plan: NamedPlan | null; revision: number } | null>(null);
  const [deleting, setDeleting] = useState<{ plan: NamedPlan; revision: number } | null>(null);
  const [notice, setNotice] = useState('');
  const operation = useOperation();
  const cancel = useRef<(() => void) | undefined>(undefined);
  /** Loads the current projection through the observed terminal async boundary. */
  const load = useCallback(() => {
    cancel.current?.();
    cancel.current = launchOperation(
      async () => await store.getState().load(),
      () => store.setState({ status: 'error', message: 'Unable to load your plans. Try again.' }),
    );
  }, [store]);
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        cancel.current?.();
        store.getState().reset();
      };
    }, [load, store]),
  );
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={version?.plans ?? []}
        keyExtractor={(plan) => plan.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.section}>
            <Text variant="headlineMedium">Your plans</Text>
            <Text>
              Make room for a vacation, a celebration, or your next project. Each plan has its own
              funding and expense estimates.
            </Text>
            <Text variant="bodySmall">
              Estimates only · separate from monthly income, transactions, and goal allocations.
            </Text>
            <ActionButton
              mode="contained"
              disabled={!version || status === 'loading'}
              onPress={() => {
                if (version) setEditing({ plan: null, revision: version.revision });
              }}
            >
              New plan
            </ActionButton>
            <FormMessage message={message} />
            {status === 'loading' ? (
              <ActivityIndicator accessibilityLabel="Loading named plans" />
            ) : null}
            <ActionButton onPress={load} disabled={status === 'loading'}>
              Reload plans
            </ActionButton>
          </View>
        }
        renderItem={({ item }) => {
          const totals = summarizeNamedPlan(item);
          return (
            <Card mode="outlined">
              <Card.Content style={styles.section}>
                <Text variant="titleLarge">{item.name}</Text>
                <Text>Funding {formatMoney(item.funding, profile.currency, profile.locale)}</Text>
                <BudgetGauge
                  label="Funding allocated"
                  value={totals.allocated}
                  limit={item.funding}
                />
                <Text>
                  Expense estimates{' '}
                  {formatMoney(totals.allocated, profile.currency, profile.locale)}
                </Text>
                <Text
                  style={{
                    color:
                      totals.remaining < 0 ? theme.colors.error : theme.colors.onSurfaceVariant,
                  }}
                >
                  {totals.remaining < 0 ? 'Overallocated by' : 'Unallocated'}{' '}
                  {formatMoney(Math.abs(totals.remaining), profile.currency, profile.locale)}
                </Text>
                <Text variant="titleMedium">Expense breakdown</Text>
                {item.items.slice(0, 3).map((expense) => (
                  <View key={expense.id} style={{ gap: 4 }}>
                    <Text>{expense.name}</Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {formatMoney(expense.amount, profile.currency, profile.locale)}
                    </Text>
                  </View>
                ))}
                <Text variant="bodySmall">
                  {item.items.length > 3
                    ? `${item.items.length - 3} more estimates · edit to review all`
                    : item.items.length === 0
                      ? 'Add expenses to build your plan.'
                      : 'Planning estimates only'}
                </Text>
                <ActionButton
                  mode="outlined"
                  accessibilityLabel={`Edit ${item.name}`}
                  disabled={status === 'loading'}
                  onPress={() => {
                    if (version) setEditing({ plan: item, revision: version.revision });
                  }}
                >
                  Edit plan
                </ActionButton>
                <ActionButton
                  textColor={theme.colors.error}
                  accessibilityLabel={`Delete ${item.name}`}
                  disabled={status === 'loading'}
                  onPress={() => {
                    operation.clearMessage();
                    if (version) setDeleting({ plan: item, revision: version.revision });
                  }}
                >
                  Delete plan
                </ActionButton>
              </Card.Content>
            </Card>
          );
        }}
        ListEmptyComponent={
          status === 'ready' ? (
            <Card mode="outlined">
              <Card.Content style={styles.section}>
                <Text variant="titleLarge">No named plans yet</Text>
                <Text>
                  Create a plan, set its funding, and add expense estimates to see what fits.
                </Text>
              </Card.Content>
            </Card>
          ) : undefined
        }
      />
      {editing ? (
        <NamedPlanForm
          initial={editing.plan}
          revision={editing.revision}
          profile={profile}
          newId={newId}
          onSave={service.save}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice('Plan saved');
            load();
          }}
        />
      ) : null}
      {deleting ? (
        <AppDialog
          visible
          onDismiss={() => {
            if (!operation.busy) setDeleting(null);
          }}
          dismissable={!operation.busy}
          style={{ maxHeight: '90%' }}
        >
          <Dialog.ScrollArea>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingVertical: 24, gap: 16 }}
            >
              <Text variant="titleLarge" accessibilityRole="header">
                Delete {deleting.plan.name}?
              </Text>
              <Text>
                This removes this plan and its expense estimates. Monthly budgets, transactions, and
                goals stay unchanged.
              </Text>
              <FormMessage message={operation.message} />
              <ActionButton disabled={operation.busy} onPress={() => setDeleting(null)}>
                Keep plan
              </ActionButton>
              <ActionButton
                mode="contained"
                buttonColor={theme.colors.error}
                textColor={theme.colors.onError}
                loading={operation.busy}
                disabled={operation.busy}
                onPress={() =>
                  operation.run(
                    async () =>
                      await service.remove({
                        id: deleting.plan.id,
                        expectedRevision: deleting.revision,
                      }),
                    () => {
                      setDeleting(null);
                      setNotice('Plan deleted');
                      load();
                    },
                  )
                }
              >
                Delete plan
              </ActionButton>
            </ScrollView>
          </Dialog.ScrollArea>
        </AppDialog>
      ) : null}
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={3000}>
        {notice}
      </Snackbar>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 24, gap: 24 },
  section: { gap: 16 },
});
