import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react'
import {
  ArrowRightStartOnRectangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

import { Avatar } from '#/components/Avatar'
import { Button } from '#/components/Button'
import {
  useOAuthSessionsQuery,
  UseOAuthSessionsQueryResponse,
} from '#/data/useOAuthSessionsQuery'
import {
  useAccountSessionsQuery,
  UseAccountSessionsQueryResponse,
} from '#/data/useAccountSessionsQuery'
import { useRevokeOAuthSessionMutation } from '#/data/useRevokeOAuthSessionMutation'
import { useRevokeAccountSessionMutation } from '#/data/useRevokeAccountSessionMutation'
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
  const {
    data: accountSessions,
    error: accountSessionsError,
    isLoading: accountSessionsIsLoading,
  } = useAccountSessionsQuery({
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
            <ApplicationSessionCard currentDid={did} session={session} />
          ))}
        </div>
      )}

      <h2 className="text-text-default font-bold text-xl pt-8 pb-4">
        Account sessions
      </h2>

      {accountSessionsIsLoading ? null : accountSessionsError ||
        !accountSessions ? null : (
        <div className="space-y-3">
          {accountSessions.map((session) => (
            <AccountSessionCard currentDid={did} session={session} />
          ))}
        </div>
      )}
    </>
  )
}

function ApplicationSessionCard({
  session,
  currentDid,
}: {
  session: UseOAuthSessionsQueryResponse[0]
  currentDid: string
}) {
  const { mutateAsync: revokeSessions, isPending } =
    useRevokeOAuthSessionMutation()

  const revoke = async () => {
    try {
      await revokeSessions({ did: currentDid, token: session.tokenId })
    } catch (e) {}
  }

  return (
    <div className="p-4 border bg-contrast-25 dark:bg-contrast-50 border-contrast-50 dark:border-contrast-100 rounded-lg flex items-start justify-between space-x-4">
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

function AccountSessionCard({
  session,
  currentDid,
}: {
  session: UseAccountSessionsQueryResponse[0]
  currentDid: string
}) {
  const { i18n } = useLingui()
  const { mutateAsync: revokeSessions, isPending } =
    useRevokeAccountSessionMutation()

  const revoke = async () => {
    try {
      await revokeSessions({ did: currentDid, deviceId: session.deviceId })
    } catch (e) {}
  }

  const lastUsed = React.useMemo(() => {
    return i18n.date(new Date(), {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
  }, [session])

  return (
    <div className="pt-3 px-2 border-t border-contrast-50 dark:border-contrast-100 flex items-start justify-between space-x-4">
      <div className="flex flex-col space-x-2 truncate">
        <p className="font-semibold">{session.deviceMetadata.userAgent}</p>
        <p className="text-sm">
          <span className="text-text-light">
            {lastUsed}
            {' • '}
          </span>
          <span className="font-mono text-warning-600">
            {session.deviceMetadata.ipAddress}
          </span>
        </p>
      </div>
      <div>
        <Button
          onClick={revoke}
          color="secondary"
          size="sm"
          disabled={isPending}
        >
          <Button.Text>
            <Trans>Revoke</Trans>
          </Button.Text>
          <XMarkIcon width={16} />
        </Button>
      </div>
    </div>
  )
}
