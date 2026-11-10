import { Redirect, router } from 'expo-router';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { SettingsScreen } from '@/domains/settings/presentation/settings-screen';

/** Connects the Settings index to the available preference and local data pages.
 * @returns Settings for a confirmed profile, otherwise first-run setup.
 */
const SettingsRoute = () => {
  const { services, settings } = useServices();
  const hasProfile = useStore(settings, (state) => state.profile !== null);
  return hasProfile ? (
    <SettingsScreen
      onLanguage={() => router.push('/settings/language')}
      onAppearance={() => router.push('/settings/appearance')}
      onCurrency={() => router.push('/settings/currency')}
      onRecovery={
        services.recovery && services.sensitiveScreen ? () => router.push('/recovery') : undefined
      }
      onBackup={services.recovery && services.exports ? () => router.push('/backup') : undefined}
      onClear={services.restores ? () => router.push('/clear-data') : undefined}
      onShowMockData={services.showMockData}
      onExitPreview={services.exitPreview}
    />
  ) : (
    <Redirect href="/setup" />
  );
};
export default SettingsRoute;
