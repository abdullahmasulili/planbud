import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Dialog, Text } from 'react-native-paper';
import { AppDialog } from '@/shared/presentation/dialog';
import type { BudgetService, Category } from '../application/public';
import { AppInput, ActionButton } from '@/shared/presentation/controls';
import { FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';
import { ChoiceGroup } from '@/shared/presentation/choice-group';

/** Edits category metadata; archiving preserves every historical reference.
 * @param props Category draft capabilities and dialog lifecycle.
 * @param props.category Existing category, or null when creating one.
 * @param props.service Validated budget application operations.
 * @param props.newId Supplies a stable new record identity once per dialog.
 * @param props.onSaved Refreshes projections after durable success.
 * @param props.onCancel Dismisses the unsaved draft.
 * @returns A scalable Material editing dialog with observed save failures.
 */
export const CategoryDialog = ({
  category,
  service,
  newId,
  onSaved,
  onCancel,
}: {
  category: Category | null;
  service: BudgetService;
  newId: () => string;
  onSaved: () => void;
  onCancel: () => void;
}) => {
  const [id] = useState(() => category?.id ?? newId());
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState<Category['kind']>(category?.kind ?? 'flexible');
  const operation = useOperation();
  /** Saves an edit or explicit archive action as one durable metadata change.
   * @param archived Whether new entry selection should hide this category.
   */
  const save = (archived: boolean) => {
    operation.run(async () => await service.saveCategory({ id, name, kind, archived }), onSaved);
  };
  return (
    <AppDialog
      style={{ maxHeight: '90%' }}
      visible
      dismissable={!operation.busy}
      onDismiss={onCancel}
    >
      <Dialog.Title>{category ? 'Edit category' : 'New category'}</Dialog.Title>
      <Dialog.ScrollArea>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
        >
          <AppInput
            label="Category name"
            accessibilityLabel="Category name"
            value={name}
            onChangeText={setName}
            maxLength={120}
            disabled={operation.busy}
          />
          <Text>
            Essential covers needs you want to protect. Flexible limits can be adjusted during
            planning.
          </Text>
          <ChoiceGroup<Category['kind']>
            label="Category kind"
            value={kind}
            options={[
              { value: 'essential', label: 'Essential' },
              { value: 'flexible', label: 'Flexible' },
            ]}
            onChange={setKind}
            disabled={operation.busy}
          />
          <FormMessage message={operation.message} />
          <ActionButton
            mode="contained"
            loading={operation.busy}
            disabled={operation.busy}
            onPress={() => save(category?.archived ?? false)}
          >
            Save category
          </ActionButton>
          {category ? (
            <>
              <Text>Archiving hides a category from new entries and keeps its history.</Text>
              <ActionButton disabled={operation.busy} onPress={() => save(!category.archived)}>
                {category.archived ? 'Unarchive category' : 'Archive category'}
              </ActionButton>
            </>
          ) : null}
          <ActionButton onPress={onCancel} disabled={operation.busy}>
            Cancel
          </ActionButton>
        </ScrollView>
      </Dialog.ScrollArea>
    </AppDialog>
  );
};
