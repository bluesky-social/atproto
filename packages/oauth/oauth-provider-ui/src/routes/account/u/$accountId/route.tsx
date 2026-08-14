import { msg } from '@lingui/core/macro'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import {
  CircleQuestionMarkIcon,
  GlobeIcon,
  HouseIcon,
  MonitorSmartphoneIcon,
  UserIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import {
  AccountShell,
  type AccountShellLink,
} from '#/components/layouts/account-shell.tsx'
import { ProvideAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useSessionContext } from '#/contexts/session.tsx'

/**
 * The account manager's authenticated frame: the guard, the session the URL
 * names, and the shell every sub-page renders into.
 */
export const Route = createFileRoute('/account/u/$accountId')({
  beforeLoad: ({ context: { auth }, params: { accountId } }) => {
    const session = auth.sessions.find(
      (s) => s.account.handle === accountId || s.account.did === accountId,
    )

    // The URL names an account this device has no usable session for — either
    // it never did, or the user just signed out. The account entry decides
    // where they belong now.
    if (!session || session.loginRequired) {
      throw redirect({ to: '/account', replace: true })
    }

    // Everything below this route — including its loaders — reads the session
    // from here rather than resolving it again.
    return { session }
  },
  component: AccountLayout,
})

function AccountLayout() {
  const { accountId } = Route.useParams()
  const { session } = Route.useRouteContext()
  const { sessions, api, canSwitchAccounts } = useSessionContext()

  const links = useMemo(
    (): AccountShellLink[] => [
      {
        to: '/account/u/$accountId',
        params: { accountId },
        Icon: HouseIcon,
        title: msg`Home`,
      },
      {
        to: '/account/u/$accountId/manage',
        params: { accountId },
        Icon: UserIcon,
        title: msg`Account`,
        description: msg`Manage your account`,
      },
      {
        to: '/account/u/$accountId/devices',
        params: { accountId },
        Icon: MonitorSmartphoneIcon,
        title: msg`Devices`,
        description: msg`Manage your active sessions`,
      },
      {
        to: '/account/u/$accountId/apps',
        params: { accountId },
        Icon: GlobeIcon,
        title: msg`Apps`,
        description: msg`Manage applications that have access to your account`,
      },
      {
        to: '/account/u/$accountId/about',
        params: { accountId },
        Icon: CircleQuestionMarkIcon,
        title: msg`About`,
        description: msg`What is an Atmosphere Account?`,
      },
    ],
    [accountId],
  )

  const value = useMemo(
    () => ({ session, sessions, canSwitchAccounts, api }),
    [session, sessions, canSwitchAccounts, api],
  )

  return (
    <ProvideAuthenticatedSession value={value}>
      {/* @NOTE `links[0]` is the account home. */}
      <AccountShell
        title={msg`My Atmosphere Account`}
        base={links[0]}
        links={links}
      >
        <Outlet />
      </AccountShell>
    </ProvideAuthenticatedSession>
  )
}
