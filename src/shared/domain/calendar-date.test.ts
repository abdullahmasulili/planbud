import { monthOf, monthsInclusive, parseDate } from './calendar-date';

describe('calendar dates', () => {
  it('DATE-001 accepts a valid leap day', () => {
    expect(parseDate('2028-02-29')).toEqual({ ok: true, value: '2028-02-29' });
  });
  it.each([
    '2026-02-29',
    '2026-04-31',
    '0000-01-01',
    '2026-13-01',
    '2026-1-01',
    '2026-01-01T00:00:00Z',
  ])('DATE-001 rejects invalid date %s', (text) => {
    expect(parseDate(text).ok).toBe(false);
  });
  it('DATE-002 preserves the recorded calendar month', () => {
    expect(monthOf('2028-02-29')).toBe('2028-02');
  });
  it('DSS-004 includes both boundary months', () => {
    expect(monthsInclusive('2026-10', '2026-12')).toEqual({ ok: true, value: 3 });
    expect(monthsInclusive('2026-12', '2027-01')).toEqual({ ok: true, value: 2 });
    expect(monthsInclusive('2026-10', '2026-10')).toEqual({ ok: true, value: 1 });
    expect(monthsInclusive('2026-12', '2026-10').ok).toBe(false);
  });
});
