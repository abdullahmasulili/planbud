import { DateInput } from '@/shared/presentation/date-input';
import { useI18n } from '@/shared/presentation/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, List, Snackbar, Text, useTheme } from 'react-native-paper';
import { useStore } from 'zustand';
import type { Profile } from '@/domains/settings/application/public';
import type { Category } from '@/domains/budgeting/application/public';
import type { Result } from '@/shared/domain/result';
import { parseDate } from '@/shared/domain/calendar-date';
import type { Transaction } from '../application/public';
import type { createTransactionStore } from './transaction-store';
import { TransactionForm } from './transaction-form';
import { ActionButton } from '@/shared/presentation/controls';
import { ChoiceGroup } from '@/shared/presentation/choice-group';
import { FormMessage } from '@/shared/presentation/screen';
import { formatMoney } from '@/shared/presentation/money-format';
import { launchOperation } from '@/shared/presentation/operation-launcher';

/** Shows bounded history pages, exact actual totals, filters, and observed editing flows.
 * @param props Stable store, profile, calendar suggestions, and category-read capability.
 * @param props.profile Confirmed currency and locale.
 * @param props.store Provider-scoped history projection store.
 * @param props.loadCategories Narrow application read capability retaining archived labels.
 * @param props.initialMonth First calendar month to load.
 * @param props.today Local date suggested for new entries.
 * @param props.newId Supplies stable record and action identities for each form.
 * @param props.createRequest Unique navigation request to open a new expense draft once.
 * @returns One virtualized history scroll owner and complete source-entry dialogs.
 */
