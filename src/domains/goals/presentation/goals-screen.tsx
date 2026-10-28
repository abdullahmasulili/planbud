import { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Card, Dialog, List, Text, useTheme } from 'react-native-paper';
import { ComparisonChart } from '@/shared/presentation/charts';
import { AppDialog } from '@/shared/presentation/dialog';
import { useStore } from 'zustand';
import type { Profile } from '@/domains/settings/application/public';
import type { Goal, Contribution } from '../application/public';
import type { createGoalStore } from './goal-store';
import { GoalForm } from './goal-form';
import { ContributionForm } from './contribution-form';
import { ActionButton } from '@/shared/presentation/controls';
import { FormMessage } from '@/shared/presentation/screen';
import { formatMoney } from '@/shared/presentation/money-format';
import { launchOperation } from '@/shared/presentation/operation-launcher';

/** Presents actual savings and preserved histories across active, completed and archived goals.
 * @param props Scoped projections and confirmed profile capabilities.
 * @param props.profile Currency and locale used for accessible progress amounts.
 * @param props.store Provider-owned replaceable goal projections.
 * @param props.today Local date suggested for new contributions.
 * @param props.newId Supplies stable action/record identities.
 * @returns Virtualized goals and history, with complete metadata and contribution editing.
 */
export const GoalsScreen = ({
  profile,
  store,
  today,
  newId,
}: {
  profile: Profile;
  store: ReturnType<typeof createGoalStore>;
  today: string;
  newId: () => string;
}) => {
  const theme = useTheme();
  const goals = useStore(store, (state) => state.goals);
  const status = useStore(store, (state) => state.status);
  const message = useStore(store, (state) => state.message);
  const [editing, setEditing] = useState<{ goal: Goal | null } | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [contribution, setContribution] = useState<{
    goalId: string;
    record: Contribution | null;
  } | null>(null);
  const cancel = useRef<(() => void) | undefined>(undefined);
  /** Loads the current goal projection through an observed async boundary. */
  const load = useCallback(() => {
    cancel.current?.();
    cancel.current = launchOperation(
      async () => await store.getState().load(),
      () => store.setState({ status: 'error', message: 'Unable to load goals. Try again.' }),
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
  const history = goals.find((goal) => goal.id === historyId);
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={goals}
        keyExtractor={(goal) => goal.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.section}>
            <Text variant="headlineMedium">Goals</Text>
            <Text>Actual savings equal starting savings plus recorded contributions.</Text>
            <FormMessage message={message} />
            <ActionButton mode="outlined" disabled={status === 'loading'} onPress={load}>
              Reload goals
            </ActionButton>
          </View>
        }
        renderItem={({ item }) => (
          <Card mode="outlined">
            <Card.Content style={styles.section}>
              <Text variant="titleLarge">{item.name}</Text>
              <Text>
                {item.priority} priority · {item.state}
                {item.overdue ? ' · overdue' : ''}
                {item.deadline ? ` · due ${item.deadline}` : ' · no deadline'}
              </Text>
              <Text
                accessibilityLabel={`Saved ${formatMoney(item.saved, profile.currency, profile.locale)} of target ${formatMoney(item.target, profile.currency, profile.locale)}. Remaining ${formatMoney(item.remaining, profile.currency, profile.locale)}.`}
              >
                Saved {formatMoney(item.saved, profile.currency, profile.locale)} of{' '}
                {formatMoney(item.target, profile.currency, profile.locale)}
                {'\n'}Remaining {formatMoney(item.remaining, profile.currency, profile.locale)}
              </Text>
              <ComparisonChart
                label={`${item.name} savings`}
                first={{
                  label: 'Target',
                  value: item.target,
                  formatted: formatMoney(item.target, profile.currency, profile.locale),
                }}
                second={{
                  label: 'Saved',
                  value: item.saved,
                  formatted: formatMoney(item.saved, profile.currency, profile.locale),
                }}
              />
              <ActionButton
                onPress={() => setEditing({ goal: item })}
                accessibilityLabel={`Edit goal ${item.name}`}
              >
                Edit goal
              </ActionButton>
              <ActionButton
                mode="outlined"
                onPress={() => setContribution({ goalId: item.id, record: null })}
                accessibilityLabel={`Add contribution to ${item.name}`}
              >
                Add contribution
              </ActionButton>
              <ActionButton
                onPress={() => setHistoryId(item.id)}
                accessibilityLabel={`Contribution history for ${item.name}`}
              >
                Contribution history ({item.contributions.length})
              </ActionButton>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          status === 'loading' ? (
            <ActivityIndicator accessibilityLabel="Loading goals" />
          ) : (
            <Text>No goals yet. Create a goal to see progress and inform your monthly plan.</Text>
          )
        }
      />
      <View style={styles.action}>
        <ActionButton mode="contained" onPress={() => setEditing({ goal: null })}>
          New goal
        </ActionButton>
      </View>
      {editing ? (
        <GoalForm
          profile={profile}
          initial={editing.goal}
          newId={newId}
          onSave={store.getState().saveGoal}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {contribution ? (
        <ContributionForm
          profile={profile}
          goalId={contribution.goalId}
          initial={contribution.record}
          today={today}
          newId={newId}
          onSave={store.getState().saveContribution}
          onRemove={store.getState().removeContribution}
          onClose={() => setContribution(null)}
        />
      ) : null}
      {history ? (
        <AppDialog visible onDismiss={() => setHistoryId(null)} style={{ maxHeight: '85%' }}>
          <Dialog.Title>{history.name} · history</Dialog.Title>
          <Dialog.ScrollArea style={{ minHeight: 120, maxHeight: 400 }}>
            <FlatList
              data={history.contributions}
              keyExtractor={(record) => record.id}
              renderItem={({ item }) => (
                <List.Item
                  title={formatMoney(item.amount, profile.currency, profile.locale)}
                  description={item.date}
                  accessibilityLabel={`Edit contribution ${formatMoney(item.amount, profile.currency, profile.locale)} on ${item.date}`}
                  onPress={() => {
                    setContribution({ goalId: history.id, record: item });
                    setHistoryId(null);
                  }}
                />
              )}
              ListEmptyComponent={
                <Text>No recorded contributions. Starting savings remain separate.</Text>
              }
            />
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <ActionButton onPress={() => setHistoryId(null)}>Close history</ActionButton>
          </Dialog.Actions>
        </AppDialog>
      ) : null}
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 24, gap: 32 },
  section: { gap: 16 },
  action: { padding: 16 },
});
