import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { ErrorBoundary } from 'react-error-boundary'
import type {
  AuthorizeData,
  CustomizationData,
  ErrorData,
} from './backend-types.ts'
import * as allMessages from './locales/index.ts'
import { AuthorizeView } from './views/authorize/authorize-view.tsx'
import { ErrorView } from './views/error/error-view.tsx'

export type AppProps = {
  authorizeData?: AuthorizeData
  customizationData?: CustomizationData
  errorData?: ErrorData
}

i18n.load(allMessages)
i18n.activate('en')

export function App({ authorizeData, customizationData, errorData }: AppProps) {
  return (
    <I18nProvider i18n={i18n}>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <ErrorView error={error} customizationData={customizationData} />
        )}
      >
        {errorData || !authorizeData ? (
          <ErrorView error={errorData} customizationData={customizationData} />
        ) : (
          <AuthorizeView
            customizationData={customizationData}
            authorizeData={authorizeData}
          />
        )}
      </ErrorBoundary>
    </I18nProvider>
  )
}
