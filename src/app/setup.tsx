import { Redirect, router } from 'expo-router';
import { useLocales } from 'expo-localization';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { SetupScreen } from '@/domains/settings/presentation/setup-screen';

/** Mounts currency confirmation and exits only after durable setup succeeds.
 * @returns Setup flow or the confirmed profile's home route.
 */
const SetupRoute = () => {
  const { services, settings } = useServices();
  const profile = useStore(settings, (state) => state.profile);
  const locales = useLocales();
  return profile ? (
    <Redirect href="/" />
  ) : (
    <SetupScreen
      service={services.profiles}
      suggestedLocale={locales[0].languageTag}
      suggestedCurrency={locales[0].currencyCode ?? 'IDR'}
      onConfirmed={settings.getState().replaceProfile}
      onImport={() => router.push('/restore')}
    />
  );
};
export default SetupRoute;
