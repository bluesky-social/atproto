import type { PermissionSets } from '#/hydration-data.d.ts'
import { Trans, useLingui } from '@lingui/react/macro'
import type { Account } from '@atproto/oauth-provider-api'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import {
  LayoutTitlePage,
  LayoutTitlePageProps,
} from '../../../components/layouts/layout-title-page.tsx'
import { Override } from '../../../lib/util.ts'
import { ConsentForm } from './consent-form.tsx'

export type ConsentViewProps = Override<
  LayoutTitlePageProps,
  {
    clientId: string
    clientMetadata: OAuthClientMetadata
    clientTrusted: boolean
    clientFirstParty: boolean
    permissionSets: PermissionSets

    account: Account
    scope?: string

    onConsent: (scope?: string) => void
    onReject: () => void
    onBack?: () => void
  }
>

export function ConsentView({
  clientId,
  clientMetadata,
  clientTrusted,
  clientFirstParty,
  permissionSets,
  account,
  scope,
  onConsent,
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
}: ConsentViewProps) {
  const { t } = useLingui()

  return (
    <LayoutTitlePage
      {...props}
      title={title ?? t`Authorize`}
      subtitle={subtitle}
    >
      <ConsentForm
        clientId={clientId}
        clientMetadata={clientMetadata}
        clientTrusted={clientTrusted}
        clientFirstParty={clientFirstParty}
        permissionSets={permissionSets}
        account={account}
        scope={scope}
        onBack={onBack}
        onConsent={onConsent}
        onReject={onReject}
      />
    </LayoutTitlePage>
  )
}
