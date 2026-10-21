import { amountInput, formatMoney } from './money-format';

it('UI-003 passes only safe numbers to native Intl implementations without BigInt formatting support', () => {
  const calls = jest.spyOn(Intl.NumberFormat.prototype, 'formatToParts');
  try {
    expect(formatMoney(0, { code: 'USD', exponent: 2 }, 'en-US')).toBe('$0.00');
    expect(formatMoney(Number.MAX_SAFE_INTEGER, { code: 'JPY', exponent: 0 }, 'en-US')).toBe(
      '¥9,007,199,254,740,991',
    );
    expect(
      calls.mock.calls.every(([value]) => typeof value === 'number' && Number.isSafeInteger(value)),
    ).toBe(true);
  } finally {
    calls.mockRestore();
  }
});

it('MONEY-001 preserves the last minor unit when formatting maximum safe amounts', () => {
  expect(amountInput(Number.MAX_SAFE_INTEGER, { code: 'USD', exponent: 2 }, 'en-US')).toBe(
    '90071992547409.91',
  );
  expect(formatMoney(Number.MAX_SAFE_INTEGER, { code: 'USD', exponent: 2 }, 'en-US')).toBe(
    '$90,071,992,547,409.91',
  );
  expect(amountInput(1234, { code: 'USD', exponent: 2 }, 'id-ID')).toBe('12,34');
  expect(formatMoney(-1, { code: 'USD', exponent: 2 }, 'en-US')).toBe('-$0.01');
  expect(amountInput(1234, { code: 'JPY', exponent: 0 }, 'ja-JP')).toBe('1234');
});
