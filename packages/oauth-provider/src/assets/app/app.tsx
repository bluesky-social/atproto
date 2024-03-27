import type {
  AuthorizeData,
  CustomizationData,
  ErrorData,
} from './backend-data'
import { AuthorizeView } from './views/authorize-view'
import { ErrorView } from './views/error-view'

export type AppProps = {
  authorizeData?: AuthorizeData
  customizationData?: CustomizationData
  errorData?: ErrorData
}

export function App({ authorizeData, customizationData, errorData }: AppProps) {
  if (authorizeData && !errorData) {
    return (
      <AuthorizeView
        customizationData={customizationData}
        authorizeData={authorizeData}
      />
    )
  } else {
    return (
      <ErrorView customizationData={customizationData} errorData={errorData} />
    )
  }
}
