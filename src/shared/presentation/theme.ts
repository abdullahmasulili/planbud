import type { MD3Theme } from 'react-native-paper';
import { configureFonts, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { DarkTheme, DefaultTheme } from 'expo-router';
import type { ColorSchemeName } from 'react-native';
import type { Theme } from 'expo-router';

/** Resolves a persisted preference against the current Android system setting.
 * @param preference Durable user appearance preference.
 * @param system Current reactive system scheme.
 * @returns A concrete theme; devices without a scheme use light.
 */
export const resolveScheme = (
  preference: 'system' | 'light' | 'dark',
  system: ColorSchemeName | null,
): 'light' | 'dark' =>
  preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

/** Coordinates Material, router, and bundled typography without a second navigator.
 * @param mode Resolved light or dark scheme.
 * @returns Paper and router roles sharing font, surfaces, and contrast-safe text.
 */
export const buildTheme = (mode: 'light' | 'dark') => {
  const base = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const roles =
    mode === 'dark'
      ? {
          primary: '#A3C9FF',
          onPrimary: '#00315D',
          primaryContainer: '#004883',
          onPrimaryContainer: '#D4E3FF',
          background: '#111318',
          onBackground: '#E2E2E9',
          surface: '#111318',
          onSurface: '#E2E2E9',
          surfaceVariant: '#424750',
          onSurfaceVariant: '#C3C7D1',
          outline: '#8D9199',
          error: '#FFB4AB',
          onError: '#690005',
        }
      : {
          primary: '#005EAD',
          onPrimary: '#FFFFFF',
          primaryContainer: '#D4E3FF',
          onPrimaryContainer: '#001C38',
          background: '#F9FAFD',
          onBackground: '#191C20',
          surface: '#F9FAFD',
          onSurface: '#191C20',
          surfaceVariant: '#E0E3EC',
          onSurfaceVariant: '#424750',
          outline: '#73777E',
          error: '#BA1A1A',
          onError: '#FFFFFF',
        };
  const fonts = configureFonts({ config: { fontFamily: 'Plus Jakarta Sans' } });
  const paper: MD3Theme = {
    ...base,
    roundness: 3,
    colors: { ...base.colors, ...roles },
    fonts: {
      ...fonts,
      titleLarge: { ...fonts.titleLarge, fontWeight: '600' },
      headlineSmall: { ...fonts.headlineSmall, fontWeight: '600' },
    },
  };
  const navigation = mode === 'dark' ? DarkTheme : DefaultTheme;
  const router: Theme = {
    ...navigation,
    colors: {
      ...navigation.colors,
      primary: roles.primary,
      background: roles.background,
      card: roles.surface,
      text: roles.onSurface,
      border: roles.outline,
      notification: roles.error,
    },
    fonts: {
      regular: { fontFamily: 'Plus Jakarta Sans', fontWeight: '400' },
      medium: { fontFamily: 'Plus Jakarta Sans', fontWeight: '500' },
      bold: { fontFamily: 'Plus Jakarta Sans', fontWeight: '700' },
      heavy: { fontFamily: 'Plus Jakarta Sans', fontWeight: '700' },
    },
  };
  return { paper, router };
};
