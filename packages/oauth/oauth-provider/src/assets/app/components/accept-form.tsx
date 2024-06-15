import { OAuthClientMetadata } from '@atproto/oauth-types'
import { type HTMLAttributes } from 'react'

import { Account } from '../backend-data'
import { clsx } from '../lib/clsx'
import { AccountIdentifier } from './account-identifier'
import { ClientIdentifier } from './client-identifier'
import { ClientName } from './client-name'

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
        className="text-2xl font-semibold text-center text-primary"
      />

      <p className="mt-4">
        <ClientIdentifier clientId={clientId} clientMetadata={clientMetadata} />{' '}
        is asking for permission to access your{' '}
        <AccountIdentifier account={account} /> account.
      </p>

      <p className="mt-4">
        By clicking <b>{acceptLabel}</b>, you allow this application to access
        your information in accordance to its{' '}
        <a
          href={clientMetadata.tos_uri}
          rel="nofollow noopener"
          target="_blank"
          className="text-primary underline"
        >
          terms of service
        </a>
        .
      </p>

      <div className="flex-auto" />

      <div className="p-4 flex flex-wrap items-center justify-between">
        <button
          type="button"
          onClick={onAccept}
          className="py-2 bg-transparent text-primary rounded-md font-semibold order-last"
        >
          {acceptLabel}
        </button>

        {onBack && (
          <button
            type="button"
            onClick={() => onBack()}
            className="mr-2 py-2 bg-transparent text-primary rounded-md font-light"
          >
            {backLabel}
          </button>
        )}

        <div className="flex-auto"></div>

        <button
          type="button"
          onClick={onReject}
          className="mr-2 py-2 bg-transparent text-primary rounded-md font-light"
        >
          {rejectLabel}
        </button>
      </div>
    </div>
  )
}
