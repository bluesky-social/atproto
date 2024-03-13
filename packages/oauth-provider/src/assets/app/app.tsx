import type { AuthorizeData, BrandingData, ErrorData } from './backend-data'
import { AuthorizeView } from './views/authorize-view'
import { ErrorView } from './views/error-view'

export type AppProps = {
  authorizeData?: AuthorizeData
  brandingData?: BrandingData
  errorData?: ErrorData
}

export function App({ authorizeData, brandingData, errorData }: AppProps) {
  if (authorizeData) {
    return (
      <AuthorizeView
        brandingData={brandingData}
        authorizeData={authorizeData}
      />
    )
  } else {
    return <ErrorView brandingData={brandingData} errorData={errorData} />
  }
}
