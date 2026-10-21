/** Jest owns this CommonJS entry; preserve its native exclusions while transforming ESM crypto. */
const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  watchman: false,
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.superpowers/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.replace('(?!(.pnpm|', '(?!(.pnpm|@scure|@noble|'),
  ),
};
