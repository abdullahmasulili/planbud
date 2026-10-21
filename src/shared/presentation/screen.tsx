import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text } from 'react-native-paper';

/** Provides one keyboard-aware form scroll owner with safe Android edges.
 * @param props Finite form or settings content; use a FlatList for histories.
 * @param props.children Finite screen content.
 * @returns A themed, scalable screen body.
 */
export const Screen = ({ children }: { children: ReactNode }) => {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView behavior="height" style={styles.fill}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/** Announces recoverable validation and operation errors beside the owning form.
 * @param props Sanitized message; empty messages occupy no space.
 * @param props.message Application-owned user-safe failure text.
 * @returns An accessible error label or no content.
 */
export const FormMessage = ({ message }: { message: string }) => {
  const theme = useTheme();
  return message ? (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ color: theme.colors.error }}
    >
      {message}
    </Text>
  ) : null;
};
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: 24, gap: 16 },
});
