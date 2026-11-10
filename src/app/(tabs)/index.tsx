import { Redirect, router } from 'expo-router';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { OverviewScreen } from '@/domains/budgeting/presentation/overview-screen';
import { calendarToday } from '@/shared/presentation/calendar-today';

/** Connects the overview to source estimates, actual records, and working destinations.
 * @returns The confirmed profile's overview or currency confirmation.
 */
const HomeRoute = () => {
  const { services, settings } = useServices();
  const profile = useStore(settings, (state) => state.profile);
  if (!profile) return <Redirect href="/setup" />;
  return (
    <>
      <OverviewScreen
        profile={profile}
        budgets={services.budgets}
        transactions={services.transactions}
        initialMonth={calendarToday().slice(0, 7)}
        onPlan={() => router.navigate('/plan')}
        goals={services.goals}
        onGoals={() => router.navigate('/goals')}
        onNewPlanning={() =>
          router.push({ pathname: '/plans', params: { create: services.newId() } })
        }
        onRecordSpending={() =>
          router.navigate({ pathname: '/transactions', params: { create: services.newId() } })
        }
      />
    </>
  );
};
export default HomeRoute;
