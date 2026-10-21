import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ServicesProvider, useServices } from './services';
import { createProfileEvents } from './profile-events';
import { createProfileService } from '@/domains/settings/application/profile-service';
import { createProfileRepository } from '@/domains/settings/infrastructure/profile-repository';
import { createTransactionFixture } from '../../tests/helpers/transaction-fixture';

it('STATE-002 retains isolated service and store identities across rerenders', async () => {
  const fixture = await createTransactionFixture();
  try {
    const services = {
      profiles: createProfileService(createProfileRepository(fixture.database)),
      budgets: fixture.budgets,
      transactions: fixture.transactions,
      goals: fixture.goals,
      planning: fixture.planning,
      /** Supplies a stable test-only identity capability.
       * @returns An unused deterministic identity.
       */
      newId: () => 'test-id',
    };
    const profileChanges = createProfileEvents();
    /** Provides one initialized test dependency scope.
     * @param props Hook consumer subtree.
     * @param props.children The hook under test.
     * @returns An isolated Context provider.
     */
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider
        initialProfile={fixture.profile}
        services={services}
        profileChanges={profileChanges}
      >
        {children}
      </ServicesProvider>
    );
    const first = await renderHook(useServices, { wrapper: Wrapper });
    const scope = first.result.current;
    expect(scope.budgets).toBeDefined();
    expect(scope.transactions).toBeDefined();
    expect(scope.goals).toBeDefined();
    await first.rerender(undefined);
    expect(first.result.current).toBe(scope);
    const second = await renderHook(useServices, { wrapper: Wrapper });
    expect(second.result.current.settings).not.toBe(scope.settings);
    expect(second.result.current.budgets).not.toBe(scope.budgets);
    expect(second.result.current.transactions).not.toBe(scope.transactions);
    expect(second.result.current.goals).not.toBe(scope.goals);
    scope.transactions.setState({ status: 'stale', month: '2026-10' });
    await act(() =>
      profileChanges.replace({ ...fixture.profile, id: 'restored', appearance: 'dark' }),
    );
    expect(scope.settings.getState()).toMatchObject({
      profile: { id: 'restored', appearance: 'dark' },
      sessionGeneration: 1,
    });
    expect(scope.transactions.getState()).toMatchObject({ status: 'idle', month: '' });
    await second.unmount();
    await first.unmount();
  } finally {
    await fixture.database.close();
  }
}, 30000);

it('STATE-006 fails clearly outside the provider', async () => {
  await expect(renderHook(useServices)).rejects.toThrow('ServicesProvider');
}, 30000);
