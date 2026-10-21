import { Redirect } from 'expo-router';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { GoalsScreen } from '@/domains/goals/presentation/goals-screen';
import { calendarToday } from '@/shared/presentation/calendar-today';

/** Connects actual goal history to a provider-scoped projection and confirmed currency.
 * @returns Goal metadata/contribution flows or first-run setup.
 */
const GoalsRoute = () => {
  const { services, settings, goals } = useServices();
  const profile = useStore(settings, (state) => state.profile);
  return profile ? (
    <GoalsScreen profile={profile} store={goals} today={calendarToday()} newId={services.newId} />
  ) : (
    <Redirect href="/setup" />
  );
};
export default GoalsRoute;
