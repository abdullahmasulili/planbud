/** Narrows external objects before property access without unchecked assertions.
 * @param value Untrusted input from storage, JSON, or a form boundary.
 * @returns Whether input is a non-array record.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Narrows minor-unit amounts to exact, nonnegative JavaScript integers.
 * @param value Untrusted monetary amount.
 * @returns Whether it can be safely stored and added with overflow checking.
 */
export const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Validates bounded, nonempty portable record identifiers and labels.
 * @param value Untrusted text.
 * @param maximum Maximum UTF-16 length accepted by the application.
 * @returns Whether trimmed text is nonempty and bounded.
 */
export const isText = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= maximum * 2 &&
  [...value].length <= maximum &&
  !value.includes('\u0000');
