import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import { useI18n } from './i18n';

/** Shows a semicircular measure with a clamped visual fill and truthful text for zero/over-limit states.
 * @param props Nonnegative canonical amounts in matching units and an accessible measure label.
 * @param props.label Meaning of the measure, such as spending used or funding allocated.
 * @param props.value Source-derived amount already used or allocated.
 * @param props.limit Planned limit or available funding; zero has no defined percentage.
 * @returns Static native gauge with scalable text and a screen-reader progress equivalent.
 */
export const BudgetGauge = ({
  label,
  value,
  limit,
}: {
  label: string;
  value: number;
  limit: number;
}) => {
  const { t } = useI18n();
  const theme = useTheme();
  const fraction = limit > 0 ? value / limit : value > 0 ? 1 : 0;
  const fill = Math.max(0, Math.min(1, fraction));
  const text =
    limit > 0 ? `${Math.round(fraction * 100)}%` : t(value > 0 ? 'No limit set' : 'Not allocated');
  const color = value > limit ? theme.colors.error : theme.colors.primary;
  return (
    <View style={styles.gaugeGroup}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fill * 100), text }}
        style={styles.arc}
      >
        <Svg width="100%" height="100%" viewBox="0 0 240 132" accessible={false}>
          <Path
            d="M 20 120 A 100 100 0 0 1 220 120"
            stroke={theme.colors.outlineVariant}
            strokeWidth={18}
            strokeLinecap="round"
            fill="none"
          />
          {fill > 0 ? (
            <Path
              d="M 20 120 A 100 100 0 0 1 220 120"
              stroke={color}
              strokeWidth={18}
              strokeLinecap="round"
              strokeDasharray={[Math.PI * 100, Math.PI * 100]}
              strokeDashoffset={Math.PI * 100 * (1 - fill)}
              fill="none"
            />
          ) : null}
        </Svg>
      </View>
      <Text variant="headlineMedium" style={{ color, textAlign: 'center' }}>
        {text}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
      >
        {label}
      </Text>
    </View>
  );
};

/** One labeled chart measure with an exact formatted equivalent. */
type Measure = { readonly label: string; readonly value: number; readonly formatted: string };

/** Compares two amounts on one local scale without hiding zero values or overflowing the track.
 * @param props Comparison meaning and exact amount labels in the profile currency.
 * @param props.label Accessible group label.
 * @param props.first Baseline estimate or target.
 * @param props.second Recorded or allocated amount.
 * @param props.overLimit Whether excess should use the error role; income comparisons are neutral.
 * @returns Labeled horizontal bars that remain readable without color or vision.
 */
export const ComparisonChart = ({
  label,
  first,
  second,
  overLimit = false,
}: {
  label: string;
  first: Measure;
  second: Measure;
  overLimit?: boolean;
}) => {
  const theme = useTheme();
  const maximum = Math.max(first.value, second.value, 1);
  return (
    <View accessibilityLabel={label} style={styles.comparison}>
      {[first, second].map((measure, index) => (
        <View key={measure.label} style={styles.measure}>
          <Text variant="bodyMedium">
            {measure.label} · {measure.formatted}
          </Text>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <View
              style={[
                styles.bar,
                {
                  width: `${(measure.value / maximum) * 100}%`,
                  backgroundColor:
                    index === 0
                      ? theme.colors.outline
                      : overLimit && second.value > first.value
                        ? theme.colors.error
                        : theme.colors.primary,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};
const styles = StyleSheet.create({
  gaugeGroup: { alignItems: 'center', gap: 4 },
  arc: { width: 240, maxWidth: '100%', aspectRatio: 240 / 132 },
  comparison: { gap: 12 },
  measure: { gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
});
