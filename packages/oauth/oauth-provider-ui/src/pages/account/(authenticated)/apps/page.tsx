import { Trans, useLingui } from '@lingui/react/macro'
import type { ActiveOAuthSession, DidString } from '@atproto/oauth-provider-api'
import { Button } from '#/components/forms/button'
import { Admonition, AdmonitionAction } from '#/components/utils/admonition.tsx'
import { CircularProgress } from '#/components/utils/circular-progress'
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

function ApplicationSessionCard({
  session: {
    clientId,
    clientMetadata,
    tokenId,
    createdAt,
    updatedAt,
    scope: _scope = clientMetadata?.scope, // @TODO Display scopes using <ScopeDescription />
  },
  did,
}: {
  session: ActiveOAuthSession
  did: DidString
}) {
  const { i18n } = useLingui()
  const { mutateAsync: revokeSessions, isPending } =
    useRevokeOAuthSessionMutation()

  const friendlyClientId = useOAuthClientIdentifier({
    clientId,
  })
  const clientName = useOauthClientName({
    clientId,
    clientMetadata,
  })

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
          <Trans context="OAuthApp">
            Last accessed <DateAgo date={updatedAt} />
          </Trans>
        </p>
      </div>
      <Button
        size="sm"
        className="min-w-max shrink-0 grow-0"
        loading={isPending}
        onClick={(_event) => {
          void revokeSessions({ did, tokenId }).catch((err) => {
            console.warn('Failed to revoke OAuth session', err)
          })
        }}
      >
        <Trans context="OAuthApp">Revoke access</Trans>
      </Button>
    </div>
  )
}
