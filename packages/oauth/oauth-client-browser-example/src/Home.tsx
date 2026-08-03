import { Layout } from './components/Layout.tsx'
import { ProfileCard } from './components/ProfileCard.tsx'
import { ProfileInfo } from './components/ProfileInfo.tsx'
import { SessionInfo } from './components/SessionInfo.tsx'
import { TokenInfo } from './components/TokenInfo.tsx'
import { UserMenu } from './components/UserMenu.tsx'
import { useOAuthSession } from './providers/OAuthProvider.tsx'

export function Home() {
  const { did } = useOAuthSession()
  return (
    <Layout nav={<UserMenu />}>
      <ProfileCard
        actor={did}
        className="rounded-md bg-white text-slate-900 shadow-md dark:bg-slate-900 dark:text-slate-100"
      >
        <ProfileInfo className="m-4" />
        <SessionInfo className="m-4" />
        <TokenInfo className="m-4" />
      </ProfileCard>
    </Layout>
  )
}
