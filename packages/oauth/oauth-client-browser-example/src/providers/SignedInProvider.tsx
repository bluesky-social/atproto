import { useEffect, useState } from 'react'
import { AtmosphereSignInDialog } from '../components/AtmosphereSignInDialog.tsx'
import { Layout } from '../components/Layout.tsx'
import { Spinner } from '../components/_spinner.tsx'
import { SIGN_UP_URL } from '../constants.ts'
import { useOAuthContext } from './OAuthProvider.tsx'

export function SignedInProvider({ children }: { children?: React.ReactNode }) {
  const { isSignedIn, isLoading, signIn } = useOAuthContext()
  const [isReady, setIsReady] = useState(isSignedIn || !isLoading)

  useEffect(() => {
    if (!isLoading) setIsReady(true)
  }, [isLoading])

  if (isSignedIn) return <>{children}</>

  return (
    <Layout>
      <div className="flex flex-grow flex-col items-center justify-center">
        {isReady ? (
          <AtmosphereSignInDialog
            signUpUrl={SIGN_UP_URL}
            loading={isLoading}
            signIn={signIn}
          />
        ) : (
          <Spinner />
        )}
      </div>
    </Layout>
  )
}
