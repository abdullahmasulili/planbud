import { Redirect } from 'expo-router';
import { useServices } from '@/composition/services';
import { RestoreScreen } from '@/domains/backup/presentation/restore-screen';

/** Mounts replacement-only import, including on a fresh installation without a profile or key.
 * @returns Protected file/phrase authentication and explicit replacement review.
 */
const RestoreRoute = () => {
  const { services } = useServices();
  return services.restores && services.backupFiles && services.sensitiveScreen ? (
    <RestoreScreen
      service={services.restores}
      files={services.backupFiles}
      protection={services.sensitiveScreen}
    />
  ) : (
    <Redirect href="/setup" />
  );
};
export default RestoreRoute;
