import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { Cross2Icon, ExitIcon } from '@radix-ui/react-icons'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { UAParser } from 'ua-parser-js'
import { ActiveAccountSession, ActiveOAuthSession } from '#/api'
import * as Admonition from '#/components/Admonition'
import { Avatar } from '#/components/Avatar'
import { Button } from '#/components/Button'
import { InlineLink } from '#/components/Link'
import { Loader } from '#/components/Loader'
import { Prompt } from '#/components/Prompt'
import { useToast } from '#/components/Toast'
import { useAccountSessionsQuery } from '#/data/useAccountSessionsQuery'
import { useClientName } from '#/data/useClientName'
import { useFriendlyClientId } from '#/data/useFriendlyClientId'
import { useOAuthSessionsQuery } from '#/data/useOAuthSessionsQuery'
import { useRevokeAccountSessionMutation } from '#/data/useRevokeAccountSessionMutation'
import { useRevokeOAuthSessionMutation } from '#/data/useRevokeOAuthSessionMutation'

export const Route = createFileRoute('/account/_appLayout/$sub')({
  component: RouteComponent,
})

function RouteComponent() {
  const { _ } = useLingui()

  return (
    <>
      <title>{_(msg`Your account`)}</title>
      <AccountHome />
    </>
  )
}

export function AccountHome() {
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
            <Trans>Home</Trans>
          </InlineLink>
        </li>
        <li className="text-custom-primary">/</li>
        <li>
          <Trans>Your account</Trans>
        </li>
      </ul>

      <h2 className="text-custom-primary text-primary pb-4 pt-8 text-xl font-bold">
        <Trans>Connected apps</Trans>
      </h2>

      <p className="text-text-light mb-2">
        <Trans>
          This is a list of all the applications you have authorized to access
          your account.
        </Trans>
      </p>

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
            <ApplicationSessionCard
              key={session.tokenId}
              sub={sub}
              session={session}
            />
          ))}
        </div>
      ) : (
        <Admonition.Default
          variant="info"
          title={_(msg`No connected apps`)}
          text={_(
            msg`It appears that you haven’t used this account to sign in to any apps yet.`,
          )}
        />
      )}

      <h2 className="text-custom-primary pb-4 pt-8 text-xl font-bold">
        <Trans>My devices</Trans>
      </h2>

      <p className="text-text-light mb-2">
        <Trans>
          This is a list of all the devices you have used to sign in to your
          account. New apps can be authorized from any of these devices. If you
          believe that your account has been compromised, we recommend that you
          revoke access to all devices.
        </Trans>
      </p>

      {accountSessionsIsLoading ? (
        <Loader size="lg" fill="var(--color-contrast-300)" />
      ) : accountSessionsError || !accountSessions ? (
        <Admonition.Default
          variant="error"
          text={_(msg`Failed to load devices`)}
        />
      ) : accountSessions.length > 0 ? (
        <div className="space-y-3">
          {accountSessions.map((session) => (
            <AccountSessionCard
              key={`${sub}@${session.deviceId}`}
              sub={sub}
              session={session}
            />
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

  const friendlyClientId = useFriendlyClientId({
    clientId,
  })
  const clientName = useClientName({
    clientId,
    clientMetadata,
  })

  const revoke = async () => {
    try {
      await revokeSessions({ sub, tokenId })
      show({
        variant: 'success',
        title: _(msg`Successfully signed out`),
        duration: 2e3,
      })
    } catch (e) {
      show({
        variant: 'error',
        title: _(msg`Failed to sign out`),
        duration: 2e3,
      })
    }
  }

  return (
    <div className="bg-contrast-25 dark:bg-contrast-50 border-contrast-50 dark:border-contrast-100 flex items-start justify-between space-x-4 rounded-lg border p-4">
      <div className="flex flex-1 items-center space-x-2 truncate">
        <Avatar
          size={40}
          src={clientMetadata?.logo_uri}
          displayName={clientName}
        />
        <div className="flex-1 truncate">
          <h3 className="truncate font-bold leading-snug">{clientName}</h3>
          <p className="text-text-light truncate text-sm leading-snug">
            {friendlyClientId}
          </p>
        </div>
      </div>
      <div>
        <Prompt
          title={
            clientName !== clientId
              ? _(msg`Revoke access to ${clientName}`)
              : _(msg`Revoke access to this application`)
          }
          description={_(
            msg`Are you sure you want to revoke access? This application won't be able to access your account anymore.`,
          )}
          confirmCTA={_(msg`Revoke access`)}
          onConfirm={revoke}
        >
          <Button color="secondary" disabled={isPending}>
            <Button.Text>
              <Trans>Revoke access</Trans>
            </Button.Text>
            <Cross2Icon width={16} />
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

  const { userAgent, lastSeenAt, ipAddress } = session.deviceMetadata

  const ua = useMemo(() => {
    if (!userAgent) {
      return null
    }
    return UAParser(userAgent)
  }, [userAgent])

  const remove = async () => {
    try {
      await revokeSessions({ sub, deviceId: session.deviceId })
      show({
        variant: 'success',
        title: _(msg`Successfully removed device`),
        duration: 2e3,
      })
    } catch (e) {
      show({
        variant: 'error',
        title: _(msg`Failed to remove device`),
        duration: 2e3,
      })
    }
  }

  const lastUsed = useMemo(() => {
    // Fool-proofing
    if (!lastSeenAt) return undefined

    const date = new Date(lastSeenAt)

    // Fool-proofing
    if (isNaN(date.getTime())) return lastSeenAt

    return i18n.date(date, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
  }, [session])

  return (
    <div className="border-contrast-50 dark:border-contrast-100 flex flex-wrap items-center justify-between space-x-4 border-t px-2 pt-3">
      <div className="flex min-w-36 flex-1 flex-col space-x-2 truncate">
        <p className="truncate font-semibold">
          {ua ? (
            ua.device.is('mobile') ? (
              [ua.os.name].filter(Boolean).join(' • ')
            ) : (
              [ua.os.name, ua.browser.name].filter(Boolean).join(' • ')
            )
          ) : (
            <Trans>Unknown user agent</Trans>
          )}
        </p>
        <p className="truncate text-sm">
          <span className="text-text-light">
            {lastUsed}
            {' • '}
          </span>
          <span className="text-warning-600 truncate font-mono">
            {ipAddress}
          </span>
        </p>
      </div>
      {session.isCurrentDevice && (
        <div className="bg-contrast-25 dark:bg-contrast-50 text-text-light min-w-max shrink-0 grow-0 rounded-full px-2 py-1 text-xs">
          <Trans>This device</Trans>
        </div>
      )}
      <Prompt
        title={_(msg`Remove this device`)}
        description={_(msg`Are you sure you want to remove this device?`)}
        confirmCTA={_(msg`Sign out`)}
        onConfirm={remove}
      >
        <Button
          color="secondary"
          size="sm"
          className="min-w-max shrink-0 grow-0"
          disabled={isPending}
        >
          <Button.Text>
            <Trans>Sign out</Trans>
          </Button.Text>
          <ExitIcon width={20} />
        </Button>
      </Prompt>
    </div>
  )
}
