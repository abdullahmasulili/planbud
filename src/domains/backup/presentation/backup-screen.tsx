import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text } from 'react-native-paper';
import type { RecoveryService, RecoveryStatus } from '../application/public';
import type { ExportService } from '../application/export-service';
import { launchOperation } from '@/shared/presentation/operation-launcher';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { ActionButton } from '@/shared/presentation/controls';
import { useOperation } from '@/shared/presentation/use-operation';

/** Reports readiness and explicit encrypted-export outcomes without retaining financial data.
 * @param props Native workflow capabilities and implemented recovery navigation.
 * @param props.recovery Reads nonsecret matching-key readiness.
 * @param props.exports Encrypts validated snapshots before any file operation.
 * @param props.onRecovery Opens protected phrase management.
 * @param props.onRestore Opens the implemented file/phrase restore workflow when available.
 * @returns Backup settings with truthful saved, canceled and failed feedback.
 */
export const BackupScreen = ({
  recovery,
  exports,
  onRecovery,
  onRestore,
}: {
  recovery: RecoveryService;
  exports: ExportService;
  onRecovery: () => void;
  onRestore?: () => void;
}) => {
  const [status, setStatus] = useState<RecoveryStatus | 'loading'>('loading');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [lastExport, setLastExport] = useState<string | null>(null);
  const operation = useOperation();
  useFocusEffect(
    useCallback(
      () =>
        launchOperation(
          async (isActive) => {
            const result = await recovery.status();
            if (!isActive()) return;
            if (result.ok) {
              setStatus(result.value);
              setMessage('');
            } else {
              setStatus('missing-secret');
              setMessage(result.error.message);
            }
          },
          () => {
            setStatus('missing-secret');
            setMessage('Unable to check recovery readiness. Reopen this screen to try again.');
          },
        ),
      [recovery],
    ),
  );
  return (
    <Screen>
      <Text variant="headlineMedium">Encrypted backups</Text>
      <Text>
        Save a .planbud file and keep its original 12-word phrase separately. Both are required on a
        new device. The app has no account, cloud sync or phrase reset.
      </Text>
      <Text>
        Recovery status:{' '}
        {status === 'ready'
          ? 'Ready'
          : status === 'unconfigured'
            ? 'Set up a phrase'
            : status === 'pending'
              ? 'Save the matching restored phrase'
              : status === 'loading'
                ? 'Checking protected storage'
                : 'Matching local secret unavailable'}
      </Text>
      <FormMessage message={message || operation.message} />
      <Text accessibilityLiveRegion="polite">{notice}</Text>
      {lastExport ? (
        <Text>Last successful export this session: {lastExport}</Text>
      ) : (
        <Text>No successful export in this session.</Text>
      )}
      <ActionButton
        mode="contained"
        disabled={status !== 'ready' || operation.busy}
        loading={operation.busy}
        onPress={() =>
          operation.run(exports.exportBackup, (outcome) => {
            if (outcome === 'saved') {
              setLastExport(new Date().toLocaleString());
              setNotice(
                'Encrypted backup saved. Keep the file with its matching phrase available separately.',
              );
            } else setNotice('Export canceled. No new backup was saved.');
          })
        }
      >
        Export encrypted backup
      </ActionButton>
      <ActionButton mode="outlined" onPress={onRecovery} disabled={operation.busy}>
        Manage recovery phrase
      </ActionButton>
      {onRestore ? (
        <ActionButton onPress={onRestore} disabled={operation.busy}>
          Import encrypted backup
        </ActionButton>
      ) : null}
      <Text>
        The selected document provider controls where it stores an encrypted file. Plan Bud writes
        no plaintext export.
      </Text>
    </Screen>
  );
};
