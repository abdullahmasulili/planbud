import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native-paper';
import { TestScreen } from '../../../tests/helpers/test-screen';
import { AppDialog } from './dialog';

it('UI-005 keeps Android back dismissal inside the active native window and respects busy state', async () => {
  const dismiss = jest.fn();
  await render(
    <TestScreen>
      <AppDialog visible dismissable={false} onDismiss={dismiss}>
        <Text>Review changes</Text>
      </AppDialog>
    </TestScreen>,
  );
  await fireEvent(screen.getByTestId('dialog-window'), 'requestClose');
  expect(dismiss).not.toHaveBeenCalled();
  await screen.rerender(
    <TestScreen>
      <AppDialog visible onDismiss={dismiss}>
        <Text>Review changes</Text>
      </AppDialog>
    </TestScreen>,
  );
  await fireEvent(screen.getByTestId('dialog-window'), 'requestClose');
  expect(dismiss).toHaveBeenCalledTimes(1);
  await screen.rerender(
    <TestScreen>
      <AppDialog visible={false} onDismiss={dismiss}>
        <Text>Review changes</Text>
      </AppDialog>
    </TestScreen>,
  );
  expect(screen.queryByTestId('dialog-window')).toBeNull();
});
