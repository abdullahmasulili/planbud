import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider, Switch, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useI18n } from '@/shared/presentation/i18n';
import { PhosphorIcon, type PhosphorGlyph } from '@/shared/presentation/phosphor-icon';
import { Screen } from '@/shared/presentation/screen';

/** Lists implemented settings destinations and keeps the development switch on the index.
 * @param props Navigation callbacks and mutually exclusive preview actions for the current session.
 * @param props.onLanguage Opens the display language page.
 * @param props.onAppearance Opens the appearance page.
 * @param props.onCurrency Opens confirmed currency details.
 * @param props.onRecovery Opens protected phrase management when available.
 * @param props.onBackup Opens the shared encrypted backup and restore page when available.
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
  onClear,
  onShowMockData,
  onExitPreview,
}: {
  onLanguage: () => void;
  onAppearance: () => void;
  onCurrency: () => void;
  onRecovery?: (() => void) | undefined;
  onBackup?: (() => void) | undefined;
  onClear?: (() => void) | undefined;
  onShowMockData?: (() => void) | undefined;
  onExitPreview?: (() => void) | undefined;
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const previewAction = onExitPreview ?? onShowMockData;
  const previewEnabled = onExitPreview !== undefined;
  const destinations: {
    title: string;
    description: string;
    icon: PhosphorGlyph;
    open: (() => void) | undefined;
  }[] = [
    {
      title: 'Language',
      description: 'Choose English or Bahasa Indonesia.',
      icon: 'translate',
      open: onLanguage,
    },
    {
      title: 'Appearance',
      description: 'Use light, dark, or your device setting.',
      icon: 'circle-half',
      open: onAppearance,
    },
    {
      title: 'Currency',
      description: 'View the currency used for your records.',
      icon: 'coins',
      open: onCurrency,
    },
    {
      title: 'Backup and restore',
      description: 'Export or import an encrypted backup.',
      icon: 'archive',
      open: onBackup,
    },
    {
      title: 'Manage recovery phrase',
      description: 'Set up or view your 12-word phrase.',
      icon: 'key',
      open: onRecovery,
    },
    {
      title: 'Clear local data',
      description: 'Delete Plan Bud records on this device.',
      icon: 'trash',
      open: onClear,
    },
  ];
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        {t('Settings')}
      </Text>
      <View>
        {destinations
          .filter(({ open }) => open !== undefined)
          .map(({ title, description, icon, open }, index) => (
            <Fragment key={title}>
              {index > 0 ? <Divider /> : null}
              <TouchableRipple
                accessibilityRole="button"
                accessibilityLabel={t(title)}
                accessibilityHint={t(description)}
                onPress={() => open?.()}
              >
                <View style={styles.row}>
                  <View style={styles.copy}>
                    <Text variant="bodyLarge">{t(title)}</Text>
                    <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                      {t(description)}
                    </Text>
                  </View>
                  <PhosphorIcon
                    name={icon}
                    size={24}
                    color={colors.onSurfaceVariant}
                    allowFontScaling={false}
                    accessible={false}
                  />
                </View>
              </TouchableRipple>
            </Fragment>
          ))}
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

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  copy: { flex: 1, gap: 4 },
});
