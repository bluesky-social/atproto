import { Trans, useLingui } from '@lingui/react/macro'
import type { ActiveAccountSession } from '@atproto/oauth-provider-api'
import { Button } from '#/components/forms/button'
import { Admonition } from '#/components/utils/admonition.tsx'
import { CircularProgress } from '#/components/utils/circular-progress'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import {
  useAccountSessionsQuery,
  useRevokeAccountSessionMutation,
} from '#/data/account-sessions.ts'
import { useBrowserName } from '#/hooks/use-browser-name'
import { useDateAgo } from '#/hooks/use-date-ago'

export function Page() {
  const { account } = useAuthenticatedSession()
  const { data, error, isLoading } = useAccountSessionsQuery(account)

  return (
    <div className="space-y-4">
      <p>
        <Trans>
          This is a list of all the devices you have used to sign in to your
          account. New apps can be authorized from any of these devices. If you
          believe that your account has been compromised, we recommend that you
          revoke access to all devices, change your password, and review your
          connected apps.
        </Trans>
      </p>

      {isLoading ? (
        <CircularProgress className="text-primary" size={28} />
      ) : error || !data ? (
        <Admonition type="alert">
          <Trans>Failed to load devices</Trans>
        </Admonition>
      ) : data.length > 0 ? (
        <div className="space-y-3">
          {data.map((session) => (
            <AccountSessionCard
              key={`${account.sub}@${session.deviceId}`}
              sub={account.sub}
              session={session}
            />
          ))}
        </div>
      ) : (
        <Admonition type="status" title={<Trans>No devices</Trans>}>
          <Trans>Looks like you aren't logged in on any other devices.</Trans>
        </Admonition>
      )}
    </div>
  )
}

function AccountSessionCard({
  session,
  sub,
}: {
  session: ActiveAccountSession
  sub: string
}) {
  const { notify } = useNotificationsContext()
  const { t } = useLingui()
  const { mutateAsync, isPending } = useRevokeAccountSessionMutation()

  const { userAgent, lastSeenAt, ipAddress } = session.deviceMetadata
  const browserName = useBrowserName(userAgent ?? undefined)
  const lastUsedAgo = useDateAgo(lastSeenAt)

  const remove = async () => {
    try {
      await mutateAsync({ sub, deviceId: session.deviceId })
      notify({
        variant: 'success',
        title: t`Successfully removed device`,
        duration: 2e3,
      })
    } catch (e) {
      notify({
        variant: 'error',
        title: t`Failed to remove device`,
        duration: 2e3,
      })
    }
  }

  return (
    <div className="border-contrast-50 dark:border-contrast-100 flex flex-wrap items-center justify-between space-x-4 border-t px-2 pt-3">
      <div className="flex min-w-36 flex-1 flex-col space-x-2 truncate">
        <p className="truncate font-semibold">
          {browserName || (
            <Trans context="device list">Unknown user agent</Trans>
          )}
        </p>
        <p className="truncate text-sm">
          <span className="text-text-light">
            <Trans context="device list">Last seen {lastUsedAgo}</Trans>
          </span>
          {' • '}
          <span className="text-warning-600 truncate font-mono">
            {ipAddress}
          </span>
        </p>
      </div>
      <Button
        size="sm"
        className="min-w-max shrink-0 grow-0"
        disabled={session.isCurrentDevice}
        loading={isPending}
        onClick={remove}
        title={
          session.isCurrentDevice ? t`Cannot remove current device` : undefined
        }
      >
        <Trans context="device list">Sign out</Trans>
      </Button>
    </div>
  )
}
