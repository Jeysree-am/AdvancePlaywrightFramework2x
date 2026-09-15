import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

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

  // Playwright specs get the plugin's recommended rules on top of the above.
  {
    files: ['src/tests/**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Conditional skips are deliberate here: without an LLM key or
      // credentials the suite reports "skipped" instead of failing offline.
      // Unconditional .skip()/.fixme() still error.
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
    },
  },
);
