import { msg } from '@lingui/core/macro'
import { Navigate, Outlet, useParams } from '@tanstack/react-router'
import {
  CircleQuestionMarkIcon,
  GlobeIcon,
  HouseIcon,
  MonitorSmartphoneIcon,
  UserIcon,
} from 'lucide-react'
import { useEffect } from 'react'
import { AccountShell } from '#/components/layouts/account-shell.tsx'
import { ProvideAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useSessionContext } from '#/contexts/session.tsx'

export default function Page() {
  const params = useParams({ strict: false })
  const sessionContext = useSessionContext()
  const { sessions, session, setSession, api, canSwitchAccounts } =
    sessionContext

  const selected = sessions.find(
    (s) =>
      s.account.handle === params.accountId ||
      s.account.did === params.accountId,
  )

  // Mirror the URL selection into the session context so that `api` carries
  // the right account's token (the context is the single owner of `api`).
  useEffect(() => {
    if (selected && session?.account.did !== selected.account.did) {
      setSession(selected)
    }
  }, [selected, session, setSession])

  if (!selected || selected.loginRequired) {
    return <Navigate to="/account/sign-in" replace />
  }

  if (!session || session?.account.did !== selected.account.did) {
    return <Navigate to="/account/sign-in" replace />
  }

  const accountId = session.account.handle ?? session.account.did

  return (
    <ProvideAuthenticatedSession
      value={{ session, sessions, canSwitchAccounts, api }}
    >
      <AccountShell
        title={msg`My Atmosphere Account`}
        basePath="/account"
        links={[
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
        ]}
      >
        <Outlet />
      </AccountShell>
    </ProvideAuthenticatedSession>
  )
}
