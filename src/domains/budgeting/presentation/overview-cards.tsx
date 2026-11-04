import { useI18n } from '@/shared/presentation/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import type { BudgetOverview } from '../application/overview-service';
import type { Profile } from '@/domains/settings/application/public';
import { BudgetGauge, ComparisonChart } from '@/shared/presentation/charts';
import { formatMoney } from '@/shared/presentation/money-format';
import { SpendingSummary } from './spending-summary';

/** Groups monthly source comparisons around the remaining-spending decision.
 * @param props Consistent overview and confirmed profile formatting.
 * @param props.data Derived estimates and actual activity for one calendar month.
 * @param props.profile Confirmed currency and display locale.
 * @returns A spending gauge and labeled financial comparison cards, with exact amounts.
 */
export const OverviewCards = ({ data, profile }: { data: BudgetOverview; profile: Profile }) => {
  const { t } = useI18n();
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
            {data.remainingSpending < 0
              ? t('Over planned spending')
              : t('Remaining planned spending')}
          </Text>
          <Text variant="headlineLarge" style={{ color: theme.colors.onPrimaryContainer }}>
            {money(Math.abs(data.remainingSpending))}
          </Text>
          <BudgetGauge
            label={t('Spending used')}
            value={data.actualSpending}
            limit={data.plannedSpending}
          />
          <Text style={{ color: theme.colors.onPrimaryContainer }}>
            {t('Spent')} {money(data.actualSpending)} {t('of')} {money(data.plannedSpending)}
          </Text>
          {data.plannedSpending === 0 ? (
            <Text style={{ color: theme.colors.onPrimaryContainer }}>
              {t('Set category limits in Plan to compare your spending.')}
            </Text>
          ) : null}
        </Card.Content>
      </Card>
      <SpendingSummary data={data} profile={profile} />
      <Card mode="outlined">
        <Card.Content style={styles.content}>
          <Text variant="titleLarge">{t('Income')}</Text>
          <ComparisonChart
            label={t('Income comparison')}
            first={{
              label: t('Planned income'),
              value: data.plannedIncome,
              formatted: money(data.plannedIncome),
            }}
            second={{
              label: t('Recorded income'),
              value: data.actualIncome,
              formatted: money(data.actualIncome),
            }}
          />
        </Card.Content>
      </Card>
      <Card mode="outlined">
        <Card.Content style={styles.content}>
          <Text variant="titleLarge">{t('Spending')}</Text>
          <ComparisonChart
            label={t('Spending comparison')}
            first={{
              label: t('Spending limits'),
              value: data.plannedSpending,
              formatted: money(data.plannedSpending),
            }}
            second={{
              label: t('Recorded spending'),
              value: data.actualSpending,
              formatted: money(data.actualSpending),
            }}
            overLimit
          />
          <Text variant="bodySmall">
            {t(
              'Estimates change when you save a plan. Goal contributions are separate earmarking records.',
            )}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
};
const styles = StyleSheet.create({ group: { gap: 16 }, content: { gap: 16 } });
