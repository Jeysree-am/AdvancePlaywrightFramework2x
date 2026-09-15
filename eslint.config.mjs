import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'reports/**',
      'tta-report/**',
      'logs/**',
    ],
  },

  // JavaScript sources validated by ESLint:
  //   * eslint.config.mjs itself
  //   * any other .js / .mjs / .cjs file in the repo (none today)
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
  },

  // TypeScript sources validated by ESLint:
  //   * src/**/*.ts            (specs, page objects, fixtures, utils, AI layer)
  //   * playwright.config.ts   (repo root)
  {
    files: ['**/*.{ts,mts,cts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // A leading underscore marks a deliberately unused binding, e.g.
      // CustomReporter.onEnd's `_result` (part of the reporter interface).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
