import { Trans, useLingui } from '@lingui/react/macro'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import { Account, ScopeDetail } from '../../../backend-types.ts'
import { Button } from '../../../components/forms/button.tsx'
import {
  FormCard,
  FormCardProps,
} from '../../../components/forms/form-card.tsx'
import { AccountIdentifier } from '../../../components/utils/account-identifier.tsx'
import { ClientName } from '../../../components/utils/client-name.tsx'
import { Override } from '../../../lib/util.ts'

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
  const { t } = useLingui()
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
            <Trans>Authorize</Trans>
          </Button>

          <Button onClick={onReject}>
            <Trans>Deny access</Trans>
          </Button>
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
        <Trans>
          <ClientName
            clientId={clientId}
            clientMetadata={clientMetadata}
            clientTrusted={clientTrusted}
          />{' '}
          is asking for permission to access your account (
          <AccountIdentifier account={account} />
          ).
        </Trans>
      </p>

      <p>
        <Trans>
          By clicking{' '}
          <b>
            <Trans>Authorize</Trans>
          </b>
          , you allow this application to perform the following actions in
          accordance with their{' '}
          <a
            role="link"
            href={clientMetadata.tos_uri}
            rel="nofollow noopener"
            target="_blank"
            className="text-brand underline"
          >
            <Trans>terms of service</Trans>
          </a>
          {' and '}
          <a
            role="link"
            href={clientMetadata.policy_uri}
            rel="nofollow noopener"
            target="_blank"
            className="text-brand underline"
          >
            <Trans>privacy policy</Trans>
          </a>
          :
        </Trans>
      </p>

      {scopeDetails?.length ? (
        <ul
          className="list-disc list-inside"
          key="scopes"
          aria-label={t`Requested permissions`}
        >
          {scopeDetails.map(({ scope, description }) => (
            <li key={scope}>
              {description || <ScopeDescription scope={scope} />}
            </li>
          ))}
        </ul>
      ) : null}
    </FormCard>
  )
}

type ScopeDescriptionProps = {
  scope: string
}
function ScopeDescription({ scope }: ScopeDescriptionProps) {
  switch (scope) {
    case 'atproto':
      return <Trans>Uniquely identify you</Trans>
    case 'transition:generic':
      return <Trans>Access your account data (except chat messages)</Trans>
    case 'transition:chat.bsky':
      return <Trans>Access your chat messages</Trans>
    default:
      return scope
  }
}
