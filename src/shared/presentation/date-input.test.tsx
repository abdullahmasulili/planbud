import { fireEvent, render, screen } from '@testing-library/react-native';
import { TestScreen } from '../../../tests/helpers/test-screen';
import { DateInput } from './date-input';
import { LocaleContext } from './i18n';

it('DATE-001 opens on the saved calendar date and preserves it when cancelled', async () => {
  const change = jest.fn();
  await render(
    <TestScreen>
      <DateInput label="Transaction date" value="2026-10-20" onChangeText={change} />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Transaction date' }));
  const picker = screen.getByTestId('native-date-picker');
  expect(picker.props.initialDate).toBe('2026-10-20');
  await fireEvent(picker, 'dismissRequest');
  expect(change).not.toHaveBeenCalled();
  expect(screen.queryByTestId('native-date-picker')).toBeNull();
});

it('DATE-002 retains the calendar day returned by Compose in UTC even in a western timezone', async () => {
  const change = jest.fn();
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    await render(
      <TestScreen>
        <DateInput label="Contribution date" value="2026-10-20" onChangeText={change} />
      </TestScreen>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Contribution date' }));
    await fireEvent(
      screen.getByTestId('native-date-picker'),
      'dateSelected',
      new Date('2026-11-01T00:00:00Z'),
    );
    expect(change).toHaveBeenCalledWith('2026-11-01');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

it('DATE-001 supports clearing an optional deadline and disables picker interaction while saving', async () => {
  const change = jest.fn();
  const view = await render(
    <TestScreen>
      <DateInput label="Goal deadline" value="2026-10-20" onChangeText={change} optional />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Clear goal deadline' }));
  expect(change).toHaveBeenCalledWith('');
  await view.rerender(
    <TestScreen>
      <DateInput label="Goal deadline" value="" onChangeText={change} optional disabled />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Goal deadline' }));
  expect(screen.queryByTestId('native-date-picker')).toBeNull();
});

it('DATE-002 chooses a whole month across years and leaves it unchanged on cancellation', async () => {
  const change = jest.fn();
  await render(
    <TestScreen>
      <DateInput label="History month" value="2026-12" onChangeText={change} mode="month" />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'History month' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next year' }));
  await fireEvent.press(screen.getByRole('button', { name: 'January 2027' }));
  expect(change).toHaveBeenCalledWith('2027-01');
  change.mockClear();
  await fireEvent.press(screen.getByRole('button', { name: 'History month' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(change).not.toHaveBeenCalled();
});

it('UI-013 uses the saved Indonesian locale for month names and picker actions', async () => {
  const change = jest.fn();
  await render(
    <TestScreen>
      <LocaleContext.Provider value="id-ID">
        <DateInput label="Bulan riwayat" value="2026-10" onChangeText={change} mode="month" />
      </LocaleContext.Provider>
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Bulan riwayat' }));
  expect(screen.getByRole('button', { name: 'Tahun sebelumnya' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Batal' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Januari 2026' }));
  expect(change).toHaveBeenCalledWith('2026-01');
});

it('UI-013 translates optional deadline clearing without changing its date value', async () => {
  const change = jest.fn();
  await render(
    <TestScreen>
      <LocaleContext.Provider value="id-ID">
        <DateInput label="Tenggat tujuan" value="2026-10-20" onChangeText={change} optional />
      </LocaleContext.Provider>
    </TestScreen>,
  );
  expect(screen.getByText('2026-10-20')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Hapus tenggat tujuan' }));
  expect(change).toHaveBeenCalledWith('');
});
