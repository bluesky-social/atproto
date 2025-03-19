import React from 'react'
import { createRoot } from 'react-dom/client'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'

import '#/locales/setup'
import { App } from '#/App'
import { Provider as LocaleProvider } from '#/locales'

createRoot(document.getElementById('root')!).render(
  <I18nProvider i18n={i18n}>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </I18nProvider>,
)
