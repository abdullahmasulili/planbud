import { parseProfile } from '@/domains/settings/application/public';
import {
  parseNamedPlan,
  parseCategory,
  parseMonthlyPlan,
  parseGoalAllocation,
} from '@/domains/budgeting/application/public';
import { parseTransaction, summarizeTransactions } from '@/domains/transactions/application/public';
import { parseGoal, parseContribution, goalProgress } from '@/domains/goals/application/public';
import { MAX_SNAPSHOT_RECORDS } from '@/shared/domain/record-limits';
import { isRecord } from '@/shared/domain/validation';
import { addAmounts } from '@/shared/domain/money';
import { parseDate } from '@/shared/domain/calendar-date';
import type { Result } from '@/shared/domain/result';
import type { Snapshot } from './snapshot';

/** Rejects extra keys at every nested record boundary rather than silently stripping metadata.
 * @param source Untrusted input already checked by an owning canonical parser.
 * @param canonical Canonical parsed model with the exact permitted key shape.
 * @returns Whether records/arrays have exactly that shape, including nested currency and limits.
 */
const exactShape = (source: unknown, canonical: unknown): boolean => {
  if (Array.isArray(canonical)) {
    if (!Array.isArray(source) || source.length !== canonical.length) return false;
    const items: readonly unknown[] = canonical;
    const raw: readonly unknown[] = source;
    return items.every((item, index) => exactShape(raw[index], item));
  }
  if (!isRecord(canonical)) return true;
  if (!isRecord(source)) return false;
  const keys = Object.keys(canonical);
  return (
    Object.keys(source).length === keys.length &&
    keys.every((key) => Object.hasOwn(source, key) && exactShape(source[key], canonical[key]))
  );
};

/** Validates a bounded record array using its published authoritative parser and exact key shape.
 * @param input Untrusted array.
 * @param parse Owning domain parser; no duplicate portable model definitions.
 * @returns Canonical records or a validation failure.
 */
const records = <T>(input: unknown, parse: (value: unknown) => Result<T>): Result<readonly T[]> => {
  if (!Array.isArray(input) || input.length > MAX_SNAPSHOT_RECORDS)
    return {
      ok: false,
      error: {
        code: 'invalid-snapshot',
        message: 'The backup contains invalid or excessive records.',
      },
    };
  const items: readonly unknown[] = input;
  const output: T[] = [];
  for (const item of items) {
    const parsed = parse(item);
    if (!parsed.ok) return parsed;
    if (!exactShape(item, parsed.value))
      return {
        ok: false,
        error: { code: 'invalid-snapshot', message: 'The backup contains unsupported fields.' },
      };
    output.push(parsed.value);
  }
  return { ok: true, value: output };
};

/** Checks identifier uniqueness without joining IDs through ambiguous separator strings.
 * @param values Canonical identities from one source collection.
 * @returns Whether each identity occurs exactly once.
 */
const unique = (values: readonly string[]) => new Set(values).size === values.length;

/** Applies the same strict portable schema and arithmetic constraints before export and restore.
 * @param input Unknown decoded JSON or a prospective outgoing snapshot.
 * @returns Canonical supported source data or a sanitized failure; never mutates current records.
 */
