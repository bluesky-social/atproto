import { OAuthClientMetadata } from '@atproto/oauth-types'
import { type HTMLAttributes } from 'react'

import { Account } from '../backend-data'
import { clsx } from '../lib/clsx'
import { AccountIdentifier } from './account-identifier'
import { ClientIdentifier } from './client-identifier'
import { ClientName } from './client-name'
import { Button } from './button'

export type AcceptFormProps = {
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

  ...attrs
}: AcceptFormProps & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...attrs} className={clsx('flex flex-col', attrs.className)}>
      {clientTrusted && clientMetadata.logo_uri && (
        <div className="flex items-center justify-center mb-4">
          <img
            crossOrigin="anonymous"
            src={clientMetadata.logo_uri}
            alt={clientMetadata.client_name}
            className="w-16 h-16 rounded-full"
          />
        </div>
      )}

      <ClientName
        clientId={clientId}
        clientMetadata={clientMetadata}
        as="h1"
        className="text-2xl font-semibold text-center text-brand"
      />

      <p className="mt-4">
        <ClientIdentifier clientId={clientId} clientMetadata={clientMetadata} />{' '}
        is asking for permission to access your{' '}
        <AccountIdentifier account={account} /> account.
      </p>

      <p className="mt-4">
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

      <div className="flex-auto" />

      <div className="mt-4 flex flex-wrap items-center justify-between">
        <Button onClick={onAccept} className="order-last" color="brand">
          {acceptLabel}
        </Button>

        {onBack && (
          <Button onClick={() => onBack()} className="mr-2">
            {backLabel}
          </Button>
        )}

        <div className="flex-auto"></div>

        <Button onClick={onReject} className="mr-2">
          {rejectLabel}
        </Button>
      </div>
    </div>
  )
}
