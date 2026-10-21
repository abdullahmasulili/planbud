import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Profile } from '@/domains/settings/application/public';
import type { RuntimeServices } from './bootstrap';
import { createBudgetStore } from '@/domains/budgeting/presentation/budget-store';
import { createTransactionStore } from '@/domains/transactions/presentation/transaction-store';
import { createSettingsStore } from '@/domains/settings/presentation/settings-store';
import { createGoalStore } from '@/domains/goals/presentation/goal-store';
import { createPlanningStore } from '@/domains/budgeting/presentation/planning-store';
import type { RecoveryService } from '@/domains/backup/application/public';
import type { SensitiveScreenPort } from '@/domains/backup/application/sensitive-screen-port';
import type { ExportService } from '@/domains/backup/application/export-service';
import type { RestoreService } from '@/domains/backup/application/restore-service';
import type { BackupFilesPort } from '@/domains/backup/application/file-ports';
import type { ProfileEvents } from './profile-events';

/** Stable application capabilities; records and secret material do not belong here. */
export type Services = RuntimeServices & {
  readonly newId: () => string;
  readonly recovery?: RecoveryService;
  readonly sensitiveScreen?: SensitiveScreenPort;
  readonly exports?: ExportService;
  readonly restores?: RestoreService;
  readonly backupFiles?: BackupFilesPort;
};
/** Scoped service and presentation-store identities for one mounted application. */
export type ServiceScope = {
  readonly services: Services;
  readonly settings: ReturnType<typeof createSettingsStore>;
  readonly budgets: ReturnType<typeof createBudgetStore>;
  readonly transactions: ReturnType<typeof createTransactionStore>;
  readonly goals: ReturnType<typeof createGoalStore>;
  readonly planning: ReturnType<typeof createPlanningStore>;
};
const ServicesContext = createContext<ServiceScope | null>(null);

/** Owns dependencies and stores once; remount the provider for a replacement profile.
 * @param props Initial dependencies, durable profile, and consuming subtree.
 * @param props.services Stable application capabilities.
 * @param props.initialProfile Confirmed profile or first-launch absence.
 * @param props.children The consuming route subtree.
 * @param props.profileChanges Composition-only committed replacement notifications.
 * @returns Stable Context scope.
 */
export const ServicesProvider = ({
  services,
  initialProfile,
  children,
  profileChanges,
}: {
  services: Services;
  initialProfile: Profile | null;
  children: ReactNode;
  profileChanges?: ProfileEvents;
}) => {
  const [scope] = useState(() => ({
    services,
    settings: createSettingsStore(initialProfile),
    budgets: createBudgetStore(services.budgets),
    transactions: createTransactionStore(services.transactions),
    goals: createGoalStore(services.goals),
    planning: createPlanningStore(services.planning),
  }));
  useEffect(
    () =>
      profileChanges?.subscribe((profile) => {
        scope.budgets.getState().reset();
        scope.transactions.getState().reset();
        scope.goals.getState().reset();
        scope.planning.getState().reset();
        scope.settings.getState().replaceSession(profile);
      }),
    [profileChanges, scope],
  );
  useEffect(
    () => () => {
      scope.budgets.getState().reset();
      scope.transactions.getState().reset();
      scope.goals.getState().reset();
      scope.planning.getState().reset();
    },
    [scope],
  );
  return <ServicesContext.Provider value={scope}>{children}</ServicesContext.Provider>;
};

/** Reads the stable dependency scope rather than subscribing to financial records.
 * @returns Current provider scope.
 * @throws When called outside the required ServicesProvider.
 */
export const useServices = (): ServiceScope => {
  const scope = useContext(ServicesContext);
  if (!scope) throw new Error('useServices requires ServicesProvider.');
  return scope;
};
