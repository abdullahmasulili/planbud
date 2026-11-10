import { useI18n } from '@/shared/presentation/i18n';
import { Text } from 'react-native-paper';
import type { Profile, ProfileService } from '../application/public';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';
import { ChoiceGroup } from '@/shared/presentation/choice-group';
import { ActionButton } from '@/shared/presentation/controls';

/** Persists display preferences and groups local data and developer actions.
 * @param props Confirmed profile projection, application service, and projection updater.
 * @param props.profile Loaded durable settings projection.
 * @param props.service Stable settings use cases.
 * @param props.onUpdated Replaces the projection after persistence.
 * @param props.onRecovery Opens the integrated protected phrase-management flow.
 * @param props.onBackup Opens encrypted-only export settings.
 * @param props.onRestore Opens authenticated backup replacement.
 * @param props.onClear Opens the explicit destructive local-data confirmation.
 * @param props.onShowMockData Opens the isolated developer preview when available.
 * @param props.onExitPreview Returns from the preview to the saved profile.
 * @returns Scalable settings controls with native checked radio state.
 */
export const SettingsScreen = ({
  profile,
  service,
  onUpdated,
  onRecovery,
  onBackup,
  onRestore,
  onClear,
  onShowMockData,
  onExitPreview,
}: {
  profile: Profile;
  service: ProfileService;
  onUpdated: (profile: Profile) => void;
  onRecovery?: (() => void) | undefined;
  onBackup?: (() => void) | undefined;
  onRestore?: (() => void) | undefined;
  onClear?: (() => void) | undefined;
  onShowMockData?: (() => void) | undefined;
  onExitPreview?: (() => void) | undefined;
}) => {
  const { t } = useI18n();
  const operation = useOperation();
  const previewAction = onExitPreview ?? onShowMockData;
  return (
    <Screen>
      <Text variant="titleLarge" accessibilityRole="header">
        {t('Language')}
      </Text>
      <ChoiceGroup
        label={t('Language')}
        value={profile.locale.startsWith('id') ? 'id-ID' : 'en-US'}
        options={[
          { value: 'en-US', label: 'English' },
          { value: 'id-ID', label: 'Bahasa Indonesia' },
        ]}
        disabled={operation.busy}
        onChange={(locale) =>
          operation.run(
            async () => await service.changeLocale(locale),
            () => onUpdated({ ...profile, locale }),
          )
        }
      />
      <Text variant="titleLarge" accessibilityRole="header">
        {t('Appearance')}
      </Text>
      <ChoiceGroup<Profile['appearance']>
        label={t('Appearance')}
        value={profile.appearance}
        options={[
          { value: 'system', label: t('Use device setting') },
          { value: 'light', label: t('Light') },
          { value: 'dark', label: t('Dark') },
        ]}
        disabled={operation.busy}
        onChange={(mode) =>
          operation.run(
            async () => await service.changeAppearance(mode),
            () => onUpdated({ ...profile, appearance: mode }),
          )
        }
      />
      <FormMessage message={operation.message} />
      <Text variant="titleLarge" accessibilityRole="header">
        {t('Currency')}
      </Text>
      <Text>
        {profile.currency.code} · {profile.locale}
      </Text>
      {onClear ? (
        <Text>
          {t(
            'To use a different currency, clear local data and set up again or restore another backup.',
          )}
        </Text>
      ) : null}
      {onBackup || onRestore || onRecovery || onClear ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            {t('Local data')}
          </Text>
          {onBackup ? (
            <ActionButton mode="outlined" onPress={onBackup} disabled={operation.busy}>
              {t('Back up data')}
            </ActionButton>
          ) : null}
          {onRestore ? (
            <ActionButton mode="outlined" onPress={onRestore} disabled={operation.busy}>
              {t('Restore data')}
            </ActionButton>
          ) : null}
          {onRecovery ? (
            <ActionButton mode="outlined" onPress={onRecovery} disabled={operation.busy}>
              {t('Manage recovery phrase')}
            </ActionButton>
          ) : null}
          {onClear ? (
            <ActionButton onPress={onClear} disabled={operation.busy}>
              {t('Clear local data')}
            </ActionButton>
          ) : null}
        </>
      ) : null}
      {__DEV__ && previewAction ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            {t('Developer tools')}
          </Text>
          {onExitPreview ? <Text>{t('Mock data preview. Changes are temporary.')}</Text> : null}
          <ActionButton mode="outlined" onPress={previewAction} disabled={operation.busy}>
            {onExitPreview ? t('Exit preview') : t('Show mock data')}
          </ActionButton>
        </>
      ) : null}
    </Screen>
  );
};
