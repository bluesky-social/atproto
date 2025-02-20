import { OAuthClientMetadata } from '@atproto/oauth-types'
import { Account, ScopeDetail } from '../../../backend-data'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../../components/layouts/layout-title-page'
import { Override } from '../../../lib/util'
import { AcceptForm } from './accept-form'

export type AcceptViewProps = Override<
  Omit<LayoutTitlePageProps, 'title' | 'subtitle'>,
  {
    clientId: string
    clientMetadata: OAuthClientMetadata
    clientTrusted: boolean

    account: Account
    scopeDetails?: ScopeDetail[]

    onAccept: () => void
    onReject: () => void
    onBack?: () => void
  }
>

export function AcceptView({
  clientId,
  clientMetadata,
  clientTrusted,
  account,
  scopeDetails,
  onAccept,
  onReject,
  onBack,

  // LayoutTitlePage
  ...props
}: AcceptViewProps) {
  return (
    <LayoutTitlePage
      {...props}
      title="Authorize"
      subtitle={
        <>
          Grant access to your{' '}
          <b className="text-slate-800 dark:text-slate-200">
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
        scopeDetails={scopeDetails}
        onBack={onBack}
        onAccept={onAccept}
        onReject={onReject}
      />
    </LayoutTitlePage>
  )
}
