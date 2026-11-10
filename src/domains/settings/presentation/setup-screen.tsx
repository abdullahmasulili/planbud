import { useCallback, useState } from 'react';
import { BackHandler, StyleSheet, View, useColorScheme } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Checkbox, Icon, PaperProvider, Text, useTheme } from 'react-native-paper';
import type { Profile, ProfileService } from '../application/public';
import { AppInput, ActionButton } from '@/shared/presentation/controls';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { ChoiceGroup } from '@/shared/presentation/choice-group';
import { useOperation } from '@/shared/presentation/use-operation';
import { buildTheme, resolveScheme } from '@/shared/presentation/theme';
import { LocaleContext, translate } from '@/shared/presentation/i18n';
import { currencyFor } from '@/shared/domain/money';
import { SetupCompletion } from './setup-completion';

/** Guides first launch through introduction, storage consent, preferences and explicit completion.
 * @param props Stable confirmation use case, device suggestions and implemented navigation.
 * @param props.service Persists the complete profile only after Get started.
 * @param props.suggestedLocale Device language suggestion; only English and Indonesian are bundled.
 * @param props.suggestedCurrency Supported device currency suggestion.
 * @param props.onConfirmed Receives the durably confirmed profile.
 * @param props.onImport Opens authenticated backup replacement without creating a profile.
 * @param props.onShowMockData Opens the isolated developer preview when available.
 * @returns A reversible four-step offline onboarding flow with local preference previews.
 */
