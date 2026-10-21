import type { ErrorBoundaryProps } from 'expo-router';
import { useColorScheme } from 'react-native';
import { buildTheme, resolveScheme } from '@/shared/presentation/theme';
import { Button, PaperProvider, Text } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppRoot } from '@/composition/app-root';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';

/** Lets the router own error containment while keeping authored UI functional.
 * @param props Router retry capability; raw errors are never rendered.
 * @param props.retry Clears router error state and rerenders the route.
 * @returns Sanitized recovery screen with an observed retry action.
 */
export const ErrorBoundary = ({ retry }: ErrorBoundaryProps) => {
  const operation = useOperation();
  const theme = buildTheme(resolveScheme('system', useColorScheme()));
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme.paper}>
        <Screen>
          <Text variant="headlineSmall">Unable to show this screen</Text>
          <Text>Your saved records stay on this device. Try opening the screen again.</Text>
          <Button
            mode="contained"
            disabled={operation.busy}
            onPress={() =>
              operation.run(
                async () => {
                  await retry();
                  return { ok: true, value: undefined };
                },
                () => {},
              )
            }
            contentStyle={{ minHeight: 48 }}
          >
            Try again
          </Button>
          <FormMessage message={operation.message} />
        </Screen>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

/** Composes the Android application without owning financial records.
 * @returns The lifecycle-owned native application.
 */
const RootLayout = () => <AppRoot />;
export default RootLayout;
