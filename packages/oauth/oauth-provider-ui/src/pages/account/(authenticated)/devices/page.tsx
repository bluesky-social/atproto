import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import type {
  ActiveAccountSession,
  DidString,
} from '@atproto/oauth-provider-api'
import { Button } from '#/components/forms/button'
import { Admonition, AdmonitionAction } from '#/components/utils/admonition.tsx'
import { CircularProgress } from '#/components/utils/circular-progress'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  useAccountSessionsQuery,
  useRevokeAccountSessionMutation,
} from '#/data/account-sessions.ts'
import { useBrowserName } from '#/hooks/use-browser-name'
import { useDateAgo } from '#/hooks/use-date-ago'

export function Page() {
  const { account } = useAuthenticatedSession()
  const { data, refetch, isLoading } = useAccountSessionsQuery(account)

  if (!data) {
    if (isLoading) {
      return <CircularProgress className="text-primary" size={28} />
    }

    return (
      <Admonition
        role="status"
        action={
          <AdmonitionAction onClick={() => refetch()}>
            <Trans>Retry</Trans>
          </AdmonitionAction>
        }
      >
        <Trans>Failed to load connected apps</Trans>
      </Admonition>
    )
  }

  return data.length > 0 ? (
    <div className="space-y-2">
      <p>
        <Trans>
          Your account is signed in on the devices listed below. If your account
          was compromised, sign out all devices, change your password, and check
          your connected{' '}
          <Link to="/account/apps" className="text-blue-600 hover:underline">
            apps
          </Link>
          .
        </Trans>
      </p>

      {data.map((session) => (
        <AccountSessionCard
          key={`${account.did}@${session.deviceId}`}
          did={account.did}
          session={session}
        />
      ))}
    </div>
  ) : (
    <p>
      <Trans>Looks like you aren't logged in on any other devices.</Trans>
    </p>
  )
}

function AccountSessionCard({
  session,
  did,
}: {
  session: ActiveAccountSession
  did: DidString
}) {
  const { t } = useLingui()
  const { mutateAsync, isPending } = useRevokeAccountSessionMutation()

  const { userAgent, lastSeenAt, ipAddress } = session.deviceMetadata
  const browserName = useBrowserName(userAgent || undefined)
  const lastUsedAgo = useDateAgo(lastSeenAt)

  return (
    <div className="border-contrast-50 dark:border-contrast-100 flex flex-wrap items-center justify-between space-x-4 border-t px-2 pt-3">
      <div className="flex min-w-36 flex-1 flex-col space-x-2 truncate">
        <p className="truncate font-semibold">
          {browserName || (
            <Trans context="device list">Unknown user agent</Trans>
          )}
        </p>
        <p className="font-mono text-xs">{ipAddress}</p>
        <p className="text-text-light truncate text-xs">
          <Trans context="device list">Last seen {lastUsedAgo}</Trans>
        </p>
      </div>
      <Button
        size="sm"
        className="min-w-max shrink-0 grow-0"
        disabled={session.isCurrentDevice}
        loading={isPending}
        onClick={(_event) => {
          void mutateAsync({ did, deviceId: session.deviceId }).catch((err) => {
            console.warn('Failed to revoke account session', err)
          })
        }}
        title={
          session.isCurrentDevice ? t`Cannot remove current device` : undefined
        }
      >
        <Trans context="device list">Sign out</Trans>
      </Button>
    </div>
  )
}
