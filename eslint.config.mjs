import js from '@eslint/js';
import ts from 'typescript-eslint';

// Type-aware source rules keep unknown inputs explicit and runtime imports portable.
export default ts.config(
  { ignores: ['node_modules/**', 'release/**', 'main.js', 'coverage/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['src/**/*.ts', 'tests/**/*.ts'], rules: {
    'no-control-regex': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-constant-condition': ['error', { checkLoops: false }]
  } },
  { files: ['*.mjs', 'scripts/*.mjs'], languageOptions: { globals: {
    console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly'
  } } }
);
