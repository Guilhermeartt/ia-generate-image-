import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', '.venv-sam2', 'data', 'migrated_prompt_history', 'public/sw.js'],
  },

  // ── Frontend: TS + React ────────────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Pragmatismo: o código atual usa `any` em vários pontos de integração com APIs.
      // Mantemos como warning para não travar o build, mas sinalizar para reduzir aos poucos.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': ['warn', { allowShortCircuit: true, allowTernary: true }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Regras experimentais do react-hooks@7: úteis como sinal, mas agressivas
      // demais para tratar como erro num codebase existente. Ratchet via warning.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'no-useless-assignment': 'warn',
    },
  },

  // ── Backend: Node .mjs ──────────────────────────────────────────────────────
  {
    files: ['server/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // ── Arquivos de teste ───────────────────────────────────────────────────────
  {
    files: ['**/*.test.{ts,tsx,mjs}', '**/*.spec.{ts,tsx,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
