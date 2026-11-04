import { isAmount, isRecord, isText } from '@/shared/domain/validation';
import { addAmounts } from '@/shared/domain/money';
import { MAX_ID_LENGTH } from '@/shared/domain/record-limits';
import type { Result } from '@/shared/domain/result';

/** Independent planning estimates; amounts are profile-currency minor units, never actual activity. */
export type NamedPlan = {
  readonly id: string;
  readonly name: string;
  readonly funding: number;
  readonly items: readonly {
    readonly id: string;
    readonly name: string;
    readonly amount: number;
  }[];
};
export const MAX_PLAN_ITEMS = 100;

/** Validates bounded estimates and their aggregate before storage or backup.
 * @param input Untrusted named plan.
 * @returns Canonical source record or an actionable validation failure.
 */
export const parseNamedPlan = (input: unknown): Result<NamedPlan> => {
  const invalid: Result<never> = {
    ok: false,
    error: {
      code: 'invalid-named-plan',
      message:
        'Enter a plan name, nonnegative funding, and up to 100 named expenses with valid amounts.',
    },
  };
  if (
    !isRecord(input) ||
    !isText(input.id, MAX_ID_LENGTH) ||
    !isText(input.name, 120) ||
    !isAmount(input.funding) ||
    !Array.isArray(input.items) ||
    input.items.length > MAX_PLAN_ITEMS
  )
    return invalid;
  const items: NamedPlan['items'][number][] = [];
  const raw: readonly unknown[] = input.items;
  for (const item of raw) {
    if (
      !isRecord(item) ||
      !isText(item.id, MAX_ID_LENGTH) ||
      !isText(item.name, 120) ||
      !isAmount(item.amount)
    )
      return invalid;
    items.push({ id: item.id, name: item.name, amount: item.amount });
  }
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    !addAmounts(items.map((item) => item.amount)).ok
  )
    return invalid;
  return { ok: true, value: { id: input.id, name: input.name, funding: input.funding, items } };
};

/** Derives allocated and remaining funding without clamping a shortfall.
 * @param plan Canonical named plan with a safe aggregate.
 * @returns Exact minor-unit allocation and signed remaining funding.
 * @throws When a caller supplies unsafe estimates instead of a canonical plan.
 */
export const summarizeNamedPlan = (plan: NamedPlan) => {
  const allocated = addAmounts(plan.items.map((item) => item.amount));
  if (!allocated.ok) throw new Error('Invalid named plan total.');
  return { allocated: allocated.value, remaining: plan.funding - allocated.value };
};
