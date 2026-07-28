import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'
import type {
  ActiveAccountSession,
  DidString,
} from '@atproto/oauth-provider-api'
import { ListSkeleton } from '#/components/feedback/list-skeleton.tsx'
import { Notice, NoticeAction } from '#/components/feedback/notice.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '#/components/ui/item.tsx'
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
      return <ListSkeleton />
    }

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

  return data.length > 0 ? (
    <div className="flex flex-col gap-4">
      <p>
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

      {/* @NOTE `ItemGroup` supplies role="list" and the row spacing, and
        `ItemSeparator` draws the dividers. Each row previously carried its own
        `border-t`, which also drew a line above the first row — reading as a
        rule under the paragraph above rather than as a list divider.

        gap-0 because a divider sits between every row here: the group gap and
        the separator's own margin would otherwise stack to 32px and the list
        would read as separate blocks rather than one list. */}
      <ItemGroup className="gap-0">
        {data.map((session, index) => (
          <Fragment key={`${account.did}@${session.deviceId}`}>
            {index > 0 && <ItemSeparator />}
            <AccountSessionCard did={account.did} session={session} />
          </Fragment>
        ))}
      </ItemGroup>
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
    <Item>
      <ItemContent className="min-w-36">
        <ItemTitle>
          <span className="truncate">
            {browserName || (
              <Trans context="device list">Unknown user agent</Trans>
            )}
          </span>
        </ItemTitle>
        <ItemDescription className="text-foreground font-mono text-xs">
          {ipAddress}
        </ItemDescription>
        <ItemDescription className="text-xs">
          <Trans context="device list">Last seen {lastUsedAgo}</Trans>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={session.isCurrentDevice || isPending}
          onClick={(_event) => {
            void mutateAsync({ did, deviceId: session.deviceId }).catch(
              (err) => {
                console.warn('Failed to revoke account session', err)
              },
            )
          }}
          title={
            session.isCurrentDevice
              ? t`Cannot remove current device`
              : undefined
          }
        >
          <Trans context="device list">Sign out</Trans>
        </Button>
      </ItemActions>
    </Item>
  )
}
