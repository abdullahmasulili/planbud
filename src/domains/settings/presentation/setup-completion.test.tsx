import { AccessibilityInfo, Animated } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { SetupCompletion } from './setup-completion';

it.each(['reduced', 'unavailable'])(
  'shows completion without flight when motion is %s',
  async (mode) => {
    const preference = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled');
    if (mode === 'reduced') preference.mockResolvedValue(true);
    else preference.mockRejectedValue(new Error('unavailable'));
    const sequence = jest.spyOn(Animated, 'sequence');
    await render(
      <TestScreen>
        <SetupCompletion />
      </TestScreen>,
    );
    expect(
      screen.getByTestId('setup-completion', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(sequence).not.toHaveBeenCalled();
  },
);
