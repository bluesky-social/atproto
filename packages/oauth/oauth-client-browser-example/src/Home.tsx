import { Layout } from './components/Layout.tsx'
import { ProfileCard } from './components/ProfileCard.tsx'
import { ProfileInfo } from './components/ProfileInfo.tsx'
import { SessionInfo } from './components/SessionInfo.tsx'
import { TokenInfo } from './components/TokenInfo.tsx'
import { UserMenu } from './components/UserMenu.tsx'
import { BSKY_API_ENABLED } from './constants.ts'
import { useOAuthSession } from './providers/OAuthProvider.tsx'

export function Home() {
  const { did } = useOAuthSession()
  const className =
    'rounded-md bg-white text-slate-900 shadow-md dark:bg-slate-900 dark:text-slate-100'
  const details = (
    <>
      <ProfileInfo className="m-4" />
      <SessionInfo className="m-4" />
      <TokenInfo className="m-4" />
    </>
  )
  return (
    <Layout nav={<UserMenu />}>
      {BSKY_API_ENABLED ? (
        <ProfileCard actor={did} className={className}>
          {details}
        </ProfileCard>
      ) : (
        // No AppView (`bsky_api_did=none`): skip the Bluesky profile card.
        <div className={`${className} py-1`}>{details}</div>
      )}
    </Layout>
  )
}
