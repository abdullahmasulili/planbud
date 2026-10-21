import type { Result } from './result';
import exponents from './currencies.json';

/** An integer amount in a currency's minor unit, validated before persistence. */
export type MinorAmount = number;
/** ISO currency identity and its canonical number of minor-unit decimal places. */
export type Currency = { readonly code: string; readonly exponent: number };

const currencyExponents: Readonly<Record<string, number>> = exponents;

/** Builds a safe field failure without echoing private input.
 * @returns A reusable monetary validation outcome.
 */
const invalidAmount = (): Result<never> => ({
  ok: false,
  error: { code: 'invalid-amount', message: 'Enter a valid amount without digit grouping.' },
});

/** Parses editable monetary input without rounding fractional values.
 * @param text Unformatted input from a monetary field.
 * @param currency Currency determining precision.
 * @param locale Locale determining the decimal separator.
 * @returns A validated minor-unit amount or a field error.
 */
export const parseAmount = (
  text: string,
  currency: Currency,
  locale: string,
): Result<MinorAmount> => {
  const canonical = currencyFor(currency.code);
  if (!canonical.ok || canonical.value.exponent !== currency.exponent || text.length > 40)
    return invalidAmount();
  try {
    const separator =
      new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')
        ?.value ?? '.';
    const normalized = text.trim().replace(separator, '.');
    if (!/^\d+(?:\.\d+)?$/.test(normalized) || (separator !== '.' && text.includes('.')))
      return invalidAmount();
    const [whole = '', fraction = ''] = normalized.split('.');
    if (fraction.length > currency.exponent) return invalidAmount();
    const amount =
      BigInt(whole) * 10n ** BigInt(currency.exponent) +
      BigInt(fraction.padEnd(currency.exponent, '0') || '0');
    if (amount > BigInt(Number.MAX_SAFE_INTEGER)) return invalidAmount();
    return { ok: true, value: Number(amount) };
  } catch {
    return invalidAmount();
  }
};

/** Adds nonnegative amounts while guarding the safe-integer boundary.
 * @param values Amounts already expressed in the same minor unit.
 * @returns The sum or an overflow/input error.
 */
export const addAmounts = (values: readonly MinorAmount[]): Result<MinorAmount> => {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(total + value))
      return invalidAmount();
    total += value;
  }
  return { ok: true, value: total };
};

/** Resolves canonical minor-unit precision from the packaged ISO 4217 reference.
 * @param code Three-letter currency code.
 * @returns A supported currency or a validation error.
 */
export const currencyFor = (code: string): Result<Currency> => {
  const exponent = currencyExponents[code];
  return typeof exponent === 'number'
    ? { ok: true, value: { code, exponent } }
    : { ok: false, error: { code: 'invalid-currency', message: 'Choose a supported currency.' } };
};
