import { ErrorBoundary } from 'react-error-boundary'

import type { BackendData } from './backend-data'
import { Authorize } from './components/authorize'
import { Error } from './components/error'

function FallbackRender({ error, resetErrorBoundary }) {
  return (
    <Error
      error="internal_error"
      error_description={
        typeof error?.message === 'string' ? error.message : 'An error occurred'
      }
    />
  )
}

export function App(data: BackendData) {
  return (
    <ErrorBoundary FallbackComponent={FallbackRender}>
      {'error' in data ? <Error {...data} /> : <Authorize {...data} />}
    </ErrorBoundary>
  )
}
