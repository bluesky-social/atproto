import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline'

import { Avatar } from '#/components/Avatar'
import { Button } from '#/components/Button'
import {
  useOAuthSessionsQuery,
  UseOAuthSessionsQueryResponse,
} from '#/data/useOAuthSessionsQuery'
import { useRevokeSessionsMutation } from '#/data/useRevokeSessionsMutation'
import { InlineLink } from '#/components/Link'

export const Route = createFileRoute('/_appLayout/$did')({
  component: Sessions,
})

export function Sessions() {
  const { did } = Route.useParams()
  const {
    data: sessions,
    error,
    isLoading,
  } = useOAuthSessionsQuery({
    did,
  })
  return (
    <>
      <ul className="flex items-center space-x-2 text-text-light text-sm">
        <li>
          <InlineLink to="/" className="text-text-light underline">
            Accounts
          </InlineLink>
        </li>
        <li className="text-text-default">/</li>
        <li>Home</li>
      </ul>

      <h2 className="text-text-default font-bold text-xl pt-8 pb-4">
        Application sessions
      </h2>

      {isLoading ? null : error || !sessions ? null : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <SessionCard session={session} />
          ))}
        </div>
      )}

      <h2 className="text-text-default font-bold text-xl pt-8 pb-4">
        Account sessions
      </h2>
    </>
  )
}

function SessionCard({
  session,
}: {
  session: UseOAuthSessionsQueryResponse[0]
}) {
  const { mutateAsync: revokeSessions, isPending } = useRevokeSessionsMutation()

  const revoke = async () => {
    try {
      await revokeSessions({ tokens: [session.tokenId] })
    } catch (e) {}
  }

  return (
    <div className="p-4 border border-contrast-100 rounded-lg flex items-start justify-between space-x-4">
      <div className="flex items-center space-x-2 truncate">
        <Avatar
          size={40}
          src={session.clientMetadata.logo_uri}
          displayName={session.clientMetadata.client_name}
        />
        <div className="truncate">
          <h3 className="font-bold leading-snug truncate">
            {session.clientMetadata.client_name ||
              session.clientMetadata.client_uri}
          </h3>
          <p className="text-text-light leading-snug text-sm truncate">
            {session.clientMetadata.client_uri}
          </p>
        </div>
      </div>
      <div>
        <Button onClick={revoke} color="secondary" disabled={isPending}>
          <Button.Text>
            <Trans>Sign out</Trans>
          </Button.Text>
          <ArrowRightStartOnRectangleIcon width={20} />
        </Button>
      </div>
    </div>
  )
}
