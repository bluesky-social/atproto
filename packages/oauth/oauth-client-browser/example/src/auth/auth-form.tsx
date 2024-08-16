import { useCallback, useEffect, useState } from 'react'

import { AtpSignIn, AtpSignInForm } from './atp/atp-sign-in-form'
import { OAuthSignIn, OAuthSignInForm } from './oauth/oauth-sign-in-form'

export function AuthForm({
  atpSignIn,
  oauthSignIn,
}: {
  atpSignIn?: AtpSignIn
  oauthSignIn?: OAuthSignIn
}) {
  const defaultMethod = useCallback(
    () => (oauthSignIn ? 'oauth' : atpSignIn ? 'atp' : undefined),
    [],
  )

  const [method, setMethod] = useState<undefined | 'oauth' | 'atp'>(
    defaultMethod,
  )

  useEffect(() => {
    if (method === 'oauth' && !oauthSignIn) {
      setMethod(defaultMethod)
    } else if (method === 'atp' && !atpSignIn) {
      setMethod(defaultMethod)
    } else if (!method) {
      setMethod(defaultMethod)
    }
  }, [atpSignIn, oauthSignIn, defaultMethod, method])

  // Tailwind css tabs
  return (
    <div className="p-4">
      <div className="flex my-4">
        <button
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-4 rounded ${
            method === 'oauth' ? 'bg-blue-700' : ''
          }`}
          onClick={() => oauthSignIn && setMethod('oauth')}
          disabled={!oauthSignIn}
        >
          OAuth
        </button>

        <button
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-4 rounded ${
            method === 'atp' ? 'bg-blue-700' : ''
          }`}
          onClick={() => atpSignIn && setMethod('atp')}
          disabled={!atpSignIn}
        >
          Credentials
        </button>
      </div>

      {method === 'oauth' && <OAuthSignInForm signIn={oauthSignIn!} />}
      {method === 'atp' && <AtpSignInForm signIn={atpSignIn!} />}
      {method == null && <div>No auth method available</div>}
    </div>
  )
}
