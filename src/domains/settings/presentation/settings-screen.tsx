import { View } from 'react-native';
import { List, Switch, Text } from 'react-native-paper';
import { useI18n } from '@/shared/presentation/i18n';
import { Screen } from '@/shared/presentation/screen';

/** Lists implemented settings destinations and keeps the development switch on the index.
 * @param props Navigation callbacks and mutually exclusive preview actions for the current session.
 * @param props.onLanguage Opens the display language page.
 * @param props.onAppearance Opens the appearance page.
 * @param props.onCurrency Opens confirmed currency details.
 * @param props.onRecovery Opens protected phrase management when available.
 * @param props.onBackup Opens encrypted export when available.
 * @param props.onRestore Opens authenticated backup import when available.
 * @param props.onClear Opens destructive data clearing confirmation when available.
 * @param props.onShowMockData Opens an isolated sample session in a development build.
 * @param props.onExitPreview Returns to the saved session from a sample session.
 * @returns The Settings index with one row per available page.
 */
export const SettingsScreen = ({
  onLanguage,
  onAppearance,
  onCurrency,
  onRecovery,
  onBackup,
  onRestore,
  onClear,
  onShowMockData,
  onExitPreview,
}: {
  onLanguage: () => void;
  onAppearance: () => void;
  onCurrency: () => void;
  onRecovery?: (() => void) | undefined;
  onBackup?: (() => void) | undefined;
  onRestore?: (() => void) | undefined;
  onClear?: (() => void) | undefined;
  onShowMockData?: (() => void) | undefined;
  onExitPreview?: (() => void) | undefined;
}) => {
  const { t } = useI18n();
  const previewAction = onExitPreview ?? onShowMockData;
  const previewEnabled = onExitPreview !== undefined;
  const destinations = [
    { label: 'Language', open: onLanguage },
    { label: 'Appearance', open: onAppearance },
    { label: 'Currency', open: onCurrency },
    { label: 'Back up data', open: onBackup },
    { label: 'Restore data', open: onRestore },
    { label: 'Manage recovery phrase', open: onRecovery },
    { label: 'Clear local data', open: onClear },
  ];
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        {t('Settings')}
      </Text>
      <View>
        {destinations.map(({ label, open }) =>
          open ? (
            <List.Item
              key={label}
              title={t(label)}
              titleNumberOfLines={0}
              accessibilityRole="button"
              accessibilityLabel={t(label)}
              onPress={open}
              right={({ color }) => <List.Icon color={color} icon="chevron-right" />}
              style={{ minHeight: 48 }}
            />
          ) : null,
        )}
      </View>
      {__DEV__ && previewAction ? (
        <>
          <Text variant="titleMedium" accessibilityRole="header">
            {t('Developer tools')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }} importantForAccessibility="no-hide-descendants">
              <Text variant="bodyLarge">{t('Mock data preview')}</Text>
              <Text variant="bodyMedium">{t('Changes in preview are temporary.')}</Text>
            </View>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel={t('Mock data preview')}
              accessibilityHint={t('Changes in preview are temporary.')}
              accessibilityState={{ checked: previewEnabled }}
              value={previewEnabled}
              onValueChange={previewAction}
              style={{ minWidth: 48, minHeight: 48 }}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
};
