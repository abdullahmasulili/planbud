import type { Currency, MinorAmount } from '../domain/money';

/** Splits signed minor units exactly, before any locale presentation occurs.
 * @param amount Safe integer in the confirmed currency's minor units.
 * @param exponent Validated ISO currency exponent.
 * @returns Whole units, unsigned fractional digits, and original sign.
 * @throws When an invalid amount or exponent reaches the presentation boundary.
 */
const splitMinor = (amount: number, exponent: number) => {
  if (!Number.isSafeInteger(amount) || !Number.isInteger(exponent) || exponent < 0 || exponent > 4)
    throw new RangeError('Invalid amount formatting input.');
  const value = BigInt(amount);
  const absolute = value < 0n ? -value : value;
  const scale = 10n ** BigInt(exponent);
  return {
    whole: absolute / scale,
    fraction: exponent ? String(absolute % scale).padStart(exponent, '0') : '',
    negative: amount < 0,
  };
};

/** Builds editable locale-decimal input without rounding its last minor unit.
 * @param amount Nonnegative safe minor-unit amount.
 * @param currency Confirmed currency metadata.
 * @param locale Confirmed number-format locale.
 * @returns ASCII-digit amount with a locale decimal separator and no grouping.
 * @throws When invalid amount, currency exponent, or locale reaches this boundary.
 */
export const amountInput = (amount: MinorAmount, currency: Currency, locale: string): string => {
  const parts = splitMinor(amount, currency.exponent);
  if (parts.negative) throw new RangeError('Editable amounts must be nonnegative.');
  const separator =
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')
      ?.value ?? '.';
  return `${parts.whole}${parts.fraction ? separator + parts.fraction : ''}`;
};

/** Formats signed financial differences with exact fractional digits at every safe value.
 * @param amount Safe signed minor-unit amount.
 * @param currency Confirmed currency metadata.
 * @param locale Confirmed display locale.
 * @returns Localized currency text, retaining negative fractions smaller than one unit.
 * @throws When invalid formatting input reaches this presentation boundary.
 */
export const formatMoney = (amount: number, currency: Currency, locale: string): string => {
  const parts = splitMinor(amount, currency.exponent);
  // The whole-unit quotient remains a safe integer; Hermes Intl accepts numbers only.
  const absoluteWhole = Number(parts.whole);
  const whole = parts.negative ? -absoluteWhole : absoluteWhole;
  const digits = new Intl.NumberFormat(locale, { useGrouping: false });
  const fraction = [...parts.fraction].map((digit) => digits.format(Number(digit))).join('');
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.exponent,
    maximumFractionDigits: currency.exponent,
  });
  return formatter
    .formatToParts(whole)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
};
