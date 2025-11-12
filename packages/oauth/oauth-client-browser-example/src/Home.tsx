import { Layout } from './components/Layout.tsx'
import { ProfileInfo } from './components/ProfileInfo.tsx'
import { SessionInfo } from './components/SessionInfo.tsx'
import { TokenInfo } from './components/TokenInfo.tsx'
import { UserMenu } from './components/UserMenu.tsx'

export function Home() {
  return (
    <Layout nav={<UserMenu />}>
      <div className="rounded-md bg-white p-4 shadow-md">
        <TokenInfo />
        <ProfileInfo />
        <SessionInfo />
      </div>
    </Layout>
  )
}
