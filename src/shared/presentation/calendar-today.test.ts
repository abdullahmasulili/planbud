import { calendarToday } from './calendar-today';
it('DATE-002 uses local calendar parts without serializing records through UTC', () => {
  expect(calendarToday(new Date(2026, 9, 20, 23, 59))).toBe('2026-10-20');
  expect(() => calendarToday(new Date(NaN))).toThrow('Invalid device date.');
});
