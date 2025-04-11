import { useEffect, useState } from 'react'
import {
  AtpSignIn,
  CredentialSignInForm,
} from './credential/credential-sign-in-form.tsx'
import { OAuthSignIn, OAuthSignInForm } from './oauth/oauth-sign-in-form.tsx'

export type AuthFormProps = {
  atpSignIn?: AtpSignIn
  oauthSignIn?: OAuthSignIn
  signUpUrl?: string
}

export function AuthForm({ atpSignIn, oauthSignIn, signUpUrl }: AuthFormProps) {
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
      <div className="my-4 flex">
        <button
          className={`rounded bg-blue-500 px-4 py-1 font-bold text-white hover:bg-blue-700 ${
            method === 'oauth' ? 'bg-blue-700' : ''
          }`}
          onClick={() => oauthSignIn && setMethod('oauth')}
          disabled={!oauthSignIn}
        >
          OAuth
        </button>

        <button
          className={`rounded bg-blue-500 px-4 py-1 font-bold text-white hover:bg-blue-700 ${
            method === 'credential' ? 'bg-blue-700' : ''
          }`}
          onClick={() => atpSignIn && setMethod('credential')}
          disabled={!atpSignIn}
        >
          Credentials
        </button>
      </div>

      {method === 'oauth' && (
        <OAuthSignInForm signIn={oauthSignIn!} signUpUrl={signUpUrl} />
      )}
      {method === 'credential' && <CredentialSignInForm signIn={atpSignIn!} />}
      {method == null && <div>No auth method available</div>}
    </div>
  )
}
