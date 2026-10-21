import { Redirect, router } from 'expo-router';
import { useServices } from '@/composition/services';
import { BackupScreen } from '@/domains/backup/presentation/backup-screen';

/** Mounts encrypted-only export settings through stable native capabilities.
 * @returns Backup status/actions or setup when capabilities are unavailable.
 */
const BackupRoute = () => {
  const { services } = useServices();
  return services.recovery && services.exports ? (
    <BackupScreen
      recovery={services.recovery}
      exports={services.exports}
      onRecovery={() => router.push('/recovery')}
      onRestore={() => router.push('/restore')}
    />
  ) : (
    <Redirect href="/setup" />
  );
};
export default BackupRoute;
