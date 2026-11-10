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
    /** Records local language selection. */
    setLocale: jest.fn(async () => {}),
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

it('saves the selected language through settings before updating the projection', async () => {
  const profile: Profile = {
    id: 'personal',
    currency: { code: 'USD', exponent: 2 },
    locale: 'en-US',
    appearance: 'system',
  };
  const repository: ProfilePort = {
    /** Reads existing settings.
     * @returns Confirmed profile.
     */
    read: async () => profile,
    /** Returns the confirmed test identity.
     * @param input Profile input.
     * @returns Confirmed input.
     */
    initialize: async (input) => input,
    /** Models the unused appearance write. */
    setAppearance: async () => {},
    /** Records locale writes. */
    setLocale: jest.fn(async () => {}),
  };
  const updated = jest.fn();
  await render(
    <TestScreen>
      <SettingsScreen
        profile={profile}
        service={createProfileService(repository)}
        onUpdated={updated}
      />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('radio', { name: 'Bahasa Indonesia' }));
  expect(repository.setLocale).toHaveBeenCalledWith('id-ID');
  expect(updated).toHaveBeenCalledWith({ ...profile, locale: 'id-ID' });
});

it('UI-007 DEV-001 DEV-002 exposes local data actions and switches the developer action in preview', async () => {
  const profile: Profile = {
    id: 'personal',
    currency: { code: 'USD', exponent: 2 },
    locale: 'en-US',
    appearance: 'system',
  };
  const service = {
    load: jest.fn(),
    confirm: jest.fn(),
    changeAppearance: jest.fn(),
    changeLocale: jest.fn(),
  };
  const onUpdated = jest.fn();
  const onBackup = jest.fn();
  const onRestore = jest.fn();
  const onRecovery = jest.fn();
  const onShowMockData = jest.fn();
  const onExitPreview = jest.fn();
  const view = await render(
    <TestScreen>
      <SettingsScreen
        profile={profile}
        service={service}
        onUpdated={onUpdated}
        onBackup={onBackup}
        onRestore={onRestore}
        onRecovery={onRecovery}
        onShowMockData={onShowMockData}
      />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Back up data' }));
  expect(onBackup).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Restore data' }));
  expect(onRestore).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage recovery phrase' }));
  expect(onRecovery).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Show mock data' }));
  expect(onShowMockData).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Exit preview' })).toBeNull();

  await view.rerender(
    <TestScreen>
      <SettingsScreen
        profile={profile}
        service={service}
        onUpdated={onUpdated}
        onExitPreview={onExitPreview}
      />
    </TestScreen>,
  );
  expect(screen.queryByRole('button', { name: 'Show mock data' })).toBeNull();
  expect(screen.queryByText('Local data')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Exit preview' }));
  expect(onExitPreview).toHaveBeenCalledTimes(1);
});
