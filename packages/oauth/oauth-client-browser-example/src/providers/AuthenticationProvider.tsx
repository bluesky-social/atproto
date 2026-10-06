import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react'
import type { DidString } from '@atproto/lex'
import type { OAuthSession } from '@atproto/oauth-client-browser'
import { AtmosphereSignInForm } from '../components/AtmosphereSignInForm.tsx'
import { Layout } from '../components/Layout.tsx'
import { FEDCM_PROVIDER_URLS, PDS_OPERATOR_URL } from '../constants.ts'
import { createFedcmAppState } from '../lib/fedcm.ts'
import { useFedcmAutoSignIn } from '../lib/use-fedcm-auto-sign-in.ts'
import { oauthClient } from '../oauthClient.ts'
import { useOAuthContext } from './OAuthProvider.tsx'

export type AuthenticationType = {
  session: OAuthSession
  signOut: () => Promise<void>
}

export const AuthenticationContext = createContext<AuthenticationType | null>(
  null,
)
AuthenticationContext.displayName = 'AuthenticationContext'

async function fedcmSignInRedirect(
  did: DidString,
  signal: AbortSignal,
): Promise<never> {
  const url = await oauthClient.authorize(did, {
    signal,
    state: createFedcmAppState(did),
  })

  // @NOTE authorize() can finish creating the PAR request after its signal is
  // aborted. Do not let that stale FedCM selection redirect over a manual
  // sign-in that the user started in the meantime.
  if (signal.aborted) {
    await oauthClient.abortRequest(url)
    signal.throwIfAborted()
  }

  window.location.href = url.href

  // @NOTE Match signInRedirect's cleanup when a user navigates back to this page.
  return new Promise<never>((_resolve, reject) => {
    window.setTimeout(
      (err: Error) => {
        oauthClient.abortRequest(url).then(
          () => reject(err),
          (reason) => reject(new AggregateError([err, reason])),
        )
      },
      5e3,
      new Error('User navigated back'),
    )
  })
}

/**
 * Gates children behind an authentication flow. If the user is not signed in,
 * it will render a sign-in form. If the user is signed in, it will render the
 * children and provide the session and signOut function via context.
 */
export function AuthenticationProvider({ children }: { children?: ReactNode }) {
  const { session, signIn, signUp, signOut, fedcmDidMismatch } =
    useOAuthContext(AuthenticationProvider.name)
  const fedcmRedirectStarted = useRef(false)

  const continueWithFedcmAccount = useCallback(
    (did: DidString, signal: AbortSignal) => {
      if (fedcmRedirectStarted.current) return
      signal.throwIfAborted()
      fedcmRedirectStarted.current = true

      // @NOTE FedCM supplies the OAuth hint only; app state binds the callback
      // to that DID before the example accepts the resulting session.
      void fedcmSignInRedirect(did, signal).catch((err) => {
        fedcmRedirectStarted.current = false
        if (!signal.aborted) {
          console.error('FedCM OAuth redirect failed:', err)
        }
      })
    },
    [],
  )

  const cancelFedcm = useFedcmAutoSignIn(
    session || fedcmDidMismatch ? [] : FEDCM_PROVIDER_URLS,
    continueWithFedcmAccount,
  )

  const signInAfterFedcm = useCallback(
    (input: string, options?: { display?: 'popup' }) => {
      cancelFedcm()
      return signIn(input, options)
    },
    [cancelFedcm, signIn],
  )

  const signUpAfterFedcm = useCallback(
    (input: string, options?: { display?: 'popup' }) => {
      cancelFedcm()
      return signUp(input, options)
    },
    [cancelFedcm, signUp],
  )

  const value = useMemo<AuthenticationType | null>(
    () => (session ? { session, signOut } : null),
    [session, signOut],
  )

  if (!value) {
    return (
      <Layout>
        <div className="flex flex-grow flex-col items-center justify-center">
          <AtmosphereSignInForm
            pdsOperatorUrl={PDS_OPERATOR_URL}
            signIn={signInAfterFedcm}
            signUp={signUpAfterFedcm}
          />
          {fedcmDidMismatch && (
            <p
              className="mt-4 max-w-prose text-center text-red-700 dark:text-red-300"
              role="alert"
            >
              FedCM selected {fedcmDidMismatch.expected}, but OAuth signed in as{' '}
              {fedcmDidMismatch.actual}. This OAuth session was not accepted.
              Please sign in again.
            </p>
          )}
        </div>
      </Layout>
    )
  }

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  )
}

export function useAuthenticationContext(
  hookName = useAuthenticationContext.name,
) {
  const context = useContext(AuthenticationContext)
  if (context) return context

  throw new Error(
    `${hookName} must be used within a ${AuthenticationContext.displayName}`,
  )
}