export const TransactionsScreen = ({
  profile,
  store,
  loadCategories,
  initialMonth,
  today,
  newId,
  createRequest,
}: {
  profile: Profile;
  store: ReturnType<typeof createTransactionStore>;
  loadCategories: () => Promise<Result<readonly Category[]>>;
  initialMonth: string;
  today: string;
  newId: () => string;
  createRequest?: string;
}) => {
  const { t } = useI18n();
  const theme = useTheme();
  const records = useStore(store, (state) => state.records);
  const summary = useStore(store, (state) => state.summary);
  const status = useStore(store, (state) => state.status);
  const message = useStore(store, (state) => state.message);
  const filter = useStore(store, (state) => state.filter);
  const cursor = useStore(store, (state) => state.nextCursor);
  const [month, setMonth] = useState(initialMonth);
  const [monthError, setMonthError] = useState('');
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [categoryError, setCategoryError] = useState('');
  const [editing, setEditing] = useState<{ record: Transaction | null } | null>(null);
  const [notice, setNotice] = useState('');
  const handledCreate = useRef<string | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      if (!createRequest || handledCreate.current === createRequest) return;
      handledCreate.current = createRequest;
      setEditing({ record: null });
    }, [createRequest]),
  );
  const cancelRead = useRef<(() => void) | undefined>(undefined);
  const cancelPage = useRef<(() => void) | undefined>(undefined);
  /** Refreshes history and labels, ignoring category completions after blur or teardown.
   * @param selectedMonth Valid calendar month requested by the user.
   */
  const load = useCallback(
    (selectedMonth: string) => {
      cancelRead.current?.();
      cancelRead.current = launchOperation(
        async (isActive) => {
          setCategoryError('');
          const [, result] = await Promise.all([
            store.getState().loadMonth(selectedMonth),
            loadCategories(),
          ]);
          if (!isActive()) return;
          if (result.ok) setCategories(result.value);
          else setCategoryError(result.error.message);
        },
        () => {
          setCategoryError('Unable to load category labels. Reload this month.');
          store.setState({ status: 'error', message: 'Unable to load this month. Try again.' });
        },
      );
    },
    [loadCategories, store],
  );
  useFocusEffect(
    useCallback(() => {
      load(store.getState().month || initialMonth);
      return () => {
        cancelRead.current?.();
        cancelPage.current?.();
      };
    }, [initialMonth, load, store]),
  );
  useEffect(
    () => () => {
      store.getState().reset();
    },
    [store],
  );
  /** Opens a valid month without changing the source dates of any record. */
  const openMonth = () => {
    if (!/^\d{4}-\d{2}$/.test(month) || !parseDate(month + '-01').ok) {
      setMonthError('Use a calendar month in YYYY-MM format.');
      return;
    }
    setMonthError('');
    load(month);
  };
  /** Observes a paginated read and publishes a retryable error if it unexpectedly rejects. */
  const more = () => {
    cancelPage.current = launchOperation(
      async () => {
        await store.getState().loadMore();
      },
      () =>
        store.setState({
          status: 'stale',
          message: 'Unable to load more entries. Reload this month.',
        }),
    );
  };
  const visible = filter === 'all' ? records : records.filter((record) => record.type === filter);
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView behavior="height" style={styles.fill}>
        <FlatList
          data={visible}
          keyExtractor={(record) => record.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.section}>
              <Text variant="headlineMedium">{t('Transactions')}</Text>
              <Text>{t('Actual income and spending stay separate from goal contributions.')}</Text>
              <DateInput
                mode="month"
                label={t('History month')}
                accessibilityLabel={t('History month')}
                value={month}
                onChangeText={setMonth}
              />
              <ActionButton mode="outlined" onPress={openMonth} disabled={status === 'loading'}>
                {t('Open month')}
              </ActionButton>
              <FormMessage message={monthError || message || categoryError} />
              {status === 'stale' ? (
                <Text>{t('Showing the last loaded records. Reload for current totals.')}</Text>
              ) : null}
              {summary ? (
                <>
                  <Text>
                    {t('Income:')} {formatMoney(summary.income, profile.currency, profile.locale)}
                  </Text>
                  <Text>
                    {t('Spending:')}{' '}
                    {formatMoney(summary.spending, profile.currency, profile.locale)}
                  </Text>
                </>
              ) : null}
              <ChoiceGroup<typeof filter>
                label={t('History filter')}
                value={filter}
                options={[
                  { value: 'all', label: t('All entries') },
                  { value: 'income', label: t('Income') },
                  { value: 'expense', label: t('Expenses') },
                ]}
                onChange={store.getState().setFilter}
              />
              <ActionButton
                onPress={() => load(store.getState().month || initialMonth)}
                disabled={status === 'loading'}
              >
                {t('Reload history')}
              </ActionButton>
            </View>
          }
          renderItem={({ item }) => (
            <List.Item
              title={`${t(item.type === 'expense' ? 'Expense' : 'Income')} · ${formatMoney(item.amount, profile.currency, profile.locale)}`}
              titleNumberOfLines={0}
              description={`${item.date}${item.categoryId ? ' · ' + (categories.find((category) => category.id === item.categoryId)?.name ?? t('Category unavailable')) : ''}${item.note ? '\n' + item.note : ''}`}
              descriptionNumberOfLines={3}
              accessibilityLabel={t('Edit {0} {1} on {2}', {
                0: t(item.type),
                1: formatMoney(item.amount, profile.currency, profile.locale),
                2: item.date,
              })}
              onPress={() => setEditing({ record: item })}
            />
          )}
          ListEmptyComponent={
            status === 'loading' ? (
              <ActivityIndicator accessibilityLabel={t('Loading transactions')} />
            ) : (
              <Text>
                {records.length
                  ? t('No {0} in the loaded entries. Load more or change the filter.', {
                      0: t(filter),
                    })
                  : t('No transactions for this month. Add an income or expense to begin.')}
              </Text>
            )
          }
          ListFooterComponent={
            cursor ? (
              <ActionButton
                mode="outlined"
                disabled={status !== 'ready'}
                loading={status === 'loading'}
                onPress={more}
              >
                {t('Load more')}
              </ActionButton>
            ) : undefined
          }
        />
        <View style={styles.action}>
          <ActionButton mode="contained" onPress={() => setEditing({ record: null })}>
            {t('New transaction')}
          </ActionButton>
        </View>
      </KeyboardAvoidingView>
      {editing ? (
        <TransactionForm
          profile={profile}
          categories={categories}
          categoryError={categoryError}
          initial={editing.record}
          today={today}
          newId={newId}
          onSave={store.getState().save}
          onRemove={store.getState().remove}
          onClose={() => setEditing(null)}
          onCommitted={(kind) =>
            setNotice(kind === 'save' ? 'Transaction saved' : 'Transaction deleted')
          }
        />
      ) : null}
      <Snackbar visible={notice !== ''} onDismiss={() => setNotice('')} duration={3000}>
        {t(notice)}
      </Snackbar>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 24, gap: 16 },
  section: { gap: 16 },
  action: { padding: 16 },
});
