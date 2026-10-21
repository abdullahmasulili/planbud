import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Dialog, Text } from 'react-native-paper';
import { AppDialog } from '@/shared/presentation/dialog';
import type { Command, Result } from '@/shared/domain/result';
import { parseAmount } from '@/shared/domain/money';
import type { Profile } from '@/domains/settings/application/public';
import type { Goal } from '../application/public';
import { amountInput } from '@/shared/presentation/money-format';
import { AppInput, ActionButton } from '@/shared/presentation/controls';
import { ChoiceGroup } from '@/shared/presentation/choice-group';
import { FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';

/** Edits goal metadata without manufacturing savings when a goal is marked completed.
 * @param props Confirmed profile, initial source record, and stable mutation capabilities.
 * @param props.profile Currency and locale for exact inputs.
 * @param props.initial Existing goal or a new draft.
 * @param props.newId Supplies record/action identities once per mounted form.
 * @param props.onSave Durable metadata save capability.
 * @param props.onClose Dismisses after success or explicit discard.
 * @returns Scrollable Material form with priority, state, and optional planning inputs.
 */
export const GoalForm = ({
  profile,
  initial,
  newId,
  onSave,
  onClose,
}: {
  profile: Profile;
  initial: Goal | null;
  newId: () => string;
  onSave: (command: Command<Goal>) => Promise<Result<Goal>>;
  onClose: () => void;
}) => {
  const [id] = useState(() => initial?.id ?? newId());
  const [operationId] = useState(newId);
  const [name, setName] = useState(initial?.name ?? '');
  const originalTarget = initial
    ? amountInput(initial.target, profile.currency, profile.locale)
    : '';
  const originalSaved = amountInput(initial?.startingSaved ?? 0, profile.currency, profile.locale);
  const originalDesired = initial?.desiredMonthly
    ? amountInput(initial.desiredMonthly, profile.currency, profile.locale)
    : '';
  const [target, setTarget] = useState(originalTarget);
  const [saved, setSaved] = useState(originalSaved);
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [desired, setDesired] = useState(originalDesired);
  const [priority, setPriority] = useState<Goal['priority']>(initial?.priority ?? 'medium');
  const [state, setState] = useState<Goal['state']>(initial?.state ?? 'active');
  const [discard, setDiscard] = useState(false);
  const operation = useOperation();
  const dirty =
    name !== (initial?.name ?? '') ||
    target !== originalTarget ||
    saved !== originalSaved ||
    deadline !== (initial?.deadline ?? '') ||
    desired !== originalDesired ||
    priority !== (initial?.priority ?? 'medium') ||
    state !== (initial?.state ?? 'active');
  /** Requests explicit discard instead of silently losing a draft. */
  const close = () => {
    if (operation.busy) return;
    if (dirty && !discard) setDiscard(true);
    else onClose();
  };
  /** Parses locale amounts and submits the same operation identity on retries. */
  const save = () =>
    operation.run(async () => {
      const targetResult = parseAmount(target, profile.currency, profile.locale);
      if (!targetResult.ok) return targetResult;
      const savedResult = parseAmount(saved, profile.currency, profile.locale);
      if (!savedResult.ok) return savedResult;
      const desiredResult = desired.trim()
        ? parseAmount(desired, profile.currency, profile.locale)
        : ({ ok: true, value: null } satisfies Result<number | null>);
      if (!desiredResult.ok) return desiredResult;
      return await onSave({
        operationId,
        input: {
          id,
          name,
          target: targetResult.value,
          startingSaved: savedResult.value,
          deadline: deadline.trim() || null,
          priority,
          desiredMonthly: desiredResult.value,
          state,
        },
      });
    }, onClose);
  return (
    <AppDialog visible onDismiss={close} dismissable={!operation.busy} style={{ maxHeight: '90%' }}>
      <Dialog.Title>
        {discard ? 'Discard unsaved edits?' : initial ? 'Edit goal' : 'New goal'}
      </Dialog.Title>
      <Dialog.ScrollArea>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
        >
          {discard ? (
            <>
              <Text>Your saved goal and actual history stay unchanged.</Text>
              <ActionButton mode="contained" onPress={onClose}>
                Discard edits
              </ActionButton>
              <ActionButton onPress={() => setDiscard(false)}>Keep editing</ActionButton>
            </>
          ) : (
            <>
              <AppInput
                label="Goal name"
                accessibilityLabel="Goal name"
                value={name}
                onChangeText={setName}
                maxLength={120}
                disabled={operation.busy}
              />
              <AppInput
                label={`Target (${profile.currency.code})`}
                accessibilityLabel="Goal target"
                value={target}
                onChangeText={setTarget}
                keyboardType="decimal-pad"
                maxLength={40}
                disabled={operation.busy}
              />
              <AppInput
                label={`Starting savings (${profile.currency.code})`}
                accessibilityLabel="Starting savings"
                value={saved}
                onChangeText={setSaved}
                keyboardType="decimal-pad"
                maxLength={40}
                disabled={operation.busy}
              />
              <Text>Starting savings exclude contributions recorded in this app.</Text>
              <AppInput
                label="Deadline (optional)"
                accessibilityLabel="Goal deadline"
                placeholder="YYYY-MM-DD"
                value={deadline}
                onChangeText={setDeadline}
                maxLength={10}
                disabled={operation.busy}
              />
              <AppInput
                label={`Desired monthly (${profile.currency.code}, optional)`}
                accessibilityLabel="Desired monthly contribution"
                value={desired}
                onChangeText={setDesired}
                keyboardType="decimal-pad"
                maxLength={40}
                disabled={operation.busy}
              />
              <Text>An undated goal needs a desired monthly amount for automatic allocation.</Text>
              <ChoiceGroup<Goal['priority']>
                label="Goal priority"
                value={priority}
                options={[
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
                onChange={setPriority}
                disabled={operation.busy}
              />
              <ChoiceGroup<Goal['state']>
                label="Goal state"
                value={state}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'archived', label: 'Archived' },
                ]}
                onChange={setState}
                disabled={operation.busy}
              />
              <Text>Completion and archival preserve actual savings and contribution history.</Text>
              <FormMessage message={operation.message} />
              <ActionButton
                mode="contained"
                onPress={save}
                disabled={operation.busy}
                loading={operation.busy}
              >
                Save goal
              </ActionButton>
              <ActionButton onPress={close} disabled={operation.busy}>
                Cancel
              </ActionButton>
            </>
          )}
        </ScrollView>
      </Dialog.ScrollArea>
    </AppDialog>
  );
};
