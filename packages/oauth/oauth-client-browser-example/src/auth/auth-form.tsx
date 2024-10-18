import { useEffect, useState } from 'react'

import {
  AtpSignIn,
  CredentialSignInForm,
} from './credential/credential-sign-in-form'
import { OAuthSignIn, OAuthSignInForm } from './oauth/oauth-sign-in-form'

export function AuthForm({
  atpSignIn,
  oauthSignIn,
}: {
  atpSignIn?: AtpSignIn
  oauthSignIn?: OAuthSignIn
}) {
  const defaultMethod = oauthSignIn
    ? 'oauth'
    : atpSignIn
      ? 'credential'
      : undefined

  const [method, setMethod] = useState<undefined | 'oauth' | 'credential'>(
    defaultMethod,
  )

  useEffect(() => {
    if (method === 'oauth' && !oauthSignIn) {
      setMethod(defaultMethod)
    } else if (method === 'credential' && !atpSignIn) {
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
            method === 'credential' ? 'bg-blue-700' : ''
          }`}
          onClick={() => atpSignIn && setMethod('credential')}
          disabled={!atpSignIn}
        >
          Credentials
        </button>
      </div>

      {method === 'oauth' && <OAuthSignInForm signIn={oauthSignIn!} />}
      {method === 'credential' && <CredentialSignInForm signIn={atpSignIn!} />}
      {method == null && <div>No auth method available</div>}
    </div>
  )
}
