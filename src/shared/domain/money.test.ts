import { addAmounts, currencyFor, parseAmount } from './money';

describe('currency-safe amounts', () => {
  it('MONEY-001 preserves decimal-comma precision', () => {
    expect(parseAmount('12,50', { code: 'USD', exponent: 2 }, 'id-ID')).toEqual({
      ok: true,
      value: 1250,
    });
  });
  it('MONEY-001 supports zero and three-decimal currencies', () => {
    expect(parseAmount('150', { code: 'JPY', exponent: 0 }, 'en-US')).toEqual({
      ok: true,
      value: 150,
    });
    expect(parseAmount('1.234', { code: 'KWD', exponent: 3 }, 'en-US')).toEqual({
      ok: true,
      value: 1234,
    });
  });
  it.each(['1,234.56', '-1', 'NaN', 'Infinity', '', '0.001', '1e5', '9007199254740992'])(
    'MONEY-001 rejects ambiguous or unsafe input %s',
    (text) => {
      expect(parseAmount(text, { code: 'USD', exponent: 2 }, 'en-US').ok).toBe(false);
    },
  );
  it('MONEY-001 rejects decimal fractions for JPY and mismatched currency precision', () => {
    expect(parseAmount('1.5', { code: 'JPY', exponent: 0 }, 'en-US').ok).toBe(false);
    expect(parseAmount('1', { code: 'USD', exponent: 0 }, 'en-US').ok).toBe(false);
  });
  it('MONEY-001 converts the largest safe cent amount exactly', () => {
    expect(parseAmount('90071992547409.91', { code: 'USD', exponent: 2 }, 'en-US')).toEqual({
      ok: true,
      value: Number.MAX_SAFE_INTEGER,
    });
  });
  it('MONEY-001 protects addition against invalid values and overflow', () => {
    expect(addAmounts([10, 20, 0])).toEqual({ ok: true, value: 30 });
    expect(addAmounts([Number.MAX_SAFE_INTEGER, 1]).ok).toBe(false);
    expect(addAmounts([1, -1]).ok).toBe(false);
    expect(addAmounts([Number.NaN]).ok).toBe(false);
  });
  it('MONEY-001 resolves canonical precision and rejects unknown currencies', () => {
    expect(currencyFor('JPY')).toEqual({ ok: true, value: { code: 'JPY', exponent: 0 } });
    expect(currencyFor('KWD')).toEqual({ ok: true, value: { code: 'KWD', exponent: 3 } });
    expect(currencyFor('XYZ').ok).toBe(false);
  });
});
