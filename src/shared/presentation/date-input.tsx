import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { DatePickerDialog, Host } from '@expo/ui/jetpack-compose';
import { Dialog, Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { parseDate } from '../domain/calendar-date';
import { ActionButton } from './controls';
import { AppDialog } from './dialog';
import { calendarToday } from './calendar-today';

/** Selects calendar dates or whole months without typing or shifting stored dates across timezones.
 * @param props Controlled calendar value and field presentation.
 * @param props.label Visible field label.
 * @param props.accessibilityLabel Screen-reader field name.
 * @param props.value Calendar date or month, or empty for an optional date.
 * @param props.onChangeText Receives YYYY-MM-DD, YYYY-MM, or an explicitly cleared optional value.
 * @param props.mode Selects a full date or a month and year.
 * @param props.optional Allows clearing a previously selected deadline.
 * @param props.disabled Prevents changes while the owning form is saving.
 * @returns A themed picker field with cancellation that preserves the current value.
 */
export const DateInput = ({
  label,
  accessibilityLabel = label,
  value,
  onChangeText,
  mode = 'date',
  optional = false,
  disabled = false,
}: {
  label: string;
  accessibilityLabel?: string;
  value: string;
  onChangeText: (value: string) => void;
  mode?: 'date' | 'month';
  optional?: boolean;
  disabled?: boolean;
}) => {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(0);
  const date = mode === 'month' ? `${value}-01` : value;
  const selected = parseDate(date).ok ? date : calendarToday();
  return (
    <View style={styles.group}>
      <TouchableRipple
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: value || 'Not set' }}
        accessibilityHint={mode === 'month' ? 'Choose a month and year' : 'Open calendar'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          setYear(Number(selected.slice(0, 4)));
          setOpen(true);
        }}
        style={[styles.field, { borderColor: theme.colors.outline }]}
      >
        <View style={styles.fieldContent}>
          <View style={styles.value}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {label}
            </Text>
            <Text variant="bodyLarge">{value || 'Choose date'}</Text>
          </View>
          <Icon source="calendar" size={24} color={theme.colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>
      {optional && value ? (
        <ActionButton disabled={disabled} onPress={() => onChangeText('')}>
          Clear {accessibilityLabel.toLowerCase()}
        </ActionButton>
      ) : null}
      {open && mode === 'date' ? (
        <Host colorScheme={theme.dark ? 'dark' : 'light'} seedColor={theme.colors.primary}>
          <DatePickerDialog
            initialDate={selected}
            onDismissRequest={() => setOpen(false)}
            onDateSelected={(picked) => {
              // Compose returns the selected calendar day as UTC midnight, not a local instant.
              const next = picked?.toISOString().slice(0, 10);
              if (next && parseDate(next).ok) onChangeText(next);
              setOpen(false);
            }}
          />
        </Host>
      ) : null}
      {open && mode === 'month' ? (
        <AppDialog visible onDismiss={() => setOpen(false)} style={{ maxHeight: '90%' }}>
          <Dialog.Title>{label}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.group}>
              <View style={styles.year}>
                <ActionButton
                  accessibilityLabel="Previous year"
                  disabled={year <= 1}
                  onPress={() => setYear(year - 1)}
                >
                  −
                </ActionButton>
                <Text variant="titleLarge" accessibilityLiveRegion="polite">
                  {year}
                </Text>
                <ActionButton
                  accessibilityLabel="Next year"
                  disabled={year >= 9999}
                  onPress={() => setYear(year + 1)}
                >
                  +
                </ActionButton>
              </View>
              <View style={styles.months}>
                {Array.from({ length: 12 }, (_, index) => {
                  const month = `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`;
                  const name = new Date(`${month}-01T12:00:00Z`).toLocaleString(undefined, {
                    month: 'long',
                    timeZone: 'UTC',
                  });
                  return (
                    <ActionButton
                      key={month}
                      mode={month === value ? 'contained' : 'text'}
                      accessibilityLabel={`${name} ${year}`}
                      accessibilityState={{ selected: month === value }}
                      style={{ width: fontScale > 1.3 ? '100%' : '50%' }}
                      onPress={() => {
                        onChangeText(month);
                        setOpen(false);
                      }}
                    >
                      {name}
                    </ActionButton>
                  );
                })}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <ActionButton onPress={() => setOpen(false)}>Cancel</ActionButton>
          </Dialog.Actions>
        </AppDialog>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  group: { gap: 8 },
  field: { borderWidth: 1, borderRadius: 4 },
  fieldContent: { minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { flex: 1, gap: 4 },
  year: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  months: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 },
});
