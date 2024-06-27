import { OAuthClientMetadata } from '@atproto/oauth-types'

import { Session } from '../backend-data'
import { AcceptForm } from '../components/accept-form'
import { LayoutTitlePage } from '../components/layout-title-page'

export type AcceptViewProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
  session: Session

  onAccept: () => void
  onReject: () => void
  onBack?: () => void
}

export function AcceptView({
  clientId,
  clientMetadata,
  clientTrusted,
  session,
  onAccept,
  onReject,
  onBack,
}: AcceptViewProps) {
  const { account } = session
  return (
    <LayoutTitlePage
      title="Authorize"
      subtitle={
        <>
          Grant access to your{' '}
          <b className="text-black dark:text-white">
            {account.preferred_username || account.email || account.sub}
          </b>{' '}
          account
        </>
      }
    >
      <AcceptForm
        clientId={clientId}
        clientMetadata={clientMetadata}
        clientTrusted={clientTrusted}
        account={account}
        onBack={onBack}
        onAccept={onAccept}
        onReject={onReject}
      />
    </LayoutTitlePage>
  )
}
