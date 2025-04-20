import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { ChevronRightIcon } from '@radix-ui/react-icons'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ActiveDeviceSession } from '#/api'
import * as Admonition from '#/components/Admonition'
import { Avatar } from '#/components/Avatar'
import { ContentCard } from '#/components/ContentCard'
import { InlineLink, Link } from '#/components/Link'
import { Loader } from '#/components/Loader'
import { useDeviceSessionsQuery } from '#/data/useDeviceSessionsQuery'
import { getAccountName } from '#/util/getAccountName'
import { sanitizeHandle } from '#/util/sanitizeHandle'

export const Route = createFileRoute('/account/_minimalLayout/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { _ } = useLingui()

  return (
    <>
      <title>{_(msg`Accounts`)}</title>
      <Index />
    </>
  )
}

function Index() {
  const { _ } = useLingui()
  const { data: sessions, isLoading, error } = useDeviceSessionsQuery()

  // This is the account dashboard home page.
  //
  // @TODO When the user is signed in, redirect to their account page.
  //
  // @TODO When the user is not signed in, show a nice (anonymous) view that
  // explains them they can create an account on this PDS.

  return isLoading ? (
    <div className="flex items-center justify-center">
      <Loader size="lg" />
    </div>
  ) : error || !sessions ? (
    <Admonition.Default
      variant="error"
      title={_(msg`Something went wrong`)}
      text={_(
        msg`We weren't able to load your accounts. Please refresh the page to try again.`,
      )}
    />
  ) : sessions.length ? (
    <SelectorScreen sessions={sessions} />
  ) : (
    <Navigate to="/account/sign-in" />
  )
}

export function SelectorScreen({
  sessions,
}: {
  sessions: ActiveDeviceSession[]
}) {
  const { _ } = useLingui()

  return (
    <>
      <ContentCard>
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-custom-primary text-xl font-bold">
              <Trans>Accounts</Trans>
            </h1>
            <p className="text-text-light">
              <Trans>Select the account you would like to manage.</Trans>
            </p>
          </div>

          <div className="space-y-2">
            {sessions
              // @TODO redirect to sign in with the identifier pre-filled when a
              // login is required (session is too old).
              .filter((s) => !s.loginRequired)
              .map(({ account }) => (
                <Link
                  key={account.sub}
                  to="/account/$sub"
                  params={account}
                  className={clsx([
                    'flex items-center space-x-2 rounded-lg border px-2 py-2',
                    'bg-contrast-25 dark:bg-contrast-50 border-contrast-50 dark:border-contrast-100',
                    'hover:bg-contrast-50 dark:hover:bg-contrast-100',
                  ])}
                  label={_(
                    msg`View and manage account for ${getAccountName(account)}`,
                  )}
                >
                  <Avatar
                    size={40}
                    src={account.picture}
                    displayName={account.name}
                  />
                  <div className="flex-1 space-y-0 truncate">
                    <h2 className="text-primary truncate font-semibold leading-snug">
                      {account.name}
                    </h2>
                    <p className="text-text-light truncate text-sm">
                      {sanitizeHandle(account.preferred_username) ||
                        account.sub}
                    </p>
                  </div>
                  <ChevronRightIcon width={20} className="text-text-light" />
                </Link>
              ))}

            <InlineLink
              to="/account/sign-in"
              className="text-text-light inline-block w-full pt-2 text-center text-sm"
            >
              <Trans>Sign in with another account</Trans>
            </InlineLink>
          </div>
        </div>
      </ContentCard>
    </>
  )
}
