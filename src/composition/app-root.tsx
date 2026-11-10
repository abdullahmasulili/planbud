import { LocaleContext, useI18n } from '@/shared/presentation/i18n';
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
import { ActionButton } from '@/shared/presentation/controls';

/** Subscribes navigation and its screens to the current profile language.
 * @returns The single router stack inside stable service composition.
 */
const LocalizedRoutes = () => {
  const { settings } = useServices();
  const locale = useStore(settings, (state) => state.profile?.locale ?? 'en-US');
  return (
    <LocaleContext.Provider value={locale}>
      <ThemedRoutes />
    </LocaleContext.Provider>
  );
};

/** Coordinates appearance, replacement notices, and navigation session invalidation.
 * @returns Themed routes subscribed to the durable settings projection.
 */
const ThemedRoutes = () => {
  const { t } = useI18n();
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
              actions={[{ label: t('Dismiss'), onPress: settings.getState().clearNotice }]}
            >
              {t(notice)}
            </Banner>
          </SafeAreaView>
        ) : null}
        <Stack
          key={sessionGeneration}
          screenOptions={{
            headerTitleStyle: { fontFamily: 'Plus Jakarta Sans', fontWeight: '600' },
            headerBackTitle: t('Back'),
          }}
        >
          <Stack.Screen name="(tabs)" options={{ title: t('Plan Bud') }} />
          <Stack.Screen name="setup" options={{ headerShown: false }} />
          <Stack.Screen name="plans" options={{ title: t('Named plans') }} />
          <Stack.Screen
            name="recovery"
            options={{ title: t('Recovery phrase'), animation: 'none' }}
          />
          <Stack.Screen name="backup" options={{ title: t('Backups') }} />
          <Stack.Screen name="restore" options={{ title: t('Import backup'), animation: 'none' }} />
          <Stack.Screen name="clear-data" options={{ title: t('Clear local data') }} />
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
};

/** Constructs native workflows once after the database bootstrap succeeds.
 * @param props Initialized lifecycle-owned runtime.
 * @param props.runtime Source services and private database retained only in composition.
 * @param props.onShowMockData Opens a fresh preview when available.
 * @param props.onExitPreview Identifies a preview session and returns to saved data.
 * @returns Stable capabilities and disposable store scope for all routes.
 */
const InitializedApp = ({
  runtime,
  onShowMockData,
  onExitPreview,
}: {
  runtime: Runtime;
  onShowMockData: (() => void) | undefined;
  onExitPreview: (() => void) | undefined;
}) => {
  const [profileChanges] = useState(createProfileEvents);
  const [services] = useState(() => ({
    ...runtime.services,
    ...(__DEV__ && onExitPreview
      ? {}
      : createNativeBackupServices(runtime.database, profileChanges)),
    newId: randomUUID,
    showMockData: onShowMockData,
    exitPreview: onExitPreview,
  }));
  return (
    <ServicesProvider
      services={services}
      initialProfile={runtime.profile}
      profileChanges={profileChanges}
    >
      <LocalizedRoutes />
    </ServicesProvider>
  );
};

/** Owns bootstrap retries and closes every successful native handle on teardown.
 * @param props Session controls supplied only by the development build.
 * @param props.onShowMockData Opens a fresh preview when available.
 * @param props.onExitPreview Identifies a preview session and returns to saved data.
 * @returns Recoverable startup UI or initialized application routes.
 */
const AppSession = ({
  onShowMockData,
  onExitPreview,
}: {
  onShowMockData?: (() => void) | undefined;
  onExitPreview?: () => void;
}) => {
  const { t } = useI18n();
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const mode = resolveScheme('system', useColorScheme());
  const preview = __DEV__ && onExitPreview !== undefined;
  const startupError =
    __DEV__ && preview
      ? 'Unable to open mock data. Try again or exit the preview.'
      : 'Unable to open Plan Bud. Close the app and try again.';
  useEffect(() => {
    let opened: Runtime | undefined;
    const cancel = launchOperation(
      async (isActive) => {
        const result =
          __DEV__ && preview
            ? await (await import('./mock-data')).bootstrapMockData()
            : await bootstrap();
        if (!isActive()) {
          if (result.ok) await result.value.close();
          return;
        }
        if (result.ok) {
          opened = result.value;
          setRuntime(result.value);
        } else setMessage(preview ? startupError : result.error.message);
      },
      () => setMessage(startupError),
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
  }, [attempt, preview, startupError]);
  return (
    <>
      {runtime ? (
        <InitializedApp
          runtime={runtime}
          onShowMockData={onShowMockData}
          onExitPreview={onExitPreview}
        />
      ) : (
        <PaperProvider theme={buildTheme(mode).paper}>
          <Screen includeTop>
            <Text variant="headlineMedium">{t('Plan Bud')}</Text>
            {message ? (
              <>
                <Text accessibilityRole="alert">{t(message)}</Text>
                <Button
                  mode="contained"
                  contentStyle={{ minHeight: 48 }}
                  onPress={() => {
                    setMessage('');
                    setAttempt(attempt + 1);
                  }}
                >
                  {t('Try again')}
                </Button>
              </>
            ) : (
              <ActivityIndicator
                accessibilityLabel={t(
                  __DEV__ && preview ? 'Opening mock data' : 'Opening your local data',
                )}
              />
            )}
            {__DEV__ && onExitPreview ? (
              <ActionButton onPress={onExitPreview}>{t('Exit preview')}</ActionButton>
            ) : null}
          </Screen>
        </PaperProvider>
      )}
    </>
  );
};

/** Remounts the database, stores, and navigator together when changing data sources.
 * @returns One isolated app session under a stable safe-area provider.
 */
export const AppRoot = () => {
  const [preview, setPreview] = useState(false);
  return (
    <SafeAreaProvider>
      {__DEV__ && preview ? (
        <AppSession key="preview" onExitPreview={() => setPreview(false)} />
      ) : (
        <AppSession key="local" onShowMockData={__DEV__ ? () => setPreview(true) : undefined} />
      )}
    </SafeAreaProvider>
  );
};
