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
      onRecovery={
        services.recovery && services.sensitiveScreen ? () => router.push('/recovery') : undefined
      }
      onBackup={services.recovery && services.exports ? () => router.push('/backup') : undefined}
      onRestore={
        services.restores && services.backupFiles && services.sensitiveScreen
          ? () => router.push('/restore')
          : undefined
      }
      onClear={services.restores ? () => router.push('/clear-data') : undefined}
      onShowMockData={services.showMockData}
      onExitPreview={services.exitPreview}
    />
  ) : (
    <Redirect href="/setup" />
  );
};
export default SettingsRoute;
