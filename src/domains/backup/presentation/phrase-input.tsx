import { useState } from 'react';
import { AppInput, ActionButton } from '@/shared/presentation/controls';

/** Keeps all twelve words in an unmounted-on-background input, without clipboard or persistence.
 * @param props Explicit submit/cancel actions and protected-view readiness.
 * @param props.label Visible action description.
 * @param props.ready Whether native capture protection is active.
 * @param props.busy Whether authentication or protected storage is in flight.
 * @param props.onSubmit Receives transient words; no global state is updated.
 * @param props.onCancel Disposes the surrounding secret session.
 * @returns A local hidden input with prediction, spellcheck and selection actions disabled.
 */
export const PhraseInput = ({
  label,
  ready,
  busy,
  onSubmit,
  onCancel,
}: {
  label: string;
  ready: boolean;
  busy: boolean;
  onSubmit: (words: string) => void;
  onCancel: () => void;
}) => {
  const [words, setWords] = useState('');
  return (
    <>
      <AppInput
        label="12 recovery words in order"
        accessibilityLabel="12 recovery words in order"
        value={words}
        onChangeText={setWords}
        secureTextEntry
        autoComplete="off"
        importantForAutofill="no"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        contextMenuHidden
        maxLength={300}
        disabled={busy || !ready}
      />
      <ActionButton
        mode="contained"
        disabled={busy || !ready || !words.trim()}
        loading={busy}
        onPress={() => onSubmit(words)}
      >
        {label}
      </ActionButton>
      <ActionButton disabled={busy} onPress={onCancel}>
        Cancel
      </ActionButton>
    </>
  );
};
