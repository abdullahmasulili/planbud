import { useI18n } from '@/shared/presentation/i18n';
import { useState } from 'react';
import { FlatList } from 'react-native';
import { Dialog, List, Text, useTheme } from 'react-native-paper';
import { AppDialog } from '@/shared/presentation/dialog';
import type { Category } from '@/domains/budgeting/application/public';
import { AppInput, ActionButton } from '@/shared/presentation/controls';

/** Selects a category from a searchable virtualized list without nesting scroll owners.
 * @param props Available category metadata and selection lifecycle.
 * @param props.categories Allowed active categories plus any retained historical selection.
 * @param props.selected Current category identity.
 * @param props.onSelected Commits a view-only selection to the owning form.
 * @param props.onClose Dismisses the picker without changing the draft.
 * @returns A scalable Material category picker.
 */
export const CategoryPicker = ({
  categories,
  selected,
  onSelected,
  onClose,
}: {
  categories: readonly Category[];
  selected: string | null;
  onSelected: (id: string) => void;
  onClose: () => void;
}) => {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const theme = useTheme();
  const visible = categories.filter((category) =>
    category.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <AppDialog visible onDismiss={onClose} style={{ maxHeight: '90%' }}>
      <Dialog.Title>{t('Expense category')}</Dialog.Title>
      <Dialog.Content>
        <AppInput
          label={t('Search categories')}
          accessibilityLabel={t('Search categories')}
          value={search}
          onChangeText={setSearch}
          maxLength={120}
        />
      </Dialog.Content>
      <Dialog.ScrollArea>
        <FlatList
          data={visible}
          keyExtractor={(category) => category.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <List.Item
              title={item.name}
              titleNumberOfLines={0}
              description={`${t(item.kind === 'essential' ? 'Essential' : 'Flexible')}${item.archived ? t(' · archived') : ''}`}
              accessibilityState={{ selected: item.id === selected }}
              onPress={() => onSelected(item.id)}
              style={{
                minHeight: 48,
                backgroundColor:
                  item.id === selected ? theme.colors.primaryContainer : theme.colors.surface,
              }}
            />
          )}
          ListEmptyComponent={<Text>{t('No matching categories.')}</Text>}
        />
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <ActionButton onPress={onClose}>{t('Cancel')}</ActionButton>
      </Dialog.Actions>
    </AppDialog>
  );
};
