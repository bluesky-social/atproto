// https://github.com/lingui/js-lingui/pull/2639
/// <reference types="@lingui/conf" />

import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

export default defineConfig({
  format: formatter({ lineNumbers: false }),
  sourceLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja', 'ko', 'ro', 'sv'],
  fallbackLocales: {
    default: 'en',
  },
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: ['**/dist/**', '**/node_modules/**'],
    },
  ],
})
