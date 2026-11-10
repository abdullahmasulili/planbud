import { Text } from 'react-native-paper';
import type { Profile, ProfileService } from '../application/public';
import { useI18n } from '@/shared/presentation/i18n';
import { ChoiceGroup } from '@/shared/presentation/choice-group';
import { FormMessage, Screen } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';

/** Shows one preference and persists edits before updating the loaded projection.
 * @param props The selected preference, confirmed profile, and scoped persistence capabilities.
 * @param props.section Preference selected by the Settings destination.
 * @param props.profile Confirmed local settings and currency.
 * @param props.service Persists language and appearance changes.
 * @param props.onUpdated Publishes the profile after a successful save.
 * @param props.canReplaceProfile Whether clearing or restoring local data is available.
 * @returns A focused language, appearance, or currency page.
 */
export const SettingsPreferenceScreen = ({
  section,
  profile,
  service,
  onUpdated,
  canReplaceProfile,
}: {
  section: 'language' | 'appearance' | 'currency';
  profile: Profile;
  service: ProfileService;
  onUpdated: (profile: Profile) => void;
  canReplaceProfile: boolean;
}) => {
  const { t } = useI18n();
  const operation = useOperation();
  return (
    <Screen>
      {section === 'language' ? (
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
      ) : section === 'appearance' ? (
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
      ) : (
        <>
          <Text variant="titleLarge">
            {profile.currency.code} · {profile.locale}
          </Text>
          {canReplaceProfile ? (
            <Text>
              {t(
                'To use a different currency, clear local data and set up again or restore another backup.',
              )}
            </Text>
          ) : null}
        </>
      )}
      <FormMessage message={operation.message} />
    </Screen>
  );
};
