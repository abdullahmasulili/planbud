import { useState } from 'react';
import { Checkbox, Text } from 'react-native-paper';
import type { RestoreService } from '../application/restore-service';
import type { BackupFilesPort } from '../application/file-ports';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';
import { useRestoreFlow } from './use-restore-flow';
import { PhraseInput } from './phrase-input';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { ActionButton } from '@/shared/presentation/controls';

/** Offers file selection, secret authentication, count review and explicit replacement in order.
 * @param props Native use cases and sensitive-view protection, with no concrete adapters in UI.
 * @param props.service Authenticated private restore sessions and atomic replacement.
 * @param props.files Encrypted-only provider selection.
 * @param props.protection Android capture and recents protection.
 * @returns Complete replacement-only import flow, with cancellation and pending-key guidance.
 */
export const RestoreScreen = ({
  service,
  files,
  protection,
}: {
  service: RestoreService;
  files: BackupFilesPort;
  protection: SensitiveScreenPort;
}) => {
  const flow = useRestoreFlow(service, files, protection);
  return (
    <Screen>
      <Text variant="headlineMedium">Import encrypted backup</Text>
      <Text>
        Choose your .planbud file and enter its original 12-word phrase. Import replaces local
        records; it does not merge them. A wrong phrase, damaged file or canceled preview leaves
        current data unchanged.
      </Text>
      <FormMessage message={flow.message} />
      <Text accessibilityLiveRegion="polite">{flow.notice}</Text>
      {flow.phase === 'select' ? (
        <ActionButton
          mode="contained"
          onPress={flow.select}
          disabled={flow.busy || !flow.ready}
          loading={flow.busy}
        >
          Choose .planbud file
        </ActionButton>
      ) : flow.phase === 'phrase' ? (
        <PhraseInput
          label="Authenticate and preview"
          ready={flow.ready}
          busy={flow.busy}
          onSubmit={flow.prepare}
          onCancel={flow.dispose}
        />
      ) : flow.phase === 'review' && flow.preview ? (
        <ReplacementReview
          key={flow.preview.token}
          createdAt={flow.preview.createdAt}
          counts={flow.preview.counts}
          busy={flow.busy}
          onConfirm={flow.confirm}
          onCancel={flow.dispose}
        />
      ) : (
        <ActionButton onPress={flow.dispose}>Done</ActionButton>
      )}
    </Screen>
  );
};

/** Requires a separate destructive acknowledgment after authentication and validation.
 * @param props Nonsecret snapshot review and explicit replacement controls.
 * @param props.createdAt Authenticated snapshot audit timestamp.
 * @param props.counts Source counts only, never full financial records.
 * @param props.busy Whether an explicitly confirmed replacement is in flight.
 * @param props.onConfirm Commits only the reviewed session at its original source revision.
 * @param props.onCancel Disposes the session without changing data.
 * @returns Explicit destructive confirmation after a visible snapshot preview.
 */
const ReplacementReview = ({
  createdAt,
  counts,
  busy,
  onConfirm,
  onCancel,
}: {
  createdAt: string;
  counts: Readonly<Record<string, number>>;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <>
      <Text variant="titleLarge">Review replacement</Text>
      <Text>Snapshot: {createdAt}</Text>
      {Object.entries(counts).map(([name, count]) => (
        <Text key={name}>
          {name}: {count}
        </Text>
      ))}
      <Checkbox.Item
        label="Replace all current local records with this backup"
        labelMaxFontSizeMultiplier={0}
        status={confirmed ? 'checked' : 'unchecked'}
        disabled={busy}
        onPress={() => setConfirmed(!confirmed)}
      />
      <ActionButton
        mode="contained"
        disabled={!confirmed || busy}
        loading={busy}
        onPress={onConfirm}
      >
        Replace local data
      </ActionButton>
      <ActionButton disabled={busy} onPress={onCancel}>
        Cancel restore
      </ActionButton>
    </>
  );
};
