import { type HTMLAttributes } from 'react'
import { clsx } from '../lib/clsx'
import { Account, ClientMetadata } from '../types'
import { ClientIdentifier } from './client-identifier'
import { ClientName } from './client-name'
import { AccountIdentifier } from './account-identifier'

export type AcceptFormProps = {
  account: Account
  clientId: string
  clientMetadata: ClientMetadata
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
      {clientMetadata.logo_uri && (
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

      <div className="mt-4 flex flex-wrap items-center justify-between">
        <button
          type="button"
          onClick={onAccept}
          className="order-last bg-primary text-white py-2 px-4 rounded-full font-semibold"
        >
          {acceptLabel}
        </button>

        {onBack && (
          <button
            type="button"
            onClick={() => onBack()}
            className="mr-2 bg-transparent text-primary rounded-md py-2"
          >
            {backLabel}
          </button>
        )}

        <div className="flex-auto"></div>

        <button
          type="button"
          onClick={onReject}
          className="mr-2 bg-transparent text-primary rounded-md py-2"
        >
          {rejectLabel}
        </button>
      </div>
    </div>
  )
}
