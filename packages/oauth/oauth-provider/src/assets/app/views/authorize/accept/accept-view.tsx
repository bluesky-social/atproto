import { Trans, useLingui } from '@lingui/react/macro'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import { Account, ScopeDetail } from '../../../backend-types.ts'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../../components/layouts/layout-title-page.tsx'
import { Override } from '../../../lib/util.ts'
import { AcceptForm } from './accept-form.tsx'

export type AcceptViewProps = Override<
  LayoutTitlePageProps,
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
  title,
  subtitle = (
    <Trans>
      Grant access to your{' '}
      <b className="text-slate-800 dark:text-slate-200">
        {account.preferred_username || account.email || account.sub}
      </b>{' '}
      account
    </Trans>
  ),
  ...props
}: AcceptViewProps) {
  const { t } = useLingui()

  return (
    <LayoutTitlePage
      {...props}
      title={title ?? t`Authorize`}
      subtitle={subtitle}
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
