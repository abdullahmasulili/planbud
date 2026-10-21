import { createSettingsStore } from './settings-store';
import { resolveScheme } from '@/shared/presentation/theme';
import type { Profile } from '../application/public';
const profile: Profile = {
  id: 'personal',
  currency: { code: 'USD', exponent: 2 },
  locale: 'en-US',
  appearance: 'system',
};

it('STATE-001 isolates projections and resets them without persisting another data copy', () => {
  const first = createSettingsStore(profile);
  const second = createSettingsStore(profile);
  first.getState().replaceProfile({ ...profile, appearance: 'dark' });
  expect(first.getState().profile?.appearance).toBe('dark');
  expect(second.getState().profile?.appearance).toBe('system');
  first.getState().replaceProfile(null);
  expect(first.getState().profile).toBeNull();
});

it('UI-002 follows system changes only when the system scheme is selected', () => {
  expect(resolveScheme('system', 'light')).toBe('light');
  expect(resolveScheme('system', 'dark')).toBe('dark');
  expect(resolveScheme('light', 'dark')).toBe('light');
  expect(resolveScheme('dark', 'light')).toBe('dark');
  expect(resolveScheme('system', null)).toBe('light');
});
