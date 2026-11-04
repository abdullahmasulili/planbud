const { AndroidConfig, withAndroidColorsNight } = require('expo/config-plugins');

/** Gives the adaptive launcher icon a dark background; Android tints the monochrome mask itself.
 * @param config Expo configuration with the Buddy Wallet adaptive foreground.
 * @returns Config with an Android night-qualified icon background.
 */
const withBrandIcons = (config) =>
  withAndroidColorsNight(config, (mod) => {
    mod.modResults = AndroidConfig.Colors.setColorItem(
      { $: { name: 'iconBackground' }, _: '#005EAD' },
      mod.modResults,
    );
    return mod;
  });

module.exports = withBrandIcons;
