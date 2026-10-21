import { View } from 'react-native';
import { RadioButton } from 'react-native-paper';

/** Typed label and value for an exclusive Material choice. */
export type ChoiceOption<T extends string> = { readonly value: T; readonly label: string };

/** Exposes checked radio semantics that remain visible to Android accessibility services.
 * @param props Typed selection, labels, and synchronous selection handler.
 * @param props.label Accessible name of the exclusive choice group.
 * @param props.value Current selected value.
 * @param props.options Available typed choices in display order.
 * @param props.onChange Receives the explicitly selected value.
 * @param props.disabled Disables choices while a durable operation is pending.
 * @returns Scalable native radio controls with 48 dp minimum targets.
 */
export const ChoiceGroup = <T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) => (
  <View accessibilityRole="radiogroup" accessibilityLabel={label}>
    {options.map((option) => (
      <RadioButton.Item
        key={option.value}
        label={option.label}
        value={option.value}
        status={value === option.value ? 'checked' : 'unchecked'}
        onPress={() => onChange(option.value)}
        disabled={disabled}
        position="leading"
        labelStyle={{ textAlign: 'left' }}
        style={{ minHeight: 48, paddingHorizontal: 0 }}
      />
    ))}
  </View>
);
