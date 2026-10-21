import type { ComponentProps } from 'react';
import { Button, TextInput } from 'react-native-paper';

/** Keeps native Material inputs responsive to the user's full Android font scale.
 * @param props Paper input contract; scaling stays enabled without the library's 1.5 cap.
 * @returns An outlined Material field with scalable label and input text.
 */
export const AppInput = (props: ComponentProps<typeof TextInput>) => (
  <TextInput mode="outlined" {...props} maxFontSizeMultiplier={0} />
);

/** Provides a Material action with a minimum Android touch target and scalable text.
 * @param props Paper button contract and accessible action label.
 * @returns A themed action whose height can grow with its content.
 */
export const ActionButton = (props: ComponentProps<typeof Button>) => (
  <Button {...props} contentStyle={[{ minHeight: 48 }, props.contentStyle]} />
);
