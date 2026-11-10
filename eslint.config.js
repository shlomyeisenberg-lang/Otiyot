import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dist-plugin',
      'reference',
      'public/arcade',
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  { files: ['src/**/*.ts'], languageOptions: { globals: globals.browser } },
  {
    files: ['**/*.mjs', '**/*.js', 'playwright.config.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
);
