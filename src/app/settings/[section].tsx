import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { SettingsPreferenceScreen } from '@/domains/settings/presentation/settings-preference-screen';
import { useI18n } from '@/shared/presentation/i18n';

const titles = { language: 'Language', appearance: 'Appearance', currency: 'Currency' };

/** Mounts the requested preference page for a confirmed profile.
 * @returns One preference page or a redirect for an unknown destination or missing profile.
 */
const SettingsPreferenceRoute = () => {
  const { section } = useLocalSearchParams();
  const { t } = useI18n();
  const { services, settings } = useServices();
  const profile = useStore(settings, (state) => state.profile);
  if (!profile) return <Redirect href="/setup" />;
  if (section !== 'language' && section !== 'appearance' && section !== 'currency')
    return <Redirect href="/settings" />;
  return (
    <>
      <Stack.Screen options={{ title: t(titles[section]) }} />
      <SettingsPreferenceScreen
        section={section}
        profile={profile}
        service={services.profiles}
        onUpdated={settings.getState().replaceProfile}
        canReplaceProfile={services.restores !== undefined}
      />
    </>
  );
};
export default SettingsPreferenceRoute;
