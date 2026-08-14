import { Trans, useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { CircleHelpIcon, GlobeIcon } from 'lucide-react'
import type { ActiveOAuthSession, DidString } from '@atproto/oauth-provider-api'
import { Notice, NoticeAction } from '#/components/feedback/notice.tsx'
import { OAuthSessionDetailsDialog } from '#/components/oauth-session-details-dialog.tsx'
import { SessionList } from '#/components/session-list.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover.tsx'
import { DateAgo } from '#/components/utils/date-ago'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  oauthSessionsQueryOptions,
  useOAuthSessionsQuery,
  useRevokeOAuthSessionMutation,
} from '#/data/oauth-sessions.ts'
import { useOAuthClientIdentifier } from '#/hooks/use-oauth-client-identifier.ts'
import { useOauthClientName } from '#/hooks/use-oauth-client-name.ts'

export const Route = createFileRoute('/account/u/$accountId/apps')({
  loader: ({ context: { api, queryClient, session } }) =>
    queryClient.ensureQueryData(
      oauthSessionsQueryOptions(api, { did: session.account.did }),
    ),
  component: AppsPage,
  errorComponent: ({ reset }) => (
    <Notice
      role="status"
      action={
        <NoticeAction onClick={reset}>
          <Trans>Retry</Trans>
        </NoticeAction>
      }
    >
      <Trans>Failed to load connected apps</Trans>
    </Notice>
  ),
})

function AppsPage() {
  const { t, i18n } = useLingui()
  const { account } = useAuthenticatedSession()
  const { did } = account
  const { data } = useOAuthSessionsQuery({ did })

  // @NOTE Most recently used first — the same reasoning as the devices list.
  const sessions = [...data].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <Trans>
          These apps have access to your account. An app may appear multiple
          times if you use it on different devices. You can revoke access to log
          out the app until you sign in again.
        </Trans>
      </p>

      <SessionList
        items={sessions}
        rowKey={(session) => session.tokenId}
        searchText={(session) =>
          [session.clientId, session.clientMetadata?.client_name].join(' ')
        }
        filterLabel={t`Filter apps`}
        emptyIcon={GlobeIcon}
        empty={
          <Trans>
            It appears that you haven’t used this account to sign in to any apps
            yet.
          </Trans>
        }
        mobileTitle={(session) => <ClientName session={session} />}
        columns={[
          {
            // @NOTE Percentage widths with `max-w-0` make the two text columns
            // share the space the date columns leave over and truncate, instead
            // of sizing to their longest URL and forcing the table wider than
            // the page.
            header: <Trans context="OAuthApp">App</Trans>,
            className: 'w-1/3 max-w-0 truncate',
            cellClassName: 'font-medium',
            hideOnMobile: true,
            cell: (session) => <ClientName session={session} />,
          },
          {
            header: <Trans context="OAuthApp">Client</Trans>,
            className: 'w-1/2 max-w-0 truncate',
            cellClassName: 'font-mono text-xs',
            cell: (session) => <ClientIdentifier session={session} />,
          },
          {
            header: <Trans context="OAuthApp">Authorized</Trans>,
            className: 'whitespace-nowrap',
            cellClassName: 'text-muted-foreground',
            cell: (session) =>
              i18n.date(session.createdAt, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }),
          },
          {
            header: <LastAccessedHeader />,
            className: 'whitespace-nowrap',
            cellClassName: 'text-muted-foreground',
            cell: (session) => <DateAgo date={session.updatedAt} />,
          },
        ]}
        action={(session) => <DetailsButton did={did} session={session} />}
      />
    </div>
  )
}

/**
 * @NOTE This copy used to be a paragraph below the list. It explains one thing
 * — why "last accessed" is more recent than you'd expect — and on a long list
 * you only reached it after scrolling past every row, by which point the
 * question has already been asked and abandoned. Attaching it to the column
 * keeps it reachable at any list length.
 *
 * A Popover rather than a Tooltip: tooltips are hover-only, and this page is
 * reached from a mobile-first account manager.
 */
function LastAccessedHeader() {
  const { t } = useLingui()

  return (
    <span className="inline-flex items-center gap-1">
      <Trans context="OAuthApp">Last accessed</Trans>
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={t`Why is this time so recent?`}
              className="hover:text-foreground focus-visible:ring-ring rounded-full focus-visible:outline-none focus-visible:ring-2"
            />
          }
        >
          <CircleHelpIcon aria-hidden className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent className="max-w-xs text-sm font-normal">
          <p>
            <Trans>
              Apps may access your account in the background (to check
              notifications, sync data, etc.) even when you're not actively
              using them. This is normal behavior and will update the "last
              accessed" time.
            </Trans>
          </p>
        </PopoverContent>
      </Popover>
    </span>
  )
}

function ClientName({ session }: { session: ActiveOAuthSession }) {
  const clientName = useOauthClientName({
    clientId: session.clientId,
    clientMetadata: session.clientMetadata,
  })
  return <span className="truncate">{clientName}</span>
}

function ClientIdentifier({ session }: { session: ActiveOAuthSession }) {
  const friendlyClientId = useOAuthClientIdentifier({
    clientId: session.clientId,
  })
  return <span className="truncate">{friendlyClientId}</span>
}

function DetailsButton({
  did,
  session,
}: {
  did: DidString
  session: ActiveOAuthSession
}) {
  const { mutateAsync: revokeSession } = useRevokeOAuthSessionMutation()

  const friendlyClientId = useOAuthClientIdentifier({
    clientId: session.clientId,
  })
  const clientName = useOauthClientName({
    clientId: session.clientId,
    clientMetadata: session.clientMetadata,
  })

  return (
    <OAuthSessionDetailsDialog
      clientName={clientName}
      clientIdentifier={friendlyClientId}
      scope={session.scope ?? session.clientMetadata?.scope}
      onRevoke={async () => {
        await revokeSession({ did, tokenId: session.tokenId })
      }}
    >
      <Button variant="secondary" size="sm" className="shrink-0">
        <Trans>Details</Trans>
      </Button>
    </OAuthSessionDetailsDialog>
  )
}
