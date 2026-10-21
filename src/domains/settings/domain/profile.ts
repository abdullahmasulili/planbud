import type { Currency } from '@/shared/domain/money';
import { currencyFor } from '@/shared/domain/money';
import type { Result } from '@/shared/domain/result';
import { isText } from '@/shared/domain/validation';

/** Confirmed local identity; its currency is immutable until a full data reset. */
export type Profile = {
  readonly id: string;
  readonly currency: Currency;
  readonly locale: string;
  readonly appearance: 'system' | 'light' | 'dark';
};

/** Validates persisted or proposed profile metadata against bundled currency data.
 * @param value Untrusted profile-shaped input.
 * @returns Canonical profile or a sanitized validation failure.
 */
export const parseProfile = (value: unknown): Result<Profile> => {
  const invalid: Result<never> = {
    ok: false,
    error: { code: 'invalid-profile', message: 'Choose a supported currency and language.' },
  };
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !isText(value.id, 100) ||
    !('locale' in value) ||
    typeof value.locale !== 'string' ||
    value.locale.length > 100 ||
    !('appearance' in value) ||
    !['system', 'light', 'dark'].includes(String(value.appearance)) ||
    !('currency' in value) ||
    typeof value.currency !== 'object' ||
    value.currency === null ||
    !('code' in value.currency) ||
    typeof value.currency.code !== 'string' ||
    !('exponent' in value.currency)
  )
    return invalid;
  const currency = currencyFor(value.currency.code);
  if (!currency.ok || currency.value.exponent !== value.currency.exponent) return invalid;
  const appearance = value.appearance;
  if (appearance !== 'system' && appearance !== 'light' && appearance !== 'dark') return invalid;
  try {
    if (Intl.getCanonicalLocales(value.locale).length !== 1) return invalid;
    return {
      ok: true,
      value: { id: value.id, currency: currency.value, locale: value.locale, appearance },
    };
  } catch {
    return invalid;
  }
};
