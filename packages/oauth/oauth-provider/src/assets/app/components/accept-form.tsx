import { OAuthClientMetadata } from '@atproto/oauth-types'
import { FormEvent } from 'react'

import { Account, ScopeDetail } from '../backend-data'
import { Override } from '../lib/util'
import { AccountIdentifier } from './account-identifier'
import { Button } from './button'
import { ClientName } from './client-name'
import { FormCard, FormCardProps } from './form-card'

export type AcceptFormProps = Override<
  FormCardProps,
  {
    clientId: string
    clientMetadata: OAuthClientMetadata
    clientTrusted: boolean

    account: Account
    scopeDetails?: ScopeDetail[]

    onAccept: () => void
    acceptLabel?: string

    onReject: () => void
    rejectLabel?: string

    onBack?: () => void
    backLabel?: string
  }
>

export function AcceptForm({
  clientId,
  clientMetadata,
  clientTrusted,

  account,
  scopeDetails,

  onAccept,
  acceptLabel = 'Accept',
  onReject,
  rejectLabel = 'Deny access',
  onBack,
  backLabel = 'Back',

  ...props
}: AcceptFormProps) {
  const doSubmit = (e: FormEvent) => {
    e.preventDefault()
    onAccept()
  }

  return (
    <FormCard
      onSubmit={doSubmit}
      cancel={onBack && <Button onClick={onBack}>{backLabel}</Button>}
      actions={
        <>
          <Button type="submit" color="brand">
            {acceptLabel}
          </Button>

          <Button onClick={onReject}>{rejectLabel}</Button>
        </>
      }
      {...props}
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
        By clicking <b>{acceptLabel}</b>, you allow this application to perform
        the following actions in accordance to their{' '}
        <a
          href={clientMetadata.tos_uri}
          rel="nofollow noopener"
          target="_blank"
          className="text-brand underline"
        >
          terms of service
        </a>
        {' and '}
        <a
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
        <ul className="list-disc list-inside">
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
    default:
      return scope
  }
}
