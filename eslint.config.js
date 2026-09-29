// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      '.expo/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'dist/**',
      'dist-web/**',
      'docs/**',
      'functions/**',
      'node_modules/**',
      'scripts/**',
      'templates/**',
      '.agents/**',
      '.claude/**',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      // AGENTS.md §4: no hardcoded UI strings — JSX text and user-visible props only.
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: ['accessibilityLabel', 'accessibilityHint', 'placeholder', 'title', 'label', 'aria-label'],
          },
        },
      ],
      'no-console': 'error',
    },
  },
  {
    files: ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}'],
    rules: { 'i18next/no-literal-string': 'off' },
  },
  {
    // Jest module factories must use require().
    files: ['jest.setup.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
