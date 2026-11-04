import { useI18n } from '@/shared/presentation/i18n';
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
  const { t } = useI18n();
  const flow = useRecoveryFlow(service, protection);
  const [replace, setReplace] = useState(false);
  return (
    <Screen>
      <Text variant="headlineMedium">{t('Recovery phrase')}</Text>
      <Text>
        {t(
          'Both your encrypted .planbud file and its 12-word phrase are required to restore. Neither the app nor a service can reset a lost phrase or recover a missing file.',
        )}
      </Text>
      <Text>
        {t(
          'Create a new phrase for Plan Bud. Never reuse a cryptocurrency wallet phrase. Write the words in order and keep them separate from the backup file.',
        )}
      </Text>
      <FormMessage message={flow.message} />
      {flow.phase === 'intro' ? (
        <>
          {replace ? (
            <>
              <Text>
                {t(
                  'Changing the phrase affects future backups only. Older files still require their original phrase.',
                )}
              </Text>
              <ActionButton
                mode="contained"
                disabled={!flow.protectedView || flow.busy}
                onPress={() => {
                  flow.create(true);
                  setReplace(false);
                }}
              >
                {t('Create replacement phrase')}
              </ActionButton>
              <ActionButton onPress={() => setReplace(false)}>
                {t('Keep existing phrase')}
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton
                mode="contained"
                disabled={!flow.protectedView || flow.busy}
                onPress={() => flow.create(false)}
              >
                {t('Set up new phrase')}
              </ActionButton>
              <ActionButton
                mode="outlined"
                disabled={!flow.protectedView || flow.busy}
                onPress={flow.reveal}
              >
                {t('Reveal existing phrase')}
              </ActionButton>
              <ActionButton disabled={flow.busy} onPress={() => setReplace(true)}>
                {t('Change phrase for future backups')}
              </ActionButton>
              <ActionButton disabled={!flow.protectedView || flow.busy} onPress={flow.startResume}>
                {t('Save existing matching phrase')}
              </ActionButton>
            </>
          )}
        </>
      ) : flow.phase === 'reveal' ? (
        <>
          <Text>
            {t(
              'Capture is blocked while this screen is open. This does not protect words you share or write elsewhere.',
            )}
          </Text>
          {flow.words.map((word, index) => (
            <Text key={index} variant="titleLarge" selectable={false}>
              {index + 1}. {word}
            </Text>
          ))}
          {flow.positions.length ? (
            <ActionButton mode="contained" onPress={flow.startConfirmation}>
              {t('I wrote down the words')}
            </ActionButton>
          ) : null}
          <ActionButton onPress={flow.dispose}>{t('Hide phrase')}</ActionButton>
        </>
      ) : flow.phase === 'resume' ? (
        <PhraseInput
          label={t('Save matching phrase')}
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
            {t(
              'Recovery phrase saved in protected local storage. Keep your written copy: it is required with the encrypted file on a new device.',
            )}
          </Text>
          <ActionButton onPress={flow.dispose}>{t('Done')}</ActionButton>
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
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <>
      {positions.map((position) => (
        <AppInput
          key={position}
          label={t('Word {0}', { 0: position })}
          accessibilityLabel={t('Recovery word {0}', { 0: position })}
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
        label={t('I understand that both the file and phrase are required and cannot be reset')}
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
        {t('Confirm recovery phrase')}
      </ActionButton>
      <ActionButton disabled={busy} onPress={onCancel}>
        {t('Cancel setup')}
      </ActionButton>
    </>
  );
};
