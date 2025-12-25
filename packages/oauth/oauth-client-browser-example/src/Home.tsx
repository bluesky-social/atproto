import { Layout } from './components/Layout.tsx'
import { ProfileInfo } from './components/ProfileInfo.tsx'
import { SessionInfo } from './components/SessionInfo.tsx'
import { TokenInfo } from './components/TokenInfo.tsx'
import { UserMenu } from './components/UserMenu.tsx'

export function Home() {
  return (
    <Layout nav={<UserMenu />}>
      <ProfileInfo className="rounded-md bg-white shadow-md">
        <div className="p-4">
          <TokenInfo />
          <SessionInfo />
        </div>
      </ProfileInfo>
    </Layout>
  )
}
