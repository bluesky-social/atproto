import { OAuthClientMetadata } from '@atproto/oauth-types'
import { Account, ScopeDetail } from '../../../backend-data'
import { Button } from '../../../components/forms/button'
import { FormCard, FormCardProps } from '../../../components/forms/form-card'
import { AccountIdentifier } from '../../../components/utils/account-identifier'
import { ClientName } from '../../../components/utils/client-name'
import { Override } from '../../../lib/util'

export type AcceptFormProps = Override<
  Omit<FormCardProps, 'onSubmit' | 'cancel' | 'actions' | 'children'>,
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

export function AcceptForm({
  clientId,
  clientMetadata,
  clientTrusted,

  account,
  scopeDetails,

  onAccept,
  onReject,
  onBack,

  // FormCardProps
  ...props
}: AcceptFormProps) {
  return (
    <FormCard
      {...props}
      onSubmit={(event) => {
        event.preventDefault()
        onAccept()
      }}
      cancel={onBack && <Button onClick={onBack}>Back</Button>}
      actions={
        <>
          <Button type="submit" color="brand">
            Accept
          </Button>

          <Button onClick={onReject}>Deny access</Button>
        </>
      }
    >
      {clientTrusted && clientMetadata.logo_uri && (
        <div key="logo" className="flex items-center justify-center">
          <img
            crossOrigin="anonymous"
            src={clientMetadata.logo_uri}
            alt={clientMetadata.client_name}
            className="w-16 h-16 rounded-full"
          />
        </div>
      )}
      <p>
        <ClientName
          clientId={clientId}
          clientMetadata={clientMetadata}
          clientTrusted={clientTrusted}
        />{' '}
        is asking for permission to access your account (
        <AccountIdentifier account={account} />
        ).
      </p>

      <p>
        By clicking <b>Accept</b>, you allow this application to perform the
        following actions in accordance to their{' '}
        <a
          role="link"
          href={clientMetadata.tos_uri}
          rel="nofollow noopener"
          target="_blank"
          className="text-brand underline"
        >
          terms of service
        </a>
        {' and '}
        <a
          role="link"
          href={clientMetadata.policy_uri}
          rel="nofollow noopener"
          target="_blank"
          className="text-brand underline"
        >
          privacy policy
        </a>
        :
      </p>

      {scopeDetails?.length ? (
        <ul
          className="list-disc list-inside"
          key="scopes"
          aria-label="Requested permissions"
        >
          {scopeDetails.map(
            ({ scope, description = getScopeDescription(scope) }) => (
              <li key={scope}>{description}</li>
            ),
          )}
        </ul>
      ) : null}
    </FormCard>
  )
}

function getScopeDescription(scope: string): string {
  switch (scope) {
    case 'atproto':
      return 'Uniquely identify you'
    case 'transition:generic':
      return 'Access your account data (except chat messages)'
    case 'transition:chat.bsky':
      return 'Access your chat messages'
    default:
      return scope
  }
}
