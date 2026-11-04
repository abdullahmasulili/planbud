import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import type { Profile } from '@/domains/settings/application/public';
import { formatMoney } from '@/shared/presentation/money-format';
import type { BudgetOverview } from '../application/overview-service';

/** Summarizes the selected month's actual category spending, with exact text equivalents.
 * @param props Consistent overview and confirmed display profile.
 * @param props.data Source-derived monthly totals; goal contributions are excluded.
 * @param props.profile Currency and locale used for amounts and shares.
 * @returns A donut and largest-first category legend, or an actionable zero-spending state.
 */
export const SpendingSummary = ({ data, profile }: { data: BudgetOverview; profile: Profile }) => {
  const theme = useTheme();
  const categories = data.categories
    .filter((row) => row.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const colors = [
    theme.colors.primary,
    theme.colors.tertiary,
    theme.colors.secondary,
    theme.colors.outline,
  ];
  const circumference = 2 * Math.PI * 80;
  const segments: ((typeof categories)[number] & {
    share: number;
    offset: number;
    color: string;
  })[] = [];
  let offset = 0;
  for (const [index, category] of categories.entries()) {
    const share = category.spent / data.actualSpending;
    segments.push({
      ...category,
      share,
      offset,
      color: colors[index % colors.length] ?? theme.colors.primary,
    });
    offset += share * circumference;
  }
  return (
    <Card mode="outlined">
      <Card.Content style={styles.content}>
        <Text variant="titleLarge">Spending by category</Text>
        <View
          style={styles.donut}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width="100%" height="100%" viewBox="0 0 200 200">
            <Circle
              testID="spending-track"
              cx={100}
              cy={100}
              r={80}
              stroke={theme.colors.outlineVariant}
              strokeWidth={24}
              fill="none"
            />
            {segments.map((segment) => (
              <Circle
                testID="spending-segment"
                key={segment.id}
                cx={100}
                cy={100}
                r={80}
                stroke={segment.color}
                strokeWidth={24}
                fill="none"
                strokeDasharray={[segment.share * circumference, circumference]}
                strokeDashoffset={-segment.offset}
                rotation={-90}
                origin="100, 100"
              />
            ))}
          </Svg>
        </View>
        <View style={styles.total}>
          <Text variant="bodyMedium">Total spent</Text>
          <Text variant="headlineSmall">
            {formatMoney(data.actualSpending, profile.currency, profile.locale)}
          </Text>
        </View>
        {segments.length === 0 ? (
          <Text>
            No spending this month. Record an expense in Transactions to see your breakdown.
          </Text>
        ) : (
          segments.map((segment) => (
            <View key={segment.id} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: segment.color }]} />
              <View style={styles.category}>
                <Text variant="titleSmall">{segment.name}</Text>
                <Text variant="bodyMedium">
                  {formatMoney(segment.spent, profile.currency, profile.locale)} ·{' '}
                  {new Intl.NumberFormat(profile.locale, {
                    style: 'percent',
                    maximumFractionDigits: 1,
                  }).format(segment.share)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  content: { gap: 16 },
  donut: { width: 200, maxWidth: '100%', aspectRatio: 1, alignSelf: 'center' },
  total: { alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  category: { flex: 1, gap: 4 },
});
