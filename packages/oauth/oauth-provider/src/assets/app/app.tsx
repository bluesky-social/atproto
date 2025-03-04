import { ErrorBoundary } from 'react-error-boundary'
import type {
  AuthorizeData,
  CustomizationData,
  ErrorData,
} from './backend-types.ts'
import { LocaleProvider } from './locales/locale-provider.tsx'
import { AuthorizeView } from './views/authorize/authorize-view.tsx'
import { ErrorView } from './views/error/error-view.tsx'

export type AppProps = {
  authorizeData?: AuthorizeData
  customizationData?: CustomizationData
  errorData?: ErrorData
}

export function App({ authorizeData, customizationData, errorData }: AppProps) {
  return (
    <LocaleProvider>
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
