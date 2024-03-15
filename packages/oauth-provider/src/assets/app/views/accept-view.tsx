import { AcceptForm } from '../components/accept-form'
import { PageLayout } from '../components/page-layout'
import { ClientMetadata, Session } from '../types'

export type AcceptViewProps = {
  clientId: string
  clientMetadata: ClientMetadata
  session: Session

  onAccept: () => void
  onReject: () => void
  onBack?: () => void
}

export function AcceptView({
  clientId,
  clientMetadata,
  session,
  onAccept,
  onReject,
  onBack,
}: AcceptViewProps) {
  const { account } = session
  return (
    <PageLayout
      title="Authorize"
      subtitle={
        <>
          Grant access to your{' '}
          <b>{account.preferred_username || account.email || account.sub}</b>{' '}
          account.
        </>
      }
    >
      <AcceptForm
        className="max-w-lg w-full"
        clientId={clientId}
        clientMetadata={clientMetadata}
        account={account}
        onBack={onBack}
        onAccept={onAccept}
        onReject={onReject}
      />
    </PageLayout>
  )
}
