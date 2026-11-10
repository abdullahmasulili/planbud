import { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';
import { setStringAsync } from 'expo-clipboard';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import type { RecoveryService } from '../application/public';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';
import { copyRecoveryPhrase } from '../infrastructure/recovery-clipboard';
import { RecoveryScreen } from './recovery-screen';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

it('reveals ordinal-labeled read-only fields and copies them only on request', async () => {
  jest.mocked(useFocusEffect).mockImplementation((effect) => useEffect(effect, [effect]));
  const copy = jest.mocked(setStringAsync).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const words = Array.from({ length: 12 }, (_, index) => `sample-${index + 1}`);
  const ordinals = [
    'First',
    'Second',
    'Third',
    'Fourth',
    'Fifth',
    'Sixth',
    'Seventh',
    'Eighth',
    'Ninth',
    'Tenth',
    'Eleventh',
    'Twelfth',
  ];
  const dispose = jest.fn();
  const service: RecoveryService = {
    create: jest.fn(),
    resume: jest.fn(),
    status: jest.fn(),
    reveal: jest.fn().mockResolvedValue({
      ok: true,
      value: { words: jest.fn().mockReturnValue(words.join(' ')), dispose },
    }),
  };
  const protection: SensitiveScreenPort = {
    acquire: jest.fn().mockResolvedValue('test-lease'),
    release: jest.fn().mockResolvedValue(undefined),
  };

  await render(
    <TestScreen>
      <RecoveryScreen service={service} protection={protection} copyPhrase={copyRecoveryPhrase} />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Reveal existing phrase' }));

  expect(copy).not.toHaveBeenCalled();
  const fields = screen.getAllByLabelText(/^Recovery word /);
  expect(fields.map((field) => field.props.value)).toEqual(words);
  expect(fields.map((field) => field.props.accessibilityLabel)).toEqual(
    ordinals.map((ordinal) => `Recovery word ${ordinal}`),
  );
  ordinals.forEach((ordinal) => expect(screen.getByText(ordinal)).toBeOnTheScreen());
  fields.forEach((field) => {
    expect(field).toHaveProp('editable', false);
    expect(field).toHaveProp('contextMenuHidden', true);
    expect(field).toHaveProp('autoComplete', 'off');
    expect(field).toHaveProp('importantForAutofill', 'no');
  });

  const copyButton = screen.getByRole('button', { name: 'Copy to clipboard' });
  await fireEvent.press(copyButton);
  expect(screen.getByText('Unable to copy the recovery phrase.')).toBeOnTheScreen();
  expect(screen.queryByText('Recovery phrase copied.')).toBeNull();
  await fireEvent.press(copyButton);
  expect(copy).toHaveBeenLastCalledWith(words.join(' '), { android: { isSensitive: true } });
  expect(screen.getByText('Recovery phrase copied.')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Hide phrase' }));
  expect(screen.queryAllByLabelText(/^Recovery word /)).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Copy to clipboard' })).toBeNull();
  expect(screen.queryByText('Recovery phrase copied.')).toBeNull();
  expect(dispose).toHaveBeenCalledTimes(1);
}, 30000);
