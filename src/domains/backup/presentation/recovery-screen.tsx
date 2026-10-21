import { useState } from 'react';
import { Checkbox, Text } from 'react-native-paper';
import type { RecoveryService } from '../application/public';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';
import { useRecoveryFlow } from './use-recovery-flow';
import { PhraseInput } from './phrase-input';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { AppInput, ActionButton } from '@/shared/presentation/controls';

/** Presents explicit phrase generation/reveal with local state and native capture protection.
 * @param props Secret-session service and native sensitive-view protection.
 * @param props.service Recovery lifecycle capability; secrets never enter the provider value.
 * @param props.protection Capture and recents protection leases.
 * @returns Ordered phrase, distinct-word confirmation and deliberate replacement controls.
 */
export const RecoveryScreen = ({
  service,
  protection,
}: {
  service: RecoveryService;
  protection: SensitiveScreenPort;
}) => {
  const flow = useRecoveryFlow(service, protection);
  const [replace, setReplace] = useState(false);
  return (
    <Screen>
      <Text variant="headlineMedium">Recovery phrase</Text>
      <Text>
        Both your encrypted .planbud file and its 12-word phrase are required to restore. Neither
        the app nor a service can reset a lost phrase or recover a missing file.
      </Text>
      <Text>
        Create a new phrase for Plan Bud. Never reuse a cryptocurrency wallet phrase. Write the
        words in order and keep them separate from the backup file.
      </Text>
      <FormMessage message={flow.message} />
      {flow.phase === 'intro' ? (
        <>
          {replace ? (
            <>
              <Text>
                Changing the phrase affects future backups only. Older files still require their
                original phrase.
              </Text>
              <ActionButton
                mode="contained"
                disabled={!flow.protectedView || flow.busy}
                onPress={() => {
                  flow.create(true);
                  setReplace(false);
                }}
              >
                Create replacement phrase
              </ActionButton>
              <ActionButton onPress={() => setReplace(false)}>Keep existing phrase</ActionButton>
            </>
          ) : (
            <>
              <ActionButton
                mode="contained"
                disabled={!flow.protectedView || flow.busy}
                onPress={() => flow.create(false)}
              >
                Set up new phrase
              </ActionButton>
              <ActionButton
                mode="outlined"
                disabled={!flow.protectedView || flow.busy}
                onPress={flow.reveal}
              >
                Reveal existing phrase
              </ActionButton>
              <ActionButton disabled={flow.busy} onPress={() => setReplace(true)}>
                Change phrase for future backups
              </ActionButton>
              <ActionButton disabled={!flow.protectedView || flow.busy} onPress={flow.startResume}>
                Save existing matching phrase
              </ActionButton>
            </>
          )}
        </>
      ) : flow.phase === 'reveal' ? (
        <>
          <Text>
            Capture is blocked while this screen is open. This does not protect words you share or
            write elsewhere.
          </Text>
          {flow.words.map((word, index) => (
            <Text key={index} variant="titleLarge" selectable={false}>
              {index + 1}. {word}
            </Text>
          ))}
          {flow.positions.length ? (
            <ActionButton mode="contained" onPress={flow.startConfirmation}>
              I wrote down the words
            </ActionButton>
          ) : null}
          <ActionButton onPress={flow.dispose}>Hide phrase</ActionButton>
        </>
      ) : flow.phase === 'resume' ? (
        <PhraseInput
          label="Save matching phrase"
          ready={flow.protectedView}
          busy={flow.busy}
          onSubmit={flow.resume}
          onCancel={flow.dispose}
        />
      ) : flow.phase === 'confirm' ? (
        <RecoveryConfirmation
          key={flow.positions.join(',')}
          positions={flow.positions}
          busy={flow.busy}
          onConfirm={flow.confirm}
          onCancel={flow.dispose}
        />
      ) : (
        <>
          <Text>
            Recovery phrase saved in protected local storage. Keep your written copy: it is required
            with the encrypted file on a new device.
          </Text>
          <ActionButton onPress={flow.dispose}>Done</ActionButton>
        </>
      )}
    </Screen>
  );
};

/** Owns only the three transient answers; unmounting the view drops all input references.
 * @param props Confirmation positions and awaited mutation controls.
 * @param props.positions Three distinct one-based requested positions.
 * @param props.busy Whether a protected save is in flight.
 * @param props.onConfirm Validates the three words and acknowledgment.
 * @param props.onCancel Disposes the entire generated session.
 * @returns Local secret input form without clipboard actions or persistence.
 */
const RecoveryConfirmation = ({
  positions,
  busy,
  onConfirm,
  onCancel,
}: {
  positions: readonly number[];
  busy: boolean;
  onConfirm: (
    answers: readonly { position: number; word: string }[],
    acknowledged: boolean,
  ) => void;
  onCancel: () => void;
}) => {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <>
      {positions.map((position) => (
        <AppInput
          key={position}
          label={`Word ${position}`}
          accessibilityLabel={`Recovery word ${position}`}
          value={answers[position] ?? ''}
          onChangeText={(word) => setAnswers((current) => ({ ...current, [position]: word }))}
          secureTextEntry
          autoComplete="off"
          importantForAutofill="no"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          contextMenuHidden
          maxLength={20}
          disabled={busy}
        />
      ))}
      <Checkbox.Item
        label="I understand that both the file and phrase are required and cannot be reset"
        labelMaxFontSizeMultiplier={0}
        status={acknowledged ? 'checked' : 'unchecked'}
        onPress={() => setAcknowledged(!acknowledged)}
        disabled={busy}
      />
      <ActionButton
        mode="contained"
        disabled={busy || !acknowledged}
        loading={busy}
        onPress={() =>
          onConfirm(
            positions.map((position) => ({ position, word: answers[position] ?? '' })),
            acknowledged,
          )
        }
      >
        Confirm recovery phrase
      </ActionButton>
      <ActionButton disabled={busy} onPress={onCancel}>
        Cancel setup
      </ActionButton>
    </>
  );
};
