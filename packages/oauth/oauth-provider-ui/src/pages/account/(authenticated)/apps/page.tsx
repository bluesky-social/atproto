import { Trans, useLingui } from '@lingui/react/macro'
import { Fragment } from 'react'
import type { ActiveOAuthSession, DidString } from '@atproto/oauth-provider-api'
import { ListSkeleton } from '#/components/feedback/list-skeleton.tsx'
import { Notice, NoticeAction } from '#/components/feedback/notice.tsx'
import { OAuthSessionDetailsDialog } from '#/components/oauth-session-details-dialog.tsx'
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
import { DateAgo } from '#/components/utils/date-ago'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  useOAuthSessionsQuery,
  useRevokeOAuthSessionMutation,
} from '#/data/oauth-sessions.ts'
import { useOAuthClientIdentifier } from '#/hooks/use-oauth-client-identifier.ts'
import { useOauthClientName } from '#/hooks/use-oauth-client-name.ts'

export function Page() {
  const { account } = useAuthenticatedSession()
  const { did } = account
  const { data, isLoading, refetch } = useOAuthSessionsQuery({ did })

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
          These apps have access to your account. An app may appear multiple
          times if you use it on different devices. You can revoke access to log
          out the app until you sign in again.
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
          <Fragment key={session.tokenId}>
            {index > 0 && <ItemSeparator />}
            <ApplicationSessionCard did={did} session={session} />
          </Fragment>
        ))}
      </ItemGroup>

      <p className="text-muted-foreground text-sm">
        <Trans>
          Apps may access your account in the background (to check
          notifications, sync data, etc.) even when you're not actively using
          them. This is normal behavior and will update the "last accessed" time
          shown above.
        </Trans>
      </p>
    </div>
  ) : (
    <p>
      <Trans>
        It appears that you haven’t used this account to sign in to any apps
        yet.
      </Trans>
    </p>
  )
}

function ApplicationSessionCard({
  session: {
    // active,
    clientId,
    clientMetadata,
    tokenId,
    createdAt,
    updatedAt,
    scope = clientMetadata?.scope,
  },
  did,
}: {
  session: ActiveOAuthSession
  did: DidString
}) {
  const { i18n } = useLingui()
  const { mutateAsync: revokeSession } = useRevokeOAuthSessionMutation()

  const friendlyClientId = useOAuthClientIdentifier({
    clientId,
  })
  const clientName = useOauthClientName({
    clientId,
    clientMetadata,
  })

  // @NOTE if clientMetadata is undefined, it means that the client metadata
  // could not be fetched. We are unable to determine if the session is still
  // valid. We should reflect that in the UI.

  // @TODO Show if there is an active oauth access token ("active").

  return (
    <Item>
      <ItemContent className="min-w-36">
        <ItemTitle>
          <span className="truncate">{clientName}</span>
        </ItemTitle>
        <ItemDescription className="text-foreground font-mono text-xs">
          {friendlyClientId}
        </ItemDescription>
        <ItemDescription className="text-xs">
          <Trans context="OAuthApp">
            Authorized on{' '}
            {i18n.date(createdAt, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Trans>
          {' • '}
          <Trans context="OAuthApp">
            Last accessed <DateAgo date={updatedAt} />
          </Trans>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <OAuthSessionDetailsDialog
          clientName={clientName}
          clientIdentifier={friendlyClientId}
          scope={scope}
          onRevoke={async () => {
            await revokeSession({ did, tokenId })
          }}
        >
          <Button variant="secondary" size="sm" className="shrink-0">
            <Trans>Details</Trans>
          </Button>
        </OAuthSessionDetailsDialog>
      </ItemActions>
    </Item>
  )
}
