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
      // ── Unused vars: off ──────────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',

      // ── no-explicit-any: off ──────────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'off',

      // ── react-hooks custom rules: off ──────────────────────────────────────────
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',

      // ── react-refresh: off ────────────────────────────────────────────────────
      // Exporting custom React hooks alongside context providers is an idiomatic
      // pattern in this codebase. We disable this warning to allow it.
      'react-refresh/only-export-components': 'off',

      // ── Correctness rules ─────────────────────────────────────────────────────
      'no-useless-escape': 'off', // Turn off to allow legacy regex/escape patterns
      'no-useless-assignment': 'off',
    },
  },
])
