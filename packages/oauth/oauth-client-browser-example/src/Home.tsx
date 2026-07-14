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
      <ProfileCard actor={did}>
        <div className="p-4">
          <ProfileInfo />
          <SessionInfo />
          <TokenInfo />
        </div>
      </ProfileCard>
    </Layout>
  )
}
