import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { Account } from '@atproto/oauth-provider-api'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import type { PermissionSets, Spaces } from '#/hydration-data.d.ts'
import { ConsentForm } from './consent-form.tsx'
import { LayoutTitle } from './layouts/layout-title.tsx'
import { AccountIdentifier } from './utils/account-identifier.tsx'

export type ConsentViewProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
  clientFirstParty: boolean
  permissionSets: PermissionSets
  spaces: Spaces

  account: Account
  scope?: string

  onConsent: (scope?: string) => void
  onReject: () => void
  onBack?: () => void
}

export function ConsentView({
  clientId,
  clientMetadata,
  clientTrusted,
  clientFirstParty,
  permissionSets,
  spaces,
  account,
  scope,
  onConsent,
  onReject,
  onBack,
}: ConsentViewProps) {
  return (
    <LayoutTitle
      title={msg({ message: 'Authorize', context: 'OAuthConsent' })}
      subtitle={
        <Trans>
          Grant access to your <AccountIdentifier account={account} /> account
        </Trans>
      }
    >
      <ConsentForm
        clientId={clientId}
        clientMetadata={clientMetadata}
        clientTrusted={clientTrusted}
        clientFirstParty={clientFirstParty}
        permissionSets={permissionSets}
        spaces={spaces}
        account={account}
        scope={scope}
        onBack={onBack}
        onConsent={onConsent}
        onReject={onReject}
      />
    </LayoutTitle>
  )
}
