import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useStore } from 'zustand';
import { ActivityIndicator, Snackbar, Text } from 'react-native-paper';
import type { BudgetService, Category } from '../application/public';
import type { Profile } from '@/domains/settings/application/public';
import type { createBudgetStore } from './budget-store';
import { BudgetForm } from './budget-form';
import { CategoryDialog } from './category-dialog';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { ActionButton } from '@/shared/presentation/controls';
import { launchOperation } from '@/shared/presentation/operation-launcher';
import type { GoalService } from '@/domains/goals/application/public';
import type { createPlanningStore } from './planning-store';
import { PlanningPreviewDialog } from './planning-preview';
import { useOperation } from '@/shared/presentation/use-operation';

/** Connects monthly form drafts to scoped, replaceable budget projections.
 * @param props Stable application dependencies and initial selected month.
 * @param props.profile Confirmed currency and locale.
 * @param props.service Durable budget use cases.
 * @param props.store Provider-scoped projection store.
 * @param props.initialMonth First calendar month to inspect.
 * @param props.newId Generates a new category identity when its dialog opens.
 * @param props.planning Optional decision support capabilities for the integrated planner.
 * @param props.planning.store Scoped disposable review state.
 * @param props.planning.readGoals Published goal label read capability.
 * @param props.planning.onGoals Opens existing goal editing after canceling the preview.
 * @returns Loading, retry, and complete monthly planning flows.
 */
export const PlanScreen = ({
  profile,
  service,
  store,
  initialMonth,
  newId,
  planning,
}: {
  profile: Profile;
  service: BudgetService;
  store: ReturnType<typeof createBudgetStore>;
  initialMonth: string;
  newId: () => string;
  planning?: {
    readonly store: ReturnType<typeof createPlanningStore>;
    readonly readGoals: GoalService['readGoals'];
    readonly onGoals: () => void;
  };
}) => {
  const version = useStore(store, (state) => state.version);
  const categories = useStore(store, (state) => state.categories);
  const status = useStore(store, (state) => state.status);
  const message = useStore(store, (state) => state.message);
  const [editing, setEditing] = useState<{ category: Category | null } | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [staleDraft, setStaleDraft] = useState(false);
  const draftDirty = useRef(false);
  /** Tracks local draft ownership without making focus subscriptions follow keystrokes.
   * @param dirty Whether the form has unsaved monetary edits.
   */
  const onDirtyChange = useCallback((dirty: boolean) => {
    draftDirty.current = dirty;
  }, []);
  const [goalNames, setGoalNames] = useState<
    readonly { readonly id: string; readonly name: string }[]
  >([]);
  const previewOperation = useOperation();
  const cancelRead = useRef<(() => void) | undefined>(undefined);
  /** Observes explicit month reads, canceling stale error presentation.
   * @param month Requested calendar month or the current month on retry.
   */
  const load = useCallback(
    (month: string) => {
      setStaleDraft(false);
      cancelRead.current?.();
      cancelRead.current = launchOperation(
        async () => {
          await store.getState().loadMonth(month);
        },
        () => {
          store.setState({ status: 'error', message: 'Unable to load this month. Try again.' });
        },
      );
    },
    [store],
  );
  useFocusEffect(
    useCallback(() => {
      const current = store.getState();
      if (!draftDirty.current) load(current.month || initialMonth);
      else {
        cancelRead.current?.();
        cancelRead.current = launchOperation(
          async (isActive) => {
            const latest = await service.readMonth(current.month || initialMonth);
            if (isActive())
              setStaleDraft(!latest.ok || latest.value.revision !== current.version?.revision);
          },
          () => setStaleDraft(true),
        );
      }
      return () => {
        cancelRead.current?.();
      };
    }, [initialMonth, load, service, store]),
  );
  useEffect(() => {
    return () => {
      cancelRead.current?.();
      store.getState().reset();
    };
  }, [initialMonth, load, store]);
  /** Reloads the committed plan and announces save completion. */
  const onSaved = () => {
    setSaved(true);
    load(store.getState().month || initialMonth);
  };
  /** Loads consistent estimates and public labels before exposing the review session. */
  const openPreview = () => {
    if (!planning || !version) return;
    previewOperation.run(
      async () => {
        const [, goals] = await Promise.all([
          planning.store.getState().open(version.plan.month),
          planning.readGoals(),
        ]);
        if (!goals.ok) return goals;
        return { ok: true, value: goals.value.map((goal) => ({ id: goal.id, name: goal.name })) };
      },
      (names) => {
        setGoalNames(names);
        setPreviewing(true);
      },
    );
  };
  /** Disposes the current review when canceled or after commitment. */
  const closePreview = () => {
    planning?.store.getState().reset();
    setPreviewing(false);
  };
  return (
    <>
      {version ? (
        <BudgetForm
          key={`${version.plan.month}:${version.revision}`}
          profile={profile}
          version={version}
          categories={categories}
          service={service}
          onSaved={onSaved}
          onOpenMonth={load}
          onEditCategory={(category) => setEditing({ category })}
          onDirtyChange={onDirtyChange}
          staleDraft={staleDraft}
          {...(planning ? { onPreview: openPreview } : {})}
        />
      ) : (
        <Screen>
          <Text variant="headlineMedium">Monthly plan</Text>
          {status === 'loading' ? (
            <ActivityIndicator accessibilityLabel="Loading this month" />
          ) : null}
          <FormMessage message={message} />
          <ActionButton onPress={() => load(store.getState().month || initialMonth)}>
            Reload month
          </ActionButton>
        </Screen>
      )}
      {editing ? (
        <CategoryDialog
          category={editing.category}
          service={service}
          newId={newId}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onSaved();
          }}
        />
      ) : null}
      <Snackbar visible={saved} onDismiss={() => setSaved(false)} duration={3000}>
        Changes saved
      </Snackbar>
      <FormMessage message={previewOperation.message} />
      {previewing && planning ? (
        <PlanningPreviewDialog
          profile={profile}
          store={planning.store}
          categoryNames={categories}
          goalNames={goalNames}
          onClose={closePreview}
          onApplied={() => {
            closePreview();
            onSaved();
          }}
          onGoals={() => {
            closePreview();
            planning.onGoals();
          }}
        />
      ) : null}
    </>
  );
};
