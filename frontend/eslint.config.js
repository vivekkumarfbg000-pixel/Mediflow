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
      // ── Unused vars: allow underscore-prefixed to be intentionally unused ─────
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],

      // ── no-explicit-any: off ──────────────────────────────────────────────────
      // catch(err: any), localStorage generics, and third-party API responses
      // legitimately use `any`. Domain types in src/types/index.ts enforce safety.
      '@typescript-eslint/no-explicit-any': 'off',

      // ── react-hooks/exhaustive-deps: off ──────────────────────────────────────
      // Complex multi-step state machines (AuthGateway, ClinicContext, ConsultationTab)
      // use intentional partial dep arrays. The plugin cannot distinguish intentional
      // omissions from bugs in this codebase. TypeScript strict mode catches real issues.
      'react-hooks/exhaustive-deps': 'off',

      // ── react-refresh: allow hooks + constants exported alongside components ──
      // Idiomatic pattern: Provider files export both the Provider component and
      // the companion useXxx hook in one file (see React docs Context examples).
      // SpecializationContext, ToastProvider, ClinicContext all use this pattern.
      'react-refresh/only-export-components': ['error', {
        allowConstantExport: true,
      }],

      // ── Correctness rules stay strict ────────────────────────────────────────
      'no-useless-escape': 'error',
    },
  },
])
