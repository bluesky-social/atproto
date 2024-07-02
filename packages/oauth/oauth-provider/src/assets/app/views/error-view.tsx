import { CustomizationData, ErrorData } from '../backend-data'
import { InfoCard } from '../components/info-card'
import { LayoutWelcome, LayoutWelcomeProps } from '../components/layout-welcome'
import { Override } from '../lib/util'

export type ErrorViewProps = Override<
  Omit<LayoutWelcomeProps, keyof CustomizationData>,
  {
    customizationData?: CustomizationData
    errorData?: ErrorData
  }
>

export function ErrorView({
  errorData,
  customizationData,
  ...props
}: ErrorViewProps) {
  return (
    <LayoutWelcome {...customizationData} {...props}>
      <InfoCard role="alert">{getUserFriendlyMessage(errorData)}</InfoCard>
    </LayoutWelcome>
  )
}

function getUserFriendlyMessage(errorData?: ErrorData) {
  const desc = errorData?.error_description
  switch (true) {
    case desc?.startsWith('Unknown request_uri'): // Request was removed from database
    case desc === 'This request has expired':
      return 'This sign-in session has expired'
    default:
      return desc || 'An unknown error occurred'
  }
}
