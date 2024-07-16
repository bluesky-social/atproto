import { OAuthClientMetadata } from '@atproto/oauth-types'
import { FormEvent } from 'react'

import { Account } from '../backend-data'
import { Override } from '../lib/util'
import { AccountIdentifier } from './account-identifier'
import { Button } from './button'
import { ClientIdentifier } from './client-identifier'
import { ClientName } from './client-name'
import { FormCard, FormCardProps } from './form-card'
import { Fieldset } from './fieldset'

export type AcceptFormProps = Override<
  FormCardProps,
  {
    account: Account
    clientId: string
    clientMetadata: OAuthClientMetadata
    clientTrusted: boolean
    onAccept: () => void
    acceptLabel?: string

    onReject: () => void
    rejectLabel?: string

    onBack?: () => void
    backLabel?: string
  }
>

export function AcceptForm({
  account,
  clientId,
  clientMetadata,
  clientTrusted,
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
      <Fieldset
        title={
          <ClientName clientId={clientId} clientMetadata={clientMetadata} />
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
          <ClientIdentifier
            clientId={clientId}
            clientMetadata={clientMetadata}
          />{' '}
          is asking for permission to access your{' '}
          <AccountIdentifier account={account} /> account.
        </p>

        <p>
          By clicking <b>{acceptLabel}</b>, you allow this application to access
          your information in accordance to their{' '}
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
          .
        </p>
      </Fieldset>
    </FormCard>
  )
}
