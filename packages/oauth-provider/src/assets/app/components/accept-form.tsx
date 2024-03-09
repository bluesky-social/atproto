import { type HTMLAttributes } from 'react'
import { Account, ClientMetadata } from '../types'

export type AcceptFormProps = {
  account: Account
  clientId: string
  clientMetadata: ClientMetadata
  onAccept: () => void
  onReject: () => void
  onBack?: () => void
}

export function AcceptForm({
  account,
  clientId,
  clientMetadata,
  onAccept,
  onReject,
  onBack,
  ...props
}: AcceptFormProps & HTMLAttributes<HTMLDivElement>) {
  const clientName =
    clientMetadata.client_name || clientMetadata.client_uri || clientId

  const accountName = account.preferred_username || account.email || account.sub

  return (
    <div {...props}>
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

      <h1 className="text-2xl font-semibold text-center text-primary">
        {clientName}
      </h1>

      <p className="mt-4">
        <b>{clientId}</b> is asking for permission to access your{' '}
        <b>{accountName}</b> account.
      </p>

      <p className="mt-4">
        By clicking Accept, you allow this application to access your
        information in accordance to its{' '}
        <a
          href={clientMetadata.tos_uri}
          rel="nofollow noopener"
          target="_blank"
        >
          terms of service
        </a>
        .
      </p>

      <div className="m-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onAccept}
          className="bg-transparent text-primary rounded-md ml-2 py-2 font-semibold order-last"
        >
          Accept
        </button>

        {onBack && (
          <button
            type="button"
            onClick={() => onBack()}
            className="bg-transparent font-light text-primary rounded-md py-2"
          >
            Select another account
          </button>
        )}
        <div className="flex-auto"></div>

        <button
          type="button"
          onClick={onReject}
          className="bg-transparent font-light text-primary rounded-md ml-2 py-2"
        >
          Deny access
        </button>
      </div>
    </div>
  )
}
