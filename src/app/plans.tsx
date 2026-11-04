import { Redirect, useLocalSearchParams } from 'expo-router';
import { useStore } from 'zustand';
import { useServices } from '@/composition/services';
import { NamedPlansScreen } from '@/domains/budgeting/presentation/named-plans-screen';

/** Connects named planning estimates to the current offline profile and scoped store.
 * @returns Named-plan management or the required currency-confirmation route.
 */
const NamedPlansRoute = () => {
  const { create } = useLocalSearchParams<{ create?: string }>();
  const { services, settings, namedPlans } = useServices();
  const profile = useStore(settings, (state) => state.profile);
  return profile ? (
    <NamedPlansScreen
      profile={profile}
      service={services.namedPlans}
      store={namedPlans}
      newId={services.newId}
      createRequest={typeof create === 'string' ? create : ''}
    />
  ) : (
    <Redirect href="/setup" />
  );
};
export default NamedPlansRoute;
