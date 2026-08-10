import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { Account } from '@atproto/oauth-provider-api'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import { AccountIdentifier } from '#/components/identity/account-identifier.tsx'
import { AuthShell } from '#/components/layouts/auth-shell.tsx'
import type { PermissionSets } from '#/hydration-data.d.ts'
import { ConsentForm } from './consent-form.tsx'

export type ConsentViewProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
  clientFirstParty: boolean
  permissionSets: PermissionSets

  account: Account
  scope?: string

  onConsent: (data: { scope?: string }) => void
  onReject: () => void
  onBack?: () => void
}

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
}: ConsentViewProps) {
  return (
    <AuthShell
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
        account={account}
        scope={scope}
        onBack={onBack}
        onConsent={onConsent}
        onReject={onReject}
      />
    </AuthShell>
  )
}
