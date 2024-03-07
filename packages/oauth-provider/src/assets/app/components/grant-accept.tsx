import { Account, ClientMetadata } from '../types'
import { Layout } from './layout'

export function GrantAccept({
  account,
  clientId,
  clientMetadata,
  onAccept,
  onReject,
  onBack = undefined,
}: {
  account: Account
  clientId: string
  clientMetadata: ClientMetadata
  onAccept: () => void
  onReject: () => void
  onBack?: () => void
}) {
  const clientUri = clientMetadata.client_uri
  const clientName = clientMetadata.client_name || clientUri || clientId

  return (
    <Layout
      title="Authorize"
      subTitle={
        <>
          Grant access to your <b>{account.preferred_username}</b> account.
        </>
      }
    >
      <div className="max-w-lg w-full">
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

        <h1 className="text-2xl font-semibold text-center text-blue-600">
          {clientName}
        </h1>

        <p className="mt-4">
          <b>{clientId}</b> is asking for permission to access your account.
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
          {onBack && (
            <button
              type="button"
              onClick={() => onBack()}
              className="bg-transparent font-light text-blue-600 rounded-md py-2"
            >
              Back
            </button>
          )}

          <div className="flex-auto"></div>

          <button
            type="button"
            onClick={() => onReject()}
            className="ml-2 bg-transparent text-blue-600 rounded-md py-2"
          >
            Reject
          </button>

          <button
            type="button"
            onClick={() => onAccept()}
            className="ml-2 bg-transparent text-blue-600 rounded-md py-2 font-semibold"
          >
            Accept
          </button>
        </div>
      </div>
    </Layout>
  )
}
