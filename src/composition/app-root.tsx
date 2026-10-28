import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { ActivityIndicator, Banner, Button, PaperProvider, Text } from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { randomUUID } from 'expo-crypto';
import { useStore } from 'zustand';
import { bootstrap } from './bootstrap';
import type { Runtime } from './bootstrap';
import { ServicesProvider, useServices } from './services';
import { buildTheme, resolveScheme } from '@/shared/presentation/theme';
import { Screen } from '@/shared/presentation/screen';
import { launchOperation } from '@/shared/presentation/operation-launcher';
import { createNativeBackupServices } from './native-backup-services';
import { createProfileEvents } from './profile-events';

/** Coordinates appearance, safe replacement notices and navigation session invalidation.
 * @returns The single router stack inside stable service composition.
 */
const ThemedRoutes = () => {
  const { settings } = useServices();
  const preference = useStore(settings, (state) => state.profile?.appearance ?? 'system');
  const sessionGeneration = useStore(settings, (state) => state.sessionGeneration);
  const notice = useStore(settings, (state) => state.replacementNotice);
  const mode = resolveScheme(preference, useColorScheme());
  const theme = buildTheme(mode);
  return (
    <PaperProvider theme={theme.paper}>
      <ThemeProvider value={theme.router}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        {notice ? (
          <SafeAreaView
            edges={['top']}
            style={{ backgroundColor: theme.paper.colors.elevation.level1 }}
          >
            <Banner
              visible={notice !== ''}
              actions={[{ label: 'Dismiss', onPress: settings.getState().clearNotice }]}
            >
              {notice}
            </Banner>
          </SafeAreaView>
        ) : null}
        <Stack
          key={sessionGeneration}
          screenOptions={{
            headerTitleStyle: { fontFamily: 'Plus Jakarta Sans', fontWeight: '600' },
            headerBackTitle: 'Back',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ title: 'Plan Bud' }} />
          <Stack.Screen name="setup" options={{ title: 'Welcome', headerBackVisible: false }} />
          <Stack.Screen name="plans" options={{ title: 'Named plans' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="recovery" options={{ title: 'Recovery phrase', animation: 'none' }} />
          <Stack.Screen name="backup" options={{ title: 'Backups' }} />
          <Stack.Screen name="restore" options={{ title: 'Import backup', animation: 'none' }} />
          <Stack.Screen name="clear-data" options={{ title: 'Clear local data' }} />
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
};

/** Constructs native workflows once after the database bootstrap succeeds.
 * @param props Initialized lifecycle-owned runtime.
 * @param props.runtime Source services and private database retained only in composition.
 * @returns Stable capabilities and disposable store scope for all routes.
 */
const InitializedApp = ({ runtime }: { runtime: Runtime }) => {
  const [profileChanges] = useState(createProfileEvents);
  const [services] = useState(() => ({
    ...runtime.services,
    ...createNativeBackupServices(runtime.database, profileChanges),
    newId: randomUUID,
  }));
  return (
    <ServicesProvider
      services={services}
      initialProfile={runtime.profile}
      profileChanges={profileChanges}
    >
      <ThemedRoutes />
    </ServicesProvider>
  );
};

/** Owns bootstrap retries and closes every successful native handle on teardown.
 * @returns Recoverable startup UI or initialized application routes.
 */
export const AppRoot = () => {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const mode = resolveScheme('system', useColorScheme());
  useEffect(() => {
    let opened: Runtime | undefined;
    const cancel = launchOperation(
      async (isActive) => {
        const result = await bootstrap();
        if (!isActive()) {
          if (result.ok) await result.value.close();
          return;
        }
        if (result.ok) {
          opened = result.value;
          setRuntime(result.value);
        } else setMessage(result.error.message);
      },
      () => setMessage('Unable to open Plan Bud. Close the app and try again.'),
    );
    return () => {
      cancel();
      if (opened) {
        const owner = opened;
        launchOperation(
          async () => {
            await owner.close();
          },
          () => {
            console.error('Unable to close the app database.');
          },
        );
      }
    };
  }, [attempt]);
  return (
    <SafeAreaProvider>
      {runtime ? (
        <InitializedApp runtime={runtime} />
      ) : (
        <PaperProvider theme={buildTheme(mode).paper}>
          <Screen>
            <Text variant="headlineMedium">Plan Bud</Text>
            {message ? (
              <>
                <Text accessibilityRole="alert">{message}</Text>
                <Button
                  mode="contained"
                  contentStyle={{ minHeight: 48 }}
                  onPress={() => {
                    setMessage('');
                    setAttempt(attempt + 1);
                  }}
                >
                  Try again
                </Button>
              </>
            ) : (
              <ActivityIndicator accessibilityLabel="Opening your local data" />
            )}
          </Screen>
        </PaperProvider>
      )}
    </SafeAreaProvider>
  );
};
