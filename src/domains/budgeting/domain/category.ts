import { isRecord, isText } from '@/shared/domain/validation';
import type { Result } from '@/shared/domain/result';
import { MAX_ID_LENGTH, MAX_NAME_LENGTH } from '@/shared/domain/record-limits';

/** Stable spending category; archiving preserves references and historical spending. */
export type Category = {
  readonly id: string;
  readonly name: string;
  readonly kind: 'essential' | 'flexible';
  readonly archived: boolean;
};

/** Validates category metadata before persistence or backup import.
 * @param input Untrusted category record.
 * @returns Canonical category or actionable validation failure.
 */
export const parseCategory = (input: unknown): Result<Category> => {
  if (
    !isRecord(input) ||
    !isText(input.id, MAX_ID_LENGTH) ||
    !isText(input.name, MAX_NAME_LENGTH) ||
    (input.kind !== 'essential' && input.kind !== 'flexible') ||
    typeof input.archived !== 'boolean'
  )
    return {
      ok: false,
      error: {
        code: 'invalid-category',
        message: 'Enter a category name and choose essential or flexible.',
      },
    };
  return {
    ok: true,
    value: { id: input.id, name: input.name.trim(), kind: input.kind, archived: input.archived },
  };
};
