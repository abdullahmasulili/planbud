import expoConfig from 'eslint-config-expo/flat.js';
import { parser, plugin } from 'typescript-eslint';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import { projectRules } from './tooling/eslint-rules.mjs';

export default [
  ...expoConfig,
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      '.superpowers/**',
      'android/**',
      'ios/**',
      'dist/**',
      'coverage/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,mjs}', 'plugins/with-offline-android.cjs'],
    plugins: { project: { rules: projectRules }, jsdoc: jsdocPlugin },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='require']", message: 'Use ES module imports.' },
        { selector: 'TSImportEqualsDeclaration', message: 'Use ES module imports.' },
        {
          selector: "AssignmentExpression[left.object.name='module'][left.property.name='exports']",
          message: 'Use ES module exports.',
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'project/arrow-functions': 'error',
      'project/document-contracts': 'error',
      'project/async-workflows': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
    },
  },
  {
    files: ['plugins/with-offline-android.cjs'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@typescript-eslint': plugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: true }],
    },
  },
];
