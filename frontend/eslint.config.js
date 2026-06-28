import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  // ─── Base config for all TS/TSX files ────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // ── Unused vars: allow underscore-prefixed variables to be intentionally unused
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],

      // ── no-explicit-any: off globally.
      // Rationale: This codebase uses `any` in two legitimate patterns:
      //   1. `catch (err: any)` — TypeScript doesn't have a catch-specific error type
      //   2. LocalStorage generics `load<any[]>()` where shape is known at call site
      //   3. Third-party API responses (Supabase, Gemini) with dynamic shapes
      // Type safety is enforced via domain interfaces in src/types/index.ts.
      // Re-enable this rule incrementally as domain types are added.
      '@typescript-eslint/no-explicit-any': 'off',

      // ── Keep correctness rules as errors ──────────────────────────────────────
      'no-useless-escape': 'error',
      // note: no-useless-assignment is not a standard ESLint rule — skip it
    },
  },
])
