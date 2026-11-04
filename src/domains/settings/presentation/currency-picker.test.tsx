import { BackHandler } from 'react-native';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import exponents from '@/shared/domain/currencies.json';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { CurrencyPicker } from './currency-picker';
import names from './currency-names.json';

it('bundles a full display name for every supported currency without changing monetary precision', () => {
  expect(Object.keys(names).sort()).toEqual(Object.keys(exponents).sort());
  for (const [code, name] of Object.entries(names)) {
    expect(name.trim().length).toBeGreaterThan(3);
    expect(name).not.toEqual(code);
  }
  expect(names.IDR).toBe('Indonesia Rupiah');
});

it('dismisses the dropdown without changing the selected currency', async () => {
  const onChange = jest.fn();
  const back = jest.spyOn(BackHandler, 'addEventListener');
  await render(
    <TestScreen>
      <CurrencyPicker value="JPY" onChange={onChange} />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Currency code' }));
  expect(
    await screen.findByRole('menuitem', { name: 'JPY - Japanese Yen', selected: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Close currency picker' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Currency code' }).props.accessibilityState,
  ).toMatchObject({
    expanded: false,
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Currency code' }));
  await act(() => {
    expect(back.mock.calls.at(-1)?.[1]({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);
  });
  expect(screen.queryByRole('menuitem')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});
