import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { TransactionsScreen } from '@/domains/transactions/presentation/transactions-screen';
import { calendarToday } from '@/shared/presentation/calendar-today';

/** Connects source-entry history to the confirmed profile and scoped projections.
 * @returns Transaction recording, filtering, and correction flows or setup.
 */
const TransactionsRoute = () => {
  const { create } = useLocalSearchParams<{ create?: string }>();
  const { services, settings, transactions } = useServices();
  const profile = useStore(settings, (state) => state.profile);
  const today = calendarToday();
  return profile ? (
    <TransactionsScreen
      profile={profile}
      store={transactions}
      loadCategories={services.budgets.readCategories}
      initialMonth={today.slice(0, 7)}
      today={today}
      newId={services.newId}
      createRequest={typeof create === 'string' ? create : ''}
      onNewPlanning={() =>
        router.push({ pathname: '/plans', params: { create: services.newId() } })
      }
    />
  ) : (
    <Redirect href="/setup" />
  );
};
export default TransactionsRoute;
