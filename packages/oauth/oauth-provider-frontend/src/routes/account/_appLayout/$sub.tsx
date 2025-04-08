import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { Cross2Icon, ExitIcon } from '@radix-ui/react-icons'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ActiveAccountSession, ActiveOAuthSession } from '#/api'
import * as Admonition from '#/components/Admonition'
import { Avatar } from '#/components/Avatar'
import { Button } from '#/components/Button'
import { InlineLink } from '#/components/Link'
import { Loader } from '#/components/Loader'
import { Prompt } from '#/components/Prompt'
import { useToast } from '#/components/Toast'
import { useAccountSessionsQuery } from '#/data/useAccountSessionsQuery'
import { useOAuthSessionsQuery } from '#/data/useOAuthSessionsQuery'
import { useRevokeAccountSessionMutation } from '#/data/useRevokeAccountSessionMutation'
import { useRevokeOAuthSessionMutation } from '#/data/useRevokeOAuthSessionMutation'

export const Route = createFileRoute('/account/_appLayout/$sub')(
  {
    component: Sessions,
  },
)

export function Sessions() {
  const { _ } = useLingui()
  const { sub } = Route.useParams()
  const { data: sessions, error, isLoading } = useOAuthSessionsQuery({ sub })
  const {
    data: accountSessions,
    error: accountSessionsError,
    isLoading: accountSessionsIsLoading,
  } = useAccountSessionsQuery({ sub })

  return (
    <>
      <ul className="text-text-light flex items-center space-x-2 text-sm">
        <li>
          <InlineLink to="/account" className="text-text-light underline">
            <Trans>Accounts</Trans>
          </InlineLink>
        </li>
        <li className="text-custom-brand">/</li>
        <li>
          <Trans>Home</Trans>
        </li>
      </ul>

      <h2 className="text-custom-brand text-brand pb-4 pt-8 text-xl font-bold">
        <Trans>Connected apps</Trans>
      </h2>

      {isLoading ? (
        <Loader size="lg" fill="var(--color-contrast-300)" />
      ) : error || !sessions ? (
        <Admonition.Default
          variant="error"
          text={_(msg`Failed to load connected apps`)}
        />
      ) : sessions.length > 0 ? (
        <div className="space-y-2">
          {sessions.map((session) => (
            <ApplicationSessionCard key={session.tokenId} sub={sub} session={session} />
          ))}
        </div>
      ) : (
        <Admonition.Default
          variant="info"
          title={_(msg`No connected apps`)}
          text={_(
            msg`Looks like you haven't used this account to sign in to any apps yet.`,
          )}
        />
      )}

      <h2 className="text-custom-brand pb-4 pt-8 text-xl font-bold">
        <Trans>My devices</Trans>
      </h2>

      {accountSessionsIsLoading ? (
        <Loader size="lg" fill="var(--color-contrast-300)" />
      ) : accountSessionsError || !accountSessions ? (
        <Admonition.Default
          variant="error"
          text={_(msg`Failed to load devices`)}
        />
      ) : accountSessions.length > 0 ? (
        <div className="space-y-3">
          {accountSessions.map((session, i) => (
            <AccountSessionCard key={i} sub={sub} session={session} />
          ))}
        </div>
      ) : (
        <Admonition.Default
          variant="info"
          title={_(msg`No devices`)}
          text={_(msg`Looks like you aren't logged in on any other devices.`)}
        />
      )}
    </>
  )
}

function ApplicationSessionCard({
  session: { clientId, clientMetadata, tokenId },
  sub,
}: {
  session: ActiveOAuthSession
  sub: string
}) {
  const { _ } = useLingui()
  const { show } = useToast()
  const { mutateAsync: revokeSessions, isPending } =
    useRevokeOAuthSessionMutation()

  const revoke = async () => {
    try {
      await revokeSessions({ sub, tokenId })
      show({
        variant: 'success',
        title: _(msg`Successfully signed out`),
        duration: 2e3,
      })
    } catch (e) {
      console.error(e)
      show({
        variant: 'error',
        title: _(msg`Failed to sign out`),
        duration: 2e3,
      })
    }
  }

  return (
    <div className="bg-contrast-25 dark:bg-contrast-50 border-contrast-50 dark:border-contrast-100 flex items-start justify-between space-x-4 rounded-lg border p-4">
      <div className="flex items-center space-x-2 truncate">
        <Avatar
          size={40}
          src={clientMetadata?.logo_uri}
          displayName={clientMetadata?.client_name}
        />
        <div className="truncate">
          <h3 className="truncate font-bold leading-snug">
            {clientMetadata?.client_name || clientMetadata?.client_uri}
          </h3>
          <p className="text-text-light truncate text-sm leading-snug">
            {clientId}
          </p>
        </div>
      </div>
      <div>
        <Prompt
          title={
            clientMetadata?.client_name
              ? _(msg`Sign out of ${clientMetadata.client_name}`)
              : _(msg`Sign out of this application`)
          }
          description={_(
            msg`Are you sure you want to sign out? Next time you visit you will need to sign back in.`,
          )}
          confirmCTA={_(msg`Sign out`)}
          onConfirm={revoke}
        >
          <Button color="secondary" disabled={isPending}>
            <Button.Text>
              <Trans>Sign out</Trans>
            </Button.Text>
            <ExitIcon width={20} />
          </Button>
        </Prompt>
      </div>
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
  const { show } = useToast()
  const { _, i18n } = useLingui()
  const { mutateAsync: revokeSessions, isPending } =
    useRevokeAccountSessionMutation()

  const remove = async () => {
    try {
      await revokeSessions({ sub, deviceId: session.deviceId })
      show({
        variant: 'success',
        title: _(msg`Successfully removed device`),
        duration: 2e3,
      })
    } catch (e) {
      console.error(e)
      show({
        variant: 'error',
        title: _(msg`Failed to remove device`),
        duration: 2e3,
      })
    }
  }

  const lastUsed = useMemo(() => {
    return i18n.date(new Date(), {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
  }, [session])

  return (
    <div className="border-contrast-50 dark:border-contrast-100 flex items-start justify-between space-x-4 border-t px-2 pt-3">
      <div className="flex flex-col flex-1 space-x-2 truncate">
        <p className="font-semibold truncate">{session.deviceMetadata.userAgent}</p>
        <p className="text-sm">
          <span className="text-text-light">
            {lastUsed}
            {' • '}
          </span>
          <span className="text-warning-600 font-mono truncate">
            {session.deviceMetadata.ipAddress}
          </span>
        </p>
      </div>
      {session.isCurrentDevice && (
        <div className='flex-shrink'>
          <div className='px-2 py-1 rounded-full bg-contrast-25 dark:bg-contrast-50 text-xs text-text-light'>
            <Trans>This device</Trans>
          </div>
        </div>
      )}
      <div>
        <Prompt
          title={_(msg`Remove this device`)}
          description={_(msg`Are you sure you want to remove this device?`)}
          confirmCTA={_(msg`Remove`)}
          onConfirm={remove}
        >
          <Button color="secondary" size="sm" disabled={isPending}>
            <Button.Text>
              <Trans>Remove</Trans>
            </Button.Text>
            <Cross2Icon width={16} />
          </Button>
        </Prompt>
      </div>
    </div>
  )
}
