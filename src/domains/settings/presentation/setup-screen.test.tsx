import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { SetupScreen } from './setup-screen';
import { createProfileService } from '../application/profile-service';
import type { ProfilePort } from '../application/public';

it('SET-001 requires explicit currency confirmation before persistence', async () => {
  const repository: ProfilePort = {
    /** Models the first-launch state.
     * @returns No saved profile.
     */
    read: async () => null,
    /** Echoes the profile after recording the test mutation.
     * @param profile Proposed profile.
     * @returns Confirmed profile.
     */
    initialize: jest.fn(async (profile) => profile),
    /** Completes the unused appearance mutation. */
    setAppearance: async () => {},
  };
  const confirmed = jest.fn();
  await render(
    <TestScreen>
      <SetupScreen
        service={createProfileService(repository)}
        suggestedLocale="en-US"
        suggestedCurrency="USD"
        onConfirmed={confirmed}
      />
    </TestScreen>,
  );
  expect(screen.getByDisplayValue('USD')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Start planning' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('button', { name: 'Start planning' }));
  expect(repository.initialize).toHaveBeenCalledTimes(1);
  expect(confirmed).toHaveBeenCalledWith(
    expect.objectContaining({ currency: { code: 'USD', exponent: 2 } }),
  );
}, 30000);
