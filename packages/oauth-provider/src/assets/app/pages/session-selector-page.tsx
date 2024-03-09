import { PageLayout } from '../components/page-layout'
import { SessionPicker, SessionPickerProps } from '../components/session-picker'
import { ClientMetadata } from '../types'

export type SessionSelectionPageProps = SessionPickerProps & {
  clientId: string
  clientMetadata: ClientMetadata
}

export function SessionSelectionPage({
  clientId,
  clientMetadata,
  ...props
}: SessionSelectionPageProps) {
  const clientName =
    clientMetadata.client_name || clientMetadata.client_uri || clientId

  return (
    <PageLayout
      column={
        <>
          <h1 className="text-2xl mt-4 font-semibold mb-4 text-primary">
            Sign in as...
          </h1>

          <p className="max-w-xs">
            Select an account to access to <b>{clientName}</b>.
          </p>
        </>
      }
    >
      <SessionPicker {...props} className="max-w-lg w-full" />
    </PageLayout>
  )
}
