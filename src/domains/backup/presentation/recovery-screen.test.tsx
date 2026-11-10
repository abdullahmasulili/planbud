import { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import type { RecoveryService } from '../application/public';
import type { SensitiveScreenPort } from '../application/sensitive-screen-port';
import { RecoveryScreen } from './recovery-screen';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

it('displays all 12 recovery words in order as read-only fields until hidden', async () => {
  jest.mocked(useFocusEffect).mockImplementation((effect) => useEffect(effect, [effect]));
  const words = Array.from({ length: 12 }, (_, index) => `sample-${index + 1}`);
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
      <RecoveryScreen service={service} protection={protection} />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Reveal existing phrase' }));

  const fields = screen.getAllByLabelText(/^Recovery word \d+$/);
  expect(fields.map((field) => field.props.value)).toEqual(words);
  fields.forEach((field, index) => {
    expect(field).toHaveProp('accessibilityLabel', `Recovery word ${index + 1}`);
    expect(field).toHaveProp('editable', false);
    expect(field).toHaveProp('contextMenuHidden', true);
    expect(field).toHaveProp('autoComplete', 'off');
    expect(field).toHaveProp('importantForAutofill', 'no');
  });

  await fireEvent.press(screen.getByRole('button', { name: 'Hide phrase' }));
  expect(screen.queryAllByLabelText(/^Recovery word \d+$/)).toHaveLength(0);
  expect(dispose).toHaveBeenCalledTimes(1);
}, 30000);
