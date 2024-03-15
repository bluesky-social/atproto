import { CustomizationData, ErrorData } from '../backend-data'
import { ErrorCard } from '../components/error-card'
import { WelcomeLayout } from '../components/welcome-layout'

export type ErrorViewProps = {
  customizationData?: CustomizationData
  errorData?: ErrorData
}

export function ErrorView({ errorData, customizationData }: ErrorViewProps) {
  return (
    <WelcomeLayout {...customizationData}>
      <ErrorCard message={getUserFriendlyMessage(errorData)} />
    </WelcomeLayout>
  )
}

function getUserFriendlyMessage(errorData?: ErrorData) {
  const desc = errorData?.error_description
  switch (desc) {
    case 'Unknown request_uri': // Request was removed from database
    case 'This request has expired':
      return 'This sign-in session has expired'
    default:
      return desc || 'An unknown error occurred'
  }
}
