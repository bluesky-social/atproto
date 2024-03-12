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
        authorizeData={authorizeData}
        brandingData={brandingData}
      />
    )
  } else {
    return <ErrorView error_description="Invalid app state" {...errorData} />
  }
}
