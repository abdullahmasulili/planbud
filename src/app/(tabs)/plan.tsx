import { Redirect, router } from 'expo-router';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { PlanScreen } from '@/domains/budgeting/presentation/plan-screen';
import { calendarToday } from '@/shared/presentation/calendar-today';

/** Connects the monthly planner to its scoped durable capabilities.
 * @returns The confirmed profile's planner or currency confirmation.
 */
const PlanRoute = () => {
  const { services, settings, budgets, planning } = useServices();
  const profile = useStore(settings, (state) => state.profile);
  /** Opens the implemented goal editor from a canceled planning preview. */
  const openGoals = () => router.navigate('/goals');
  return profile ? (
    <PlanScreen
      onNamedPlans={() => router.push('/plans')}
      profile={profile}
      service={services.budgets}
      store={budgets}
      initialMonth={calendarToday().slice(0, 7)}
      newId={services.newId}
      planning={{
        store: planning,
        readGoals: services.goals.readGoals,
        onGoals: openGoals,
      }}
    />
  ) : (
    <Redirect href="/setup" />
  );
};
export default PlanRoute;
