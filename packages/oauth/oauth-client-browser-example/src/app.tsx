import { useAuthContext } from './auth/auth-provider.tsx'
import { OAuthLogin } from './auth/oauth-login.tsx'
import { useGlobalAgent } from './auth/use-global-agent.ts'
import { ProfileInfo } from './components/profile-info.tsx'
import { SessionInfo } from './components/session-info.tsx'
import { TokenInfo } from './components/token-info.tsx'
import { UserMenu } from './components/user-menu.tsx'

function App() {
  const { signedIn } = useAuthContext()

  // Expose agent on `window` for debugging purposes
  useGlobalAgent()

  return (
    <div className="container mx-auto flex min-h-screen max-w-3xl flex-col p-4">
      <nav className="mb-8 flex items-center">
        <div className="flex-1" />
        {signedIn && <UserMenu />}
      </nav>

      <main className="flex flex-1 flex-col items-stretch space-y-4">
        {signedIn ? (
          <div className="rounded-md bg-white p-4 shadow-md">
            <TokenInfo />
            <ProfileInfo />
            <SessionInfo />
          </div>
        ) : (
          <div className="flex flex-grow flex-col items-center justify-center">
            <OAuthLogin />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
