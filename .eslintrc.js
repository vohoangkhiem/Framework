/**
 * ESLint configuration (legacy .eslintrc format, ESLint 8).
 *
 * Design decisions:
 * - TypeScript sources get type-aware linting so that promise misuse (floating / mis-awaited
 *   promises) is caught at lint time; in Playwright code an un-awaited action or assertion is
 *   the most common source of flakiness.
 * - `no-explicit-any` is an error: the framework relies on `unknown` + narrowing instead.
 * - eslint-plugin-playwright applies to spec and fixture files only, where its rules make sense.
 * - Plain JavaScript (scripts, k6, this file) is linted with the base rules only.
 * - Prettier owns formatting; `eslint-config-prettier` disables conflicting stylistic rules.
 */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['eslint:recommended', 'prettier'],
  rules: {
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'no-param-reassign': 'error',
    'no-return-assign': 'error',
    'no-throw-literal': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended-type-checked',
        'plugin:@typescript-eslint/stylistic-type-checked',
        'prettier',
      ],
      rules: {
        // --- Type safety -------------------------------------------------------------------
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unsafe-assignment': 'error',
        '@typescript-eslint/no-unsafe-member-access': 'error',
        '@typescript-eslint/no-unsafe-call': 'error',
        '@typescript-eslint/no-unsafe-return': 'error',
        '@typescript-eslint/no-unsafe-argument': 'error',
        '@typescript-eslint/explicit-function-return-type': [
          'warn',
          {
            allowExpressions: true,
            allowTypedFunctionExpressions: true,
            allowHigherOrderFunctions: true,
          },
        ],
        '@typescript-eslint/explicit-member-accessibility': [
          'error',
          { accessibility: 'no-public' },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
        '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/prefer-readonly': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',

        // --- Async correctness (the #1 source of flaky Playwright tests) --------------------
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': [
          'error',
          { checksVoidReturn: { arguments: false } },
        ],
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/return-await': ['error', 'in-try-catch'],
        '@typescript-eslint/promise-function-async': 'off',
      },
    },
    {
      // Spec, setup and fixture files: apply Playwright best-practice rules.
      files: ['tests/**/*.ts', 'src/fixtures/**/*.ts'],
      plugins: ['playwright'],
      extends: ['plugin:playwright/recommended'],
      rules: {
        // Page objects expose `expectXxx()` assertion helpers, which this rule cannot see;
        // assertion coverage is enforced through code review instead.
        'playwright/expect-expect': 'off',
        'playwright/no-conditional-in-test': 'warn',
        'playwright/no-skipped-test': 'off',
        'playwright/no-networkidle': 'error',
        'playwright/no-wait-for-timeout': 'error',
        'playwright/no-force-option': 'warn',
        'playwright/no-element-handle': 'error',
        'playwright/no-eval': 'error',
        'playwright/prefer-web-first-assertions': 'error',
        'playwright/prefer-to-have-length': 'error',
        'playwright/prefer-strict-equal': 'error',
        'playwright/valid-title': 'error',
        'playwright/no-nested-step': 'off',
      },
    },
    {
      // The logger, global hooks and reporters are the sanctioned places for console output.
      files: [
        'src/core/logger.ts',
        'src/config/global-setup.ts',
        'src/config/global-teardown.ts',
        'src/reporting/**/*.ts',
      ],
      rules: { 'no-console': 'off' },
    },
    {
      // CommonJS Node scripts.
      files: ['*.js', 'scripts/**/*.js'],
      parserOptions: { sourceType: 'script' },
      rules: { 'no-console': 'off' },
    },
    {
      // k6 scripts run inside the k6 runtime (ESM + injected globals).
      files: ['performance/k6/**/*.js'],
      parserOptions: { sourceType: 'module' },
      globals: { __ENV: 'readonly' },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'playwright-report/',
    'blob-report/',
    'test-results/',
    '.auth/',
    'coverage/',
  ],
};
