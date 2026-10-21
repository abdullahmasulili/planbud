import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { SettingsScreen } from './settings-screen';
import { createProfileService } from '../application/profile-service';
import type { Profile, ProfilePort } from '../application/public';

it('UI-005 exposes exclusive appearance choices as checked native radio controls', async () => {
  const profile: Profile = {
    id: 'personal',
    currency: { code: 'USD', exponent: 2 },
    locale: 'en-US',
    appearance: 'system',
  };
  const repository: ProfilePort = {
    /** Supplies the confirmed test profile.
     * @returns Stored test settings.
     */
    read: async () => profile,
    /** Echoes confirmation for the unused setup operation.
     * @param input Test profile.
     * @returns The confirmed input.
     */
    initialize: async (input) => input,
    /** Records the durable appearance command without a native database. */
    setAppearance: jest.fn(async () => {}),
  };
  const updated = jest.fn();
  const service = createProfileService(repository);
  const view = await render(
    <TestScreen>
      <SettingsScreen profile={profile} service={service} onUpdated={updated} />
    </TestScreen>,
  );
  expect(
    screen.getByRole('radio', { name: 'Use device setting', checked: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
  expect(repository.setAppearance).toHaveBeenCalledWith('dark');
  expect(updated).toHaveBeenCalledWith({ ...profile, appearance: 'dark' });
  await view.rerender(
    <TestScreen>
      <SettingsScreen
        profile={{ ...profile, appearance: 'dark' }}
        service={service}
        onUpdated={updated}
      />
    </TestScreen>,
  );
  expect(screen.getByRole('radio', { name: 'Dark', checked: true })).toBeOnTheScreen();
}, 30000);
