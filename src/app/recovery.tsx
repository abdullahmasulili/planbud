import { Redirect } from 'expo-router';
import { useServices } from '@/composition/services';
import { RecoveryScreen } from '@/domains/backup/presentation/recovery-screen';

/** Mounts the protected Android recovery workflow through capability injection.
 * @returns Deliberate phrase management or setup if capabilities are unavailable.
 */
const RecoveryRoute = () => {
  const { services } = useServices();
  return services.recovery && services.sensitiveScreen ? (
    <RecoveryScreen service={services.recovery} protection={services.sensitiveScreen} />
  ) : (
    <Redirect href="/setup" />
  );
};
export default RecoveryRoute;
