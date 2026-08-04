import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo } from 'react'
import type { ActiveOAuthSession, DidString } from '@atproto/oauth-provider-api'
import { Button } from '#/components/forms/button'
import { OAuthSessionDetailsDialog } from '#/components/oauth-session-details-dialog.tsx'
import { Admonition, AdmonitionAction } from '#/components/utils/admonition.tsx'
import { CircularProgress } from '#/components/utils/circular-progress'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  useOAuthSessionsQuery,
  useRevokeOAuthSessionMutation,
} from '#/data/oauth-sessions.ts'
import { useDateAgo } from '#/hooks/use-date-ago'
import { useOAuthClientIdentifier } from '#/hooks/use-oauth-client-identifier.ts'
import { useOauthClientName } from '#/hooks/use-oauth-client-name.ts'

export function Page() {
  const { account } = useAuthenticatedSession()
  const { did } = account
  const { data, isLoading, refetch } = useOAuthSessionsQuery({ did })

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
          These apps have access to your account. An app may appear multiple
          times if you use it on different devices. You can revoke access to log
          out the app until you sign in again.
        </Trans>
      </p>

      {data.map((session) => (
        <ApplicationSessionCard
          key={session.tokenId}
          did={did}
          session={session}
        />
      ))}

      <p className="text-text-light mt-4 text-sm">
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

/**
 * Returns a fully localised "Last accessed …" string.
 * The complete phrase is spelled out in each branch so that translators receive
 * the full sentence as a single translatable unit, enabling correct pluralisation
 * and other grammar related flexibility across all languages.
 */
function useLastAccessedText(date: Date | string): string {
  const { t } = useLingui()
  const bucket = useDateAgo(date)

  return useMemo(() => {
    switch (bucket.type) {
      case 'seconds':
        return t({
          context: 'sessions list',
          message: 'Last accessed just now',
        })
      case 'minutes':
        return t({
          context: 'sessions list',
          message: `Last accessed ${plural(bucket.count, { one: 'a minute', other: '# minutes' })} ago`,
        })
      case 'hours':
        return t({
          context: 'sessions list',
          message: `Last accessed ${plural(bucket.count, { one: 'an hour', other: '# hours' })} ago`,
        })
      case 'days':
        return bucket.count === 1
          ? t({
              context: 'sessions list',
              message: `Last accessed yesterday`,
            })
          : t({
              context: 'sessions list',
              message: `Last accessed ${plural(bucket.count, { one: '# day', other: '# days' })} ago`,
            })
    }
  }, [t, bucket])
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
  const lastSeenText = useLastAccessedText(updatedAt)

  // @NOTE if clientMetadata is undefined, it means that the client metadata
  // could not be fetched. We are unable to determine if the session is still
  // valid. We should reflect that in the UI.

  // @TODO Show if there is an active oauth access token ("active").

  return (
    <div className="border-contrast-50 dark:border-contrast-100 flex flex-wrap items-center justify-between space-x-4 border-t px-2 pt-3">
      <div className="flex min-w-36 flex-1 flex-col space-x-2 truncate">
        <p className="truncate font-semibold">{clientName}</p>
        <p className="font-mono text-xs">{friendlyClientId}</p>
        <p className="text-text-light truncate text-xs">
          <Trans context="OAuthApp">
            Authorized on{' '}
            {i18n.date(createdAt, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Trans>
          {' • '}
          {lastSeenText}
        </p>
      </div>
      <OAuthSessionDetailsDialog
        clientName={clientName}
        clientIdentifier={friendlyClientId}
        scope={scope}
        onRevoke={async () => {
          await revokeSession({ did, tokenId })
        }}
      >
        <Button size="sm" className="min-w-max shrink-0 grow-0">
          <Trans>Details</Trans>
        </Button>
      </OAuthSessionDetailsDialog>
    </div>
  )
}
