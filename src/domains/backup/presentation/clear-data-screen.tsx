import { useState } from 'react';
import { Checkbox, Text } from 'react-native-paper';
import type { RestoreService } from '../application/restore-service';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { ActionButton } from '@/shared/presentation/controls';
import { useOperation } from '@/shared/presentation/use-operation';

/** Requires deliberate acknowledgment before deleting app-private financial data.
 * @param props Durable clear capability, supplied by composition after profile confirmation.
 * @param props.service Atomic reset and protected-key cleanup workflow.
 * @returns Explicit irreversible clear action; never accesses external backup files.
 */
export const ClearDataScreen = ({ service }: { service: RestoreService }) => {
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const operation = useOperation();
  return (
    <Screen>
      <Text variant="headlineMedium">Clear local data</Text>
      <Text>
        This deletes your profile, budgets, transactions, goals, history and local recovery binding.
        Export a backup and retain its phrase first if you need these records. External .planbud
        files are not deleted.
      </Text>
      <Checkbox.Item
        label="I understand this cannot be undone without my backup and phrase"
        labelMaxFontSizeMultiplier={0}
        status={confirmed ? 'checked' : 'unchecked'}
        disabled={operation.busy}
        onPress={() => setConfirmed(!confirmed)}
      />
      <FormMessage message={operation.message} />
      <Text>{notice}</Text>
      <ActionButton
        mode="contained"
        disabled={!confirmed || operation.busy}
        loading={operation.busy}
        onPress={() =>
          operation.run(
            async () => await service.resetProfile(confirmed),
            (value) =>
              setNotice(
                value.secretCleanupPending
                  ? 'Local financial data cleared. A protected key could not be removed; uninstalling the app removes Android protected app storage.'
                  : 'Local data cleared.',
              ),
          )
        }
      >
        Clear all local data
      </ActionButton>
    </Screen>
  );
};
