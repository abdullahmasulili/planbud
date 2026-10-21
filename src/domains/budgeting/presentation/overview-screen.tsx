import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, List, Text, useTheme } from 'react-native-paper';
import type { BudgetService } from '../application/public';
import type { TransactionService } from '@/domains/transactions/application/public';
import type { Profile } from '@/domains/settings/application/public';
import { readOverview } from '../application/overview-service';
import type { BudgetOverview } from '../application/overview-service';
import { launchOperation } from '@/shared/presentation/operation-launcher';
import { AppInput, ActionButton } from '@/shared/presentation/controls';
import { FormMessage } from '@/shared/presentation/screen';
import { formatMoney } from '@/shared/presentation/money-format';
import { parseDate } from '@/shared/domain/calendar-date';
import type { GoalService } from '@/domains/goals/application/public';
import { readGoalAttention } from '../application/goal-attention';
import type { GoalAttention } from '../application/goal-attention';

/** Refreshes source-derived comparisons when returning from a financial editing tab.
 * @param props Narrow read capabilities, currency metadata, and implemented navigation actions.
 * @param props.profile Confirmed currency and locale.
 * @param props.budgets Published estimate and category reads.
 * @param props.transactions Published actual-summary read.
 * @param props.initialMonth First calendar month to inspect.
 * @param props.onPlan Opens the implemented monthly planner.
 * @param props.onSettings Opens settings and backup navigation.
 * @param props.goals Optional current source-progress read for attention labels.
 * @param props.onGoals Opens all goals and contribution history.
 * @returns Virtualized category comparisons without inventing historical amounts.
 */
export const OverviewScreen = ({
  profile,
  budgets,
  transactions,
  initialMonth,
  onPlan,
  onSettings,
  goals,
  onGoals,
}: {
  profile: Profile;
  budgets: Pick<BudgetService, 'readMonth' | 'readCategories'>;
  transactions: Pick<TransactionService, 'summary'>;
  initialMonth: string;
  onPlan: () => void;
  onSettings: () => void;
  goals?: Pick<GoalService, 'readGoals'>;
  onGoals?: () => void;
}) => {
  const theme = useTheme();
  const [month, setMonth] = useState(initialMonth);
  const [selection, setSelection] = useState({ month: initialMonth, attempt: 0 });
  const [data, setData] = useState<BudgetOverview | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const [attention, setAttention] = useState<GoalAttention | null>(null);
  const [goalMessage, setGoalMessage] = useState('');
  useFocusEffect(
    useCallback(
      () =>
        launchOperation(
          async (isActive) => {
            setBusy(true);
            setMessage('');
            setData(null);
            const [result, currentGoals] = await Promise.all([
              readOverview(selection.month, budgets, transactions),
              goals ? readGoalAttention(goals) : Promise.resolve(null),
            ]);
            if (!isActive()) return;
            setBusy(false);
            if (result.ok) setData(result.value);
            else setMessage(result.error.message);
            if (currentGoals?.ok) {
              setAttention(currentGoals.value);
              setGoalMessage('');
            } else if (currentGoals) {
              setAttention(null);
              setGoalMessage(currentGoals.error.message);
            }
          },
          () => {
            setBusy(false);
            setMessage('Unable to load this overview. Reopen the tab to try again.');
          },
        ),
      [budgets, goals, selection, transactions],
    ),
  );
  /** Changes the selected read month without modifying any source dates or estimates. */
  const openMonth = () => {
    if (!/^\d{4}-\d{2}$/.test(month) || !parseDate(month + '-01').ok) {
      setMessage('Use a calendar month in YYYY-MM format.');
      return;
    }
    setMessage('');
    setSelection((value) => ({ month, attempt: value.attempt + 1 }));
  };
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={data?.categories ?? []}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.section}>
            <Text variant="headlineMedium">Your month</Text>
            <Text>{profile.currency.code} · estimates and actual activity</Text>
            <AppInput
              label="Overview month"
              accessibilityLabel="Overview month"
              value={month}
              onChangeText={setMonth}
              maxLength={7}
              placeholder="YYYY-MM"
            />
            <ActionButton mode="outlined" onPress={openMonth} disabled={busy}>
              Open month
            </ActionButton>
            <FormMessage message={message} />
            {busy ? <ActivityIndicator accessibilityLabel="Loading overview" /> : null}
            {data ? (
              <>
                <Text variant="titleLarge">
                  {data.remainingSpending < 0
                    ? 'Over planned spending'
                    : 'Remaining planned spending'}
                </Text>
                <Text variant="headlineMedium">
                  {formatMoney(Math.abs(data.remainingSpending), profile.currency, profile.locale)}
                </Text>
                <Text>
                  Planned income:{' '}
                  {formatMoney(data.plannedIncome, profile.currency, profile.locale)}
                </Text>
                <Text>
                  Recorded income:{' '}
                  {formatMoney(data.actualIncome, profile.currency, profile.locale)}
                </Text>
                <Text>
                  Spending limits:{' '}
                  {formatMoney(data.plannedSpending, profile.currency, profile.locale)}
                </Text>
                <Text>
                  Recorded spending:{' '}
                  {formatMoney(data.actualSpending, profile.currency, profile.locale)}
                </Text>
                <Text>
                  Estimates change only when you save a plan. Goal contributions are separate
                  earmarking records.
                </Text>
              </>
            ) : null}
            <ActionButton mode="contained" onPress={onPlan}>
              Open plan
            </ActionButton>
            <ActionButton onPress={onSettings}>Settings</ActionButton>
            <Text variant="titleLarge">Categories</Text>
          </View>
        }
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            titleNumberOfLines={0}
            description={`Limit ${formatMoney(item.limit, profile.currency, profile.locale)} · spent ${formatMoney(item.spent, profile.currency, profile.locale)}\n${item.remaining < 0 ? 'Over by' : 'Remaining'} ${formatMoney(Math.abs(item.remaining), profile.currency, profile.locale)}`}
            descriptionNumberOfLines={0}
          />
        )}
        ListEmptyComponent={
          !busy && !message ? (
            <Text>
              No category plan or spending for this month. Open Plan to set your estimates.
            </Text>
          ) : undefined
        }
        ListFooterComponent={
          goals && onGoals ? (
            <View style={styles.section}>
              <Text variant="titleLarge">Goals needing attention today</Text>
              <FormMessage message={goalMessage} />
              {attention?.goals.map((goal) => (
                <View key={goal.id} style={{ gap: 8 }}>
                  <Text variant="titleMedium">
                    {goal.name}
                    {goal.overdue ? ' · overdue' : ''}
                  </Text>
                  <Text>
                    Saved {formatMoney(goal.saved, profile.currency, profile.locale)} of{' '}
                    {formatMoney(goal.target, profile.currency, profile.locale)} · remaining{' '}
                    {formatMoney(goal.remaining, profile.currency, profile.locale)}
                  </Text>
                </View>
              ))}
              {attention?.count === 0 ? (
                <Text>
                  No active incomplete goals. Create or reopen a goal to inform your plan.
                </Text>
              ) : null}
              <ActionButton onPress={onGoals}>
                View all goals{attention ? ` (${attention.count} active incomplete)` : ''}
              </ActionButton>
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 24, gap: 16 },
  section: { gap: 16 },
});