export const SetupScreen = ({
  service,
  suggestedLocale,
  suggestedCurrency,
  onConfirmed,
  onImport,
  onShowMockData,
}: {
  service: ProfileService;
  suggestedLocale: string;
  suggestedCurrency: string;
  onConfirmed: (profile: Profile) => void;
  onImport?: () => void;
  onShowMockData?: (() => void) | undefined;
}) => {
  const [step, setStep] = useState(0);
  const [storageAllowed, setStorageAllowed] = useState(false);
  const [code, setCode] = useState(currencyFor(suggestedCurrency).ok ? suggestedCurrency : 'IDR');
  const [locale, setLocale] = useState(suggestedLocale.startsWith('id') ? 'id-ID' : 'en-US');
  const [appearance, setAppearance] = useState<Profile['appearance']>('system');
  const [confirmed, setConfirmed] = useState(false);
  const operation = useOperation();
  const theme = buildTheme(resolveScheme(appearance, useColorScheme())).paper;
  const currency = currencyFor(code.trim().toUpperCase());
  const t = (message: string, values?: Readonly<Record<string, string | number>>) =>
    translate(locale, message, values);
  useFocusEffect(
    useCallback(() => {
      const back = BackHandler.addEventListener('hardwareBackPress', () => {
        if (operation.busy) return true;
        if (step === 0) return false;
        setStep(step - 1);
        return true;
      });
      return () => back.remove();
    }, [operation.busy, step]),
  );
  /** Confirms only the reviewed preferences, retaining the final step on failure. */
  const submit = () => {
    if (step !== 3 || !storageAllowed || !confirmed || !currency.ok) return;
    operation.run(
      async () =>
        await service.confirm({
          id: 'personal',
          currency: currency.value,
          locale,
          appearance,
        }),
      onConfirmed,
    );
  };
  const titles = [
    'Meet PlanBud',
    'Keep your recovery phrase safe',
    'Make it yours',
    'You’re ready to plan the future',
  ];
  return (
    <LocaleContext.Provider value={locale}>
      <PaperProvider theme={theme}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Screen key={step} includeTop>
          <View
            style={styles.progress}
            accessibilityRole="progressbar"
            accessibilityLabel={t('Setup progress')}
            accessibilityValue={{
              min: 1,
              max: 4,
              now: step + 1,
              text: t('Step {0} of 4', { 0: step + 1 }),
            }}
          >
            <Text variant="titleMedium">PlanBud</Text>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('Step {0} of 4', { 0: step + 1 })}
            </Text>
            <View style={styles.track} importantForAccessibility="no-hide-descendants">
              {titles.map((title, index) => (
                <View
                  key={title}
                  style={[
                    styles.segment,
                    {
                      backgroundColor:
                        index <= step ? theme.colors.primary : theme.colors.surfaceVariant,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={[styles.body, step === 2 && styles.preferences, step === 3 && styles.final]}>
            {step === 3 ? <SetupCompletion /> : step < 2 ? <StepSymbol step={step} /> : null}
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              variant="headlineMedium"
              style={step === 3 ? styles.center : undefined}
            >
              {t(titles[step] ?? 'Meet PlanBud')}
            </Text>
            {step === 0 ? (
              <>
                <Text variant="bodyLarge">
                  {t('A little planning today. More room for tomorrow.')}
                </Text>
                <Text>
                  {t(
                    'PlanBud helps you plan a monthly budget, track everyday spending, and save toward your goals. Everything works offline, on your device.',
                  )}
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('No account. No cloud sync. Your money stays with you.')}
                </Text>
              </>
            ) : step === 1 ? (
              <>
                <Text>
                  {t(
                    'Allow PlanBud to save recovery material in Android’s protected local storage when you set up your 12-word seed phrase in Backups.',
                  )}
                </Text>
                <Text>
                  {t(
                    'The phrase unlocks your encrypted backup on a new device. Keep a written copy separate from the backup file. A lost phrase cannot be reset.',
                  )}
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  {t(
                    'Android needs no storage permission dialog for protected app storage. Folder access is requested only when you export an encrypted backup.',
                  )}
                </Text>
                {storageAllowed ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.primary }}>
                    {t('Protected storage allowed. Create your phrase later in Backups.')}
                  </Text>
                ) : null}
              </>
            ) : step === 2 ? (
              <>
                <Text>
                  {t(
                    'Choose your language, currency, and theme. You can change language and theme later in Settings.',
                  )}
                </Text>
                <Text variant="titleMedium">{t('Language')}</Text>
                <ChoiceGroup
                  label={t('Language')}
                  value={locale}
                  options={[
                    { value: 'en-US', label: 'English' },
                    { value: 'id-ID', label: 'Bahasa Indonesia' },
                  ]}
                  onChange={setLocale}
                />
                <AppInput
                  label={t('Currency code')}
                  value={code}
                  onChangeText={(value) => {
                    setCode(value.toUpperCase());
                    setConfirmed(false);
                  }}
                  autoCapitalize="characters"
                  maxLength={3}
                  error={!currency.ok}
                />
                <ActionButton
                  mode={code === 'IDR' ? 'contained-tonal' : 'outlined'}
                  accessibilityState={{ selected: code === 'IDR' }}
                  onPress={() => {
                    if (code === 'IDR') return;
                    setCode('IDR');
                    setConfirmed(false);
                  }}
                >
                  {t('Indonesian rupiah (IDR)')}
                </ActionButton>
                <Text>
                  {t(
                    'Currency is fixed after setup. Changing it requires clearing local data or restoring another profile.',
                  )}
                </Text>
                <Checkbox.Item
                  label={t('I confirm {0} for my records', {
                    0: currency.ok ? currency.value.code : code,
                  })}
                  labelMaxFontSizeMultiplier={0}
                  status={confirmed ? 'checked' : 'unchecked'}
                  onPress={() => setConfirmed(!confirmed)}
                  disabled={!currency.ok}
                  position="leading"
                  style={{ paddingHorizontal: 0 }}
                />
                <Text variant="titleMedium">{t('Theme')}</Text>
                <ChoiceGroup<Profile['appearance']>
                  label={t('Theme')}
                  value={appearance}
                  options={[
                    { value: 'system', label: t('Use device setting') },
                    { value: 'light', label: t('Light') },
                    { value: 'dark', label: t('Dark') },
                  ]}
                  onChange={setAppearance}
                />
                <FormMessage message={!currency.ok ? currency.error.message : ''} />
              </>
            ) : (
              <>
                <Text variant="bodyLarge" style={styles.center}>
                  {t(
                    'Your next chapter starts with a plan. Let’s make room for what matters to you.',
                  )}
                </Text>
                <Text style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
                  {code} · {locale === 'id-ID' ? 'Bahasa Indonesia' : 'English'} ·{' '}
                  {t(
                    appearance === 'system'
                      ? 'Use device setting'
                      : appearance === 'light'
                        ? 'Light'
                        : 'Dark',
                  )}
                </Text>
              </>
            )}
          </View>
          <View style={styles.actions}>
            <FormMessage message={operation.message} />
            <ActionButton
              mode="contained"
              loading={operation.busy}
              disabled={operation.busy || (step === 2 && (!confirmed || !currency.ok))}
              onPress={() => {
                if (step === 3) submit();
                else if (step === 1 && !storageAllowed) setStorageAllowed(true);
                else setStep(step + 1);
              }}
            >
              {t(
                step === 3
                  ? 'Get started'
                  : step === 1 && !storageAllowed
                    ? 'Allow protected storage'
                    : 'Continue',
              )}
            </ActionButton>
            {step > 0 ? (
              <ActionButton
                disabled={operation.busy}
                onPress={() => {
                  operation.clearMessage();
                  setStep(step - 1);
                }}
              >
                {t('Back')}
              </ActionButton>
            ) : onImport ? (
              <ActionButton onPress={onImport}>{t('Restore an existing backup')}</ActionButton>
            ) : null}
            {__DEV__ && step === 0 && onShowMockData ? (
              <ActionButton onPress={onShowMockData}>{t('Show mock data')}</ActionButton>
            ) : null}
          </View>
        </Screen>
      </PaperProvider>
    </LocaleContext.Provider>
  );
};

/** Identifies the current setup task without decorative artwork.
 * @param props Current introduction or recovery step.
 * @param props.step Zero-based step before completion.
 * @returns One small themed task icon, hidden from screen readers beside the heading.
 */
const StepSymbol = ({ step }: { step: number }) => {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.symbol, { backgroundColor: theme.colors.primaryContainer }]}
    >
      <Icon
        source={step === 0 ? 'wallet-outline' : 'shield-lock-outline'}
        size={32}
        color={theme.colors.onPrimaryContainer}
      />
    </View>
  );
};
const styles = StyleSheet.create({
  progress: { gap: 12 },
  track: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  body: { flexGrow: 1, justifyContent: 'center', gap: 24, paddingVertical: 24 },
  final: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 32 },
  preferences: { gap: 12, paddingVertical: 16 },
  center: { textAlign: 'center' },
  actions: { gap: 8 },
  symbol: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
