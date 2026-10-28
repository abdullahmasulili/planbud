import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import type { BudgetOverview } from '../application/overview-service';
import type { Profile } from '@/domains/settings/application/public';
import { BudgetGauge, ComparisonChart } from '@/shared/presentation/charts';
import { formatMoney } from '@/shared/presentation/money-format';

/** Groups monthly source comparisons around the remaining-spending decision.
 * @param props Consistent overview and confirmed profile formatting.
 * @param props.data Derived estimates and actual activity for one calendar month.
 * @param props.profile Confirmed currency and display locale.
 * @returns A spending gauge and labeled financial comparison cards, with exact amounts.
 */
export const OverviewCards = ({ data, profile }: { data: BudgetOverview; profile: Profile }) => {
  const theme = useTheme();
  /** Formats canonical amounts in the confirmed currency.
   * @param amount Minor-unit amount.
   * @returns Exact localized display amount.
   */
  const money = (amount: number) => formatMoney(amount, profile.currency, profile.locale);
  return (
    <View style={styles.group}>
      <Card mode="contained" style={{ backgroundColor: theme.colors.primaryContainer }}>
        <Card.Content style={styles.content}>
          <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
            {data.remainingSpending < 0 ? 'Over planned spending' : 'Remaining planned spending'}
          </Text>
          <Text variant="headlineLarge" style={{ color: theme.colors.onPrimaryContainer }}>
            {money(Math.abs(data.remainingSpending))}
          </Text>
          <BudgetGauge
            label="Spending used"
            value={data.actualSpending}
            limit={data.plannedSpending}
          />
          <Text style={{ color: theme.colors.onPrimaryContainer }}>
            Spent {money(data.actualSpending)} of {money(data.plannedSpending)}
          </Text>
          {data.plannedSpending === 0 ? (
            <Text style={{ color: theme.colors.onPrimaryContainer }}>
              Set category limits in Plan to compare your spending.
            </Text>
          ) : null}
        </Card.Content>
      </Card>
      <Card mode="outlined">
        <Card.Content style={styles.content}>
          <Text variant="titleLarge">Income</Text>
          <ComparisonChart
            label="Income comparison"
            first={{
              label: 'Planned income',
              value: data.plannedIncome,
              formatted: money(data.plannedIncome),
            }}
            second={{
              label: 'Recorded income',
              value: data.actualIncome,
              formatted: money(data.actualIncome),
            }}
          />
        </Card.Content>
      </Card>
      <Card mode="outlined">
        <Card.Content style={styles.content}>
          <Text variant="titleLarge">Spending</Text>
          <ComparisonChart
            label="Spending comparison"
            first={{
              label: 'Spending limits',
              value: data.plannedSpending,
              formatted: money(data.plannedSpending),
            }}
            second={{
              label: 'Recorded spending',
              value: data.actualSpending,
              formatted: money(data.actualSpending),
            }}
            overLimit
          />
          <Text variant="bodySmall">
            Estimates change when you save a plan. Goal contributions are separate earmarking
            records.
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
};
const styles = StyleSheet.create({ group: { gap: 16 }, content: { gap: 16 } });
