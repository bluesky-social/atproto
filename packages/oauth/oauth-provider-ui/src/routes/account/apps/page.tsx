import { Trans, useLingui } from '@lingui/react/macro'
import type { ActiveOAuthSession } from '@atproto/oauth-provider-api'
import { Button } from '#/components/forms/button'
import { Admonition } from '#/components/utils/admonition.tsx'
import { CircularProgress } from '#/components/utils/circular-progress'
import { DateAgo } from '#/components/utils/date-ago'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import {
  useOAuthSessionsQuery,
  useRevokeOAuthSessionMutation,
} from '#/data/oauth-sessions.ts'
import { useOAuthClientIdentifier } from '#/hooks/use-oauth-client-identifier.ts'
import { useOauthClientName } from '#/hooks/use-oauth-client-name.ts'

export function Page() {
  const { t } = useLingui()
  const { account } = useAuthenticatedSession()
  const { sub } = account
  const { data, isLoading, refetch } = useOAuthSessionsQuery({ sub })

  if (!data) {
    if (isLoading) {
      return <CircularProgress className="text-primary" size={28} />
    }

    return (
      <Admonition
        role="status"
        action={{ children: t`Retry`, onClick: () => refetch() }}
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
          sub={sub}
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
    scope = clientMetadata?.scope,
  },
  sub,
}: {
  session: ActiveOAuthSession
  sub: string
}) {
  const { t, i18n } = useLingui()
  const { notify } = useNotificationsContext()
  const { mutateAsync: revokeSessions, isPending } =
    useRevokeOAuthSessionMutation()

  const friendlyClientId = useOAuthClientIdentifier({
    clientId,
  })
  const clientName = useOauthClientName({
    clientId,
    clientMetadata,
  })

  const revoke = async () => {
    try {
      await revokeSessions({ sub, tokenId })
      notify({
        variant: 'success',
        title: t`Successfully revoked access`,
        duration: 2e3,
      })
    } catch (err) {
      console.error('Failed to revoke OAuth session', err)
      notify({
        variant: 'error',
        title: t`Failed to revoke access`,
        duration: 2e3,
      })
    }
  }

  // @TODO Display scopes using <ScopeDescription />
  scope

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
        onClick={revoke}
      >
        <Trans context="OAuthApp">Revoke access</Trans>
      </Button>
    </div>
  )
}
