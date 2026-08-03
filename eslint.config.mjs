import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importPlugin from 'eslint-plugin-import-x'
import n from 'eslint-plugin-n'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',

      // buf
      'packages/bsky/src/proto/**',
      'packages/bsync/src/proto/**',

      // codegen
      'packages/api/src/client/**',
      'packages/ozone/src/lexicon/**',

      // @atproto/lex
      'packages/lexicon-resolver/src/lexicons/**',
      'packages/lex/*/src/lexicons/**',
      'packages/lex/*/tests/lexicons/**',
      'packages/oauth/oauth-client-browser-example/src/lexicons/**',
      'packages/pds/src/lexicons/**',
      'packages/bsky/src/lexicons/**',
      'packages/sync/src/lexicons/**',

      // others
      'packages/api/src/moderation/const/labels.ts',
      'packages/oauth/*/src/locales/*/messages.ts',
      'packages/oauth/oauth-client-expo/android/build/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
  },
  js.configs.recommended,
  ...tseslint.configs['flat/recommended'],
  prettierRecommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    plugins: { n },
    settings: {
      node: { version: '>=22' },
      'import-x/internal-regex': '^@atproto(?:-labs)?/',
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import-x/resolver-next': createTypeScriptImportResolver({
        project: [
          'packages/lex/*/tsconfig.build.json',
          'packages/lex/*/tsconfig.test.json',
          'packages/oauth/*/tsconfig.build.json',
          'packages/oauth/*/tsconfig.test.json',
          'packages/oauth/*/tsconfig.lib.json',
          'packages/internal/*/tsconfig.build.json',
          'packages/internal/*/tsconfig.test.json',
          'packages/*/tsconfig.build.json',
          'packages/*/tsconfig.test.json',
        ],
      }),
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-misleading-character-class': 'warn',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'n/global-require': 'error',
      'n/no-extraneous-import': 'error',
      'n/prefer-node-protocol': 'error',
      'import-x/extensions': ['off', 'ignorePackages'],
      'import-x/export': 'off',
      'import-x/namespace': 'off',
      'import-x/no-deprecated': 'off',
      'import-x/no-absolute-path': 'error',
      'import-x/no-dynamic-require': 'error',
      'import-x/no-self-import': 'error',
      'import-x/order': [
        'error',
        {
          named: true,
          distinctGroup: true,
          alphabetize: { order: 'asc' },
          'newlines-between': 'never',
          pathGroups: [
            { pattern: '#/**', group: 'parent', position: 'before' },
          ],
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            ['index', 'sibling'],
            'object',
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_|^err$|^error$',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.commonjs },
    },
  },
  {
    files: [
      '**/vite.config.js',
      '**/vite.config.mjs',
      'packages/dev-env/bin.js',
      'packages/lex-cli/bin.js',
      'packages/lex/*/scripts/*.mjs',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/test.setup.ts'],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.cts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/tests/**/*.ts'],
    rules: {
      'n/no-extraneous-import': [
        'error',
        { allowModules: ['@atproto/dev-env'] },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_|^err$|^error$',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]