export const validateSnapshot = (input: unknown): Result<Snapshot> => {
  const invalid: Result<never> = {
    ok: false,
    error: {
      code: 'invalid-snapshot',
      message: 'The backup contains unsupported fields, invalid records, relationships or totals.',
    },
  };
  if (
    !isRecord(input) ||
    (input.schemaVersion !== 1 && input.schemaVersion !== 2) ||
    typeof input.createdAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.createdAt) ||
    !parseDate(input.createdAt.slice(0, 10)).ok ||
    !Number.isFinite(Date.parse(input.createdAt)) ||
    new Date(input.createdAt).toISOString() !== input.createdAt
  )
    return invalid;
  const profile = parseProfile(input.profile);
  const categories = records(input.categories, parseCategory);
  const plans = records(input.plans, parseMonthlyPlan);
  const transactions = records(input.transactions, parseTransaction);
  const goals = records(input.goals, parseGoal);
  const contributions = records(input.contributions, parseContribution);
  const allocations = records(input.allocations, parseGoalAllocation);
  const namedPlans = records(input.schemaVersion === 2 ? input.namedPlans : [], parseNamedPlan);
  if (
    !profile.ok ||
    !categories.ok ||
    !plans.ok ||
    !transactions.ok ||
    !goals.ok ||
    !contributions.ok ||
    !allocations.ok ||
    !namedPlans.ok
  )
    return invalid;
  const base = {
    createdAt: input.createdAt,
    profile: profile.value,
    categories: categories.value,
    plans: plans.value,
    transactions: transactions.value,
    goals: goals.value,
    contributions: contributions.value,
    allocations: allocations.value,
  };
  const snapshot: Snapshot =
    input.schemaVersion === 2
      ? { ...base, schemaVersion: 2, namedPlans: namedPlans.value }
      : { ...base, schemaVersion: 1 };
  if (!exactShape(input, snapshot)) return invalid;
  const count =
    categories.value.length +
    plans.value.length +
    plans.value.reduce((sum, plan) => sum + plan.limits.length, 0) +
    transactions.value.length +
    goals.value.length +
    contributions.value.length +
    allocations.value.length +
    namedPlans.value.length +
    namedPlans.value.reduce((sum, plan) => sum + plan.items.length, 0);
  if (count > MAX_SNAPSHOT_RECORDS)
    return {
      ok: false,
      error: {
        code: 'snapshot-limit',
        message:
          'Backups support up to 50,000 source records including category limits. No records were changed or truncated.',
      },
    };
  if (
    !unique(namedPlans.value.map((item) => item.id)) ||
    !unique(snapshot.categories.map((item) => item.id)) ||
    !unique(snapshot.plans.map((item) => item.month)) ||
    !unique(snapshot.transactions.map((item) => item.id)) ||
    !unique(snapshot.goals.map((item) => item.id)) ||
    !unique(snapshot.contributions.map((item) => item.id)) ||
    !unique(snapshot.allocations.map((item) => JSON.stringify([item.month, item.goalId])))
  )
    return invalid;
  const categoryIds = new Set(snapshot.categories.map((item) => item.id));
  const goalIds = new Set(snapshot.goals.map((item) => item.id));
  const months = new Set(snapshot.plans.map((item) => item.month));
  if (
    snapshot.plans.some(
      (plan) =>
        plan.limits.some((item) => !categoryIds.has(item.categoryId)) ||
        !addAmounts(plan.limits.map((item) => item.amount)).ok,
    ) ||
    snapshot.transactions.some(
      (item) => item.categoryId !== null && !categoryIds.has(item.categoryId),
    ) ||
    snapshot.contributions.some((item) => !goalIds.has(item.goalId)) ||
    snapshot.allocations.some((item) => !goalIds.has(item.goalId) || !months.has(item.month))
  )
    return invalid;
  const history = new Map<string, Snapshot['contributions'][number][]>();
  const monthlyContributions = new Map<string, number[]>();
  for (const item of snapshot.contributions) {
    const group = history.get(item.goalId) ?? [];
    group.push(item);
    history.set(item.goalId, group);
    const month = item.date.slice(0, 7);
    const amounts = monthlyContributions.get(month) ?? [];
    amounts.push(item.amount);
    monthlyContributions.set(month, amounts);
  }
  if (
    snapshot.goals.some(
      (goal) => !goalProgress(goal, history.get(goal.id) ?? [], snapshot.createdAt.slice(0, 10)).ok,
    ) ||
    [...monthlyContributions.values()].some((amounts) => !addAmounts(amounts).ok)
  )
    return invalid;
  const monthlyTransactions = new Map<string, Snapshot['transactions'][number][]>();
  for (const item of snapshot.transactions) {
    const month = item.date.slice(0, 7);
    const group = monthlyTransactions.get(month) ?? [];
    group.push(item);
    monthlyTransactions.set(month, group);
  }
  if ([...monthlyTransactions.values()].some((items) => !summarizeTransactions(items).ok))
    return invalid;
  for (const month of months)
    if (
      !addAmounts(
        snapshot.allocations.filter((item) => item.month === month).map((item) => item.amount),
      ).ok
    )
      return invalid;
  return { ok: true, value: snapshot };
};
