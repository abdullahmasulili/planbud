import { useI18n } from '@/shared/presentation/i18n';
import { Text } from 'react-native-paper';
import type { Profile, ProfileService } from '../application/public';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';
import { ChoiceGroup } from '@/shared/presentation/choice-group';
import { ActionButton } from '@/shared/presentation/controls';

/** Persists appearance while showing the immutable financial currency.
 * @param props Confirmed profile projection, application service, and projection updater.
 * @param props.profile Loaded durable settings projection.
 * @param props.service Stable settings use cases.
 * @param props.onUpdated Replaces the projection after persistence.
 * @param props.onRecovery Opens the integrated protected phrase-management flow.
 * @param props.onBackup Opens encrypted-only export settings.
 * @param props.onClear Opens the explicit destructive local-data confirmation.
 * @returns Scalable settings controls with native checked radio state.
 */
export const SettingsScreen = ({
  profile,
  service,
  onUpdated,
  onRecovery,
  onBackup,
  onClear,
}: {
  profile: Profile;
  service: ProfileService;
  onUpdated: (profile: Profile) => void;
  onRecovery?: () => void;
  onBackup?: () => void;
  onClear?: () => void;
}) => {
  const { t } = useI18n();
  const operation = useOperation();
  return (
    <Screen>
      <Text variant="titleLarge">{t('Language')}</Text>
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
      <Text variant="titleLarge">{t('Appearance')}</Text>
      <Text>{t('Follow your device or choose a scheme for Plan Bud.')}</Text>
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
      <Text variant="titleLarge">{t('Currency')}</Text>
      <Text>
        {profile.currency.code} · {profile.locale}
      </Text>
      <Text>{t('Amounts use your confirmed currency. All records stay on this device.')}</Text>
      {onRecovery ? (
        <ActionButton mode="outlined" onPress={onRecovery}>
          {t('Recovery phrase')}
        </ActionButton>
      ) : null}
      {onBackup ? (
        <ActionButton mode="outlined" onPress={onBackup}>
          {t('Encrypted backups')}
        </ActionButton>
      ) : null}
      {onClear ? <ActionButton onPress={onClear}>{t('Clear local data')}</ActionButton> : null}
    </Screen>
  );
};
