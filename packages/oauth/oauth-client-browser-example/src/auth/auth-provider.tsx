'use client'

import { ReactNode, createContext, useContext, useMemo } from 'react'
import { Agent } from '@atproto/api'
import { OAuthSession } from '@atproto/oauth-client'
import { OAuthSignIn, UseOAuthOptions, useOAuth } from './use-oauth.ts'

export type AuthContextValueSignedIn = {
  signedIn: true
  session: OAuthSession
  agent: Agent
  signIn?: OAuthSignIn
  signUpUrl?: undefined
  signOut: () => void
  refresh: () => void
}

export type AuthContextValueSignedOut = {
  signedIn: false
  session?: undefined
  agent?: undefined
  signIn: OAuthSignIn
  signUpUrl?: string
  signOut?: undefined
  refresh?: undefined
}

export type AuthContextValue =
  | AuthContextValueSignedIn
  | AuthContextValueSignedOut

const AuthContext = createContext<AuthContextValue | null>(null)

export type AuthProviderProps = UseOAuthOptions & {
  children: ReactNode
  signUpUrl?: string
  callbackSuccess?: ReactNode
  suspenseFallback?: ReactNode
}

export const AuthProvider = ({
  children,
  signUpUrl,
  callbackSuccess = <div>This window can be closed</div>,

  // UseOAuthOptions
  ...options
}: AuthProviderProps) => {
  const { isLoginPopup, isInitializing, signIn, session } = useOAuth(options)

  const signedInValue = useMemo<AuthContextValueSignedIn | null>(() => {
    if (!session) return null
    return {
      signedIn: true,
      session,
      agent: new Agent(session),
      signOut: () => session.signOut(),
      refresh: () => session.getTokenInfo(true),
    }
  }, [session])

  const signedOutValue = useMemo<AuthContextValueSignedOut>(() => {
    return {
      signedIn: false,
      signUpUrl,
      signIn,
    }
  }, [signIn, signUpUrl])

  const value: AuthContextValue = signedInValue || signedOutValue

  if (isLoginPopup) {
    return callbackSuccess
  } else if (isInitializing) {
    return null
  } else {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  }
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context) return context

  throw new Error(`useAuthContext() must be used within an <AuthProvider />`)
}

export function useSignedInContext(): AuthContextValueSignedIn {
  const context = useAuthContext()
  if (context.signedIn) return context

  throw new Error(
    `useSignedInContext() must be used within an <AuthProvider /> when signed in`,
  )
}
