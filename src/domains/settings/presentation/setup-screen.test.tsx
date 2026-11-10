import { useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestScreen } from '../../../../tests/helpers/test-screen';
import { SetupScreen } from './setup-screen';
import { createProfileService } from '../application/profile-service';
import type { ProfilePort } from '../application/public';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: jest.fn(),
}));
beforeEach(() => {
  jest.mocked(useFocusEffect).mockImplementation((effect) => useEffect(effect, [effect]));
});

/** Supplies a durable boundary without native storage for onboarding interactions.
 * @returns An empty profile repository with observable initialization.
 */
const repositoryForSetup = (): ProfilePort => ({
  /** Records local language selection. */
  setLocale: jest.fn(async () => {}),
  /** Models first launch.
   * @returns No confirmed profile.
   */
  read: async () => null,
  /** Records the complete confirmation command.
   * @param profile Proposed settings.
   * @returns Durably confirmed settings.
   */
  initialize: jest.fn(async (profile) => profile),
  /** Completes the unused appearance mutation. */
  setAppearance: async () => {},
});

it('requires storage consent and currency confirmation; saves only after the final step', async () => {
  const repository = repositoryForSetup();
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
  expect(screen.getByText('Meet PlanBud')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Show mock data' })).toBeNull();
  expect(screen.queryByRole('switch', { name: 'Mock data preview' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Allow protected storage' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('button', { name: 'Currency code' })).toHaveAccessibilityValue({
    text: 'USD - US Dollar',
  });
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('You’re ready to plan the future')).toBeOnTheScreen();
  expect(repository.initialize).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('checkbox', { checked: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Currency code' }));
  await fireEvent.press(
    await screen.findByRole('menuitem', { name: 'AED - United Arab Emirates Dirham' }),
  );
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Bahasa Indonesia' }));
  expect(screen.getByText('Sesuaikan untuk Anda')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Lanjutkan' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Mulai' }));
  expect(repository.initialize).toHaveBeenCalledTimes(1);
  expect(confirmed).toHaveBeenCalledWith(
    expect.objectContaining({
      currency: { code: 'AED', exponent: 2 },
      locale: 'id-ID',
      appearance: 'dark',
    }),
  );
}, 30000);

it('retains the final step and preferences after a failed save and allows retry', async () => {
  const repository: ProfilePort = {
    ...repositoryForSetup(),
    initialize: jest
      .fn()
      .mockRejectedValueOnce(new Error('full'))
      .mockImplementation(async (profile) => profile),
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
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Allow protected storage' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
  expect(confirmed).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(/Unable to confirm settings/);
  await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
  expect(confirmed).toHaveBeenCalledTimes(1);
}, 30000);

it('shows IDR in the dropdown, removes the shortcut, and preserves confirmation on reselection', async () => {
  const repository = repositoryForSetup();
  const confirmed = jest.fn();
  await render(
    <TestScreen>
      <SetupScreen
        service={createProfileService(repository)}
        suggestedLocale="en-US"
        suggestedCurrency="IDR"
        onConfirmed={confirmed}
      />
    </TestScreen>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Allow protected storage' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.press(screen.getByRole('checkbox'));
  expect(screen.queryByRole('button', { name: 'Indonesian rupiah (IDR)' })).toBeNull();
  expect(screen.queryByRole('textbox', { name: 'Currency code' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Currency code' }));
  await fireEvent.press(await screen.findByRole('menuitem', { name: 'IDR - Indonesia Rupiah' }));
  expect(screen.getByRole('checkbox', { checked: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Bahasa Indonesia' }));
  expect(screen.getByRole('button', { name: 'Kode mata uang' })).toHaveAccessibilityValue({
    text: 'IDR - Indonesia Rupiah',
  });
  expect(screen.getByRole('checkbox', { checked: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Lanjutkan' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Mulai' }));
  expect(confirmed).toHaveBeenCalledWith(
    expect.objectContaining({ currency: { code: 'IDR', exponent: 2 }, locale: 'id-ID' }),
  );
});
