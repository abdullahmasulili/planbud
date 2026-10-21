import { Redirect, router } from 'expo-router';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { SettingsScreen } from '@/domains/settings/presentation/settings-screen';

/** Connects settings presentation to its scoped service and loaded projection.
 * @returns Settings for a confirmed profile, otherwise first-run setup.
 */
const SettingsRoute = () => {
  const { services, settings } = useServices();
  const profile = useStore(settings, (state) => state.profile);
  return profile ? (
    <SettingsScreen
      profile={profile}
      service={services.profiles}
      onUpdated={settings.getState().replaceProfile}
      onRecovery={() => router.push('/recovery')}
      onBackup={() => router.push('/backup')}
      onClear={() => router.push('/clear-data')}
    />
  ) : (
    <Redirect href="/setup" />
  );
};
export default SettingsRoute;
