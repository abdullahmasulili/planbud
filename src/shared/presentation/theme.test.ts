import { buildTheme } from './theme';

/** Computes WCAG relative luminance from a six-digit semantic role color.
 * @param hex Material role represented as RGB hex.
 * @returns Linearized relative luminance.
 */
const luminance = (hex: string) => {
  const components = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return (
    (components[0] ?? 0) * 0.2126 + (components[1] ?? 0) * 0.7152 + (components[2] ?? 0) * 0.0722
  );
};

it.each(['light', 'dark'] satisfies readonly ('light' | 'dark')[])(
  'UI-001 uses bundled typography and readable %s role pairs',
  (mode) => {
    const { paper, router } = buildTheme(mode);
    expect(paper.fonts.bodyLarge.fontFamily).toBe('Plus Jakarta Sans');
    expect(router.fonts.bold.fontFamily).toBe('Plus Jakarta Sans');
    const c = paper.colors;
    for (const [foreground, background] of [
      [c.onPrimary, c.primary],
      [c.onBackground, c.background],
      [c.onSurfaceVariant, c.surfaceVariant],
      [c.onError, c.error],
      [c.onPrimaryContainer, c.primaryContainer],
    ]) {
      if (!foreground || !background) throw new Error('Missing theme role pair.');
      const a = luminance(foreground);
      const b = luminance(background);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  },
);
