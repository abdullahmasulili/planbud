import { useEffect, useState } from 'react';
import { BackHandler, FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Menu, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useI18n } from '@/shared/presentation/i18n';
import { PhosphorIcon } from '@/shared/presentation/phosphor-icon';
import names from './currency-names.json';

const currencyNames: Readonly<Record<string, string>> = names;
const codes = Object.keys(currencyNames).sort();

/** Selects a supported currency offline, with a full name and no editable code.
 * @param props Current draft currency and selection handler.
 * @param props.value Supported currency code.
 * @param props.onChange Receives the selected code, including reselection.
 * @returns An outlined dropdown with scalable, virtualized options and dismissal support.
 */
export const CurrencyPicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const label = `${value} - ${currencyNames[value]}`;
  useEffect(() => {
    if (!open) return;
    // Paper dismisses its menu without consuming Back; keep onboarding on this step.
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => back.remove();
  }, [open]);
  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      overlayAccessibilityLabel={t('Close currency picker')}
      anchorPosition="bottom"
      contentStyle={{ width: width - 48, height: Math.min(320, height * 0.4) }}
      anchor={
        <TouchableRipple
          accessibilityRole="button"
          accessibilityLabel={t('Currency code')}
          accessibilityValue={{ text: label }}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          style={[styles.field, { borderColor: theme.colors.outline }]}
        >
          <View style={styles.row}>
            <View style={styles.value}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('Currency code')}
              </Text>
              <Text variant="bodyLarge">{label}</Text>
            </View>
            <PhosphorIcon
              name="caret-down"
              size={24}
              color={theme.colors.onSurfaceVariant}
              allowFontScaling={false}
              accessible={false}
            />
          </View>
        </TouchableRipple>
      }
    >
      <FlatList
        accessibilityLabel={t('Currencies')}
        data={[value, ...codes.filter((code) => code !== value)]}
        keyExtractor={(code) => code}
        renderItem={({ item }) => (
          <TouchableRipple
            accessibilityRole="menuitem"
            accessibilityLabel={`${item} - ${currencyNames[item]}`}
            accessibilityState={{ selected: item === value }}
            onPress={() => {
              onChange(item);
              setOpen(false);
            }}
          >
            <View style={styles.row}>
              <Text style={styles.value}>
                {item} - {currencyNames[item]}
              </Text>
              {item === value ? (
                <PhosphorIcon
                  name="check"
                  size={24}
                  color={theme.colors.primary}
                  allowFontScaling={false}
                  accessible={false}
                />
              ) : null}
            </View>
          </TouchableRipple>
        )}
      />
    </Menu>
  );
};

const styles = StyleSheet.create({
  field: { borderWidth: 1, borderRadius: 4 },
  row: { minHeight: 56, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { flex: 1, gap: 4 },
});
