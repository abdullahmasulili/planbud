import { Redirect } from 'expo-router';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { ClearDataScreen } from '@/domains/backup/presentation/clear-data-screen';

/** Offers deliberate app-private clearing only for a confirmed local profile.
 * @returns Destructive confirmation or setup after a successful clear.
 */
const ClearDataRoute = () => {
  const { services, settings } = useServices();
  const profile = useStore(settings, (state) => state.profile);
  return profile && services.restores ? (
    <ClearDataScreen service={services.restores} />
  ) : (
    <Redirect href="/setup" />
  );
};
export default ClearDataRoute;
