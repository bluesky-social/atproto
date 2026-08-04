import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { MonitorSmartphoneIcon } from 'lucide-react'
import { useMemo } from 'react'
import type {
  ActiveAccountSession,
  DidString,
} from '@atproto/oauth-provider-api'
import { Notice, NoticeAction } from '#/components/feedback/notice.tsx'
import { SessionList } from '#/components/session-list.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  useAccountSessionsQuery,
  useRevokeAccountSessionMutation,
} from '#/data/account-sessions.ts'
import { useBrowserName } from '#/hooks/use-browser-name'
import { useDateAgo } from '#/hooks/use-date-ago'

export function Page() {
  const { t } = useLingui()
  const { account } = useAuthenticatedSession()
  const { data, refetch, isLoading } = useAccountSessionsQuery(account)

  const sessions = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          new Date(b.deviceMetadata.lastSeenAt).getTime() -
          new Date(a.deviceMetadata.lastSeenAt).getTime(),
      ),
    [data],
  )

  if (!data && !isLoading) {
    return (
      <Notice
        role="status"
        action={
          <NoticeAction onClick={() => refetch()}>
            <Trans>Retry</Trans>
          </NoticeAction>
        }
      >
        <Trans>Failed to load connected apps</Trans>
      </Notice>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <Trans>
          Your account is signed in on the devices listed below. If your account
          was compromised, sign out all devices, change your password, and check
          your connected{' '}
          <Link to="/account/apps" className="text-foreground hover:underline">
            apps
          </Link>
          .
        </Trans>
      </p>

      <SessionList
        items={sessions}
        rowKey={(session) => `${account.did}@${session.deviceId}`}
        searchText={(session) =>
          [
            session.deviceMetadata.userAgent,
            session.deviceMetadata.ipAddress,
          ].join(' ')
        }
        loading={isLoading}
        filterLabel={t`Filter devices`}
        emptyIcon={MonitorSmartphoneIcon}
        empty={
          <Trans>Looks like you aren't logged in on any other devices.</Trans>
        }
        mobileTitle={(session) => <DeviceName session={session} />}
        columns={[
          {
            header: <Trans context="device list">Device</Trans>,
            cellClassName: 'font-medium',
            hideOnMobile: true,
            cell: (session) => <DeviceName session={session} />,
          },
          {
            header: <Trans context="device list">IP address</Trans>,
            cellClassName: 'font-mono text-xs',
            cell: (session) => session.deviceMetadata.ipAddress,
          },
          {
            header: <Trans context="device list">Last seen</Trans>,
            className: 'whitespace-nowrap',
            cellClassName: 'text-muted-foreground',
            cell: (session) => <LastSeen session={session} />,
          },
        ]}
        action={(session) => (
          <SignOutButton did={account.did} session={session} />
        )}
      />
    </div>
  )
}

function DeviceName({ session }: { session: ActiveAccountSession }) {
  const browserName = useBrowserName(
    session.deviceMetadata.userAgent || undefined,
  )

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate">
        {browserName || <Trans context="device list">Unknown user agent</Trans>}
      </span>
      {/* @NOTE Worth calling out on a long list: it is the one row whose
        "Sign out" is disabled, and without a marker that reads as a bug. */}
      {session.isCurrentDevice && (
        <Badge variant="secondary" className="shrink-0">
          <Trans context="device list">This device</Trans>
        </Badge>
      )}
    </span>
  )
}

function LastSeen({ session }: { session: ActiveAccountSession }) {
  const lastUsedAgo = useDateAgo(session.deviceMetadata.lastSeenAt)
  return <>{lastUsedAgo}</>
}

function SignOutButton({
  did,
  session,
}: {
  did: DidString
  session: ActiveAccountSession
}) {
  const { t } = useLingui()
  const { mutateAsync, isPending } = useRevokeAccountSessionMutation()

  return (
    <Button
      variant="secondary"
      size="sm"
      className="shrink-0"
      disabled={session.isCurrentDevice || isPending}
      onClick={() => {
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
  )
}
