import { ErrorBoundary } from 'react-error-boundary'
import type {
  AuthorizeData,
  AvailableLocales,
  CustomizationData,
  ErrorData,
} from './backend-types.ts'
import { LocaleProvider } from './locales/locale-provider.tsx'
import { AuthorizeView } from './views/authorize/authorize-view.tsx'
import { ErrorView } from './views/error/error-view.tsx'

export type AppProps = {
  availableLocales?: AvailableLocales
  authorizeData?: AuthorizeData
  customizationData?: CustomizationData
  errorData?: ErrorData
}

export function App({
  availableLocales,
  authorizeData,
  customizationData,
  errorData,
}: AppProps) {
  return (
    <LocaleProvider availableLocales={availableLocales}>
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
    </LocaleProvider>
  )
}
