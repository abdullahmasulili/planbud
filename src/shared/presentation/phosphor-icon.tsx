import createIconSet from '@expo/vector-icons/createIconSet';
import font from '../../../assets/fonts/Phosphor-Regular.ttf';

const glyphs = {
  archive: 0xe00c,
  calendar: 0xe108,
  'caret-down': 0xe136,
  check: 0xe182,
  'circle-half': 0xe18c,
  flag: 0xe244,
  folder: 0xe24a,
  gear: 0xe270,
  house: 0xe2c2,
  key: 0xe2d6,
  notebook: 0xe34e,
  plus: 0xe3d4,
  receipt: 0xe3ec,
  'shield-check': 0xe40c,
  translate: 0xe4a2,
  trash: 0xe4a6,
  x: 0xe4f6,
  wallet: 0xe68a,
  coins: 0xe78e,
};

/** Phosphor Regular glyph names included in the local font. */
export type PhosphorGlyph = keyof typeof glyphs;

export const PhosphorIcon = createIconSet(glyphs, 'Phosphor', font);

/** Adapts a Phosphor glyph to a Paper icon slot with Paper's size and theme color.
 * @param name Bundled glyph.
 * @returns The renderer used by the surrounding Paper control.
 */
export const phosphorIcon = (name: PhosphorGlyph) => {
  const PaperIcon = ({ size, color }: { size: number; color: string }) => (
    <PhosphorIcon
      name={name}
      size={size}
      color={color}
      allowFontScaling={false}
      accessible={false}
    />
  );
  return PaperIcon;
};
