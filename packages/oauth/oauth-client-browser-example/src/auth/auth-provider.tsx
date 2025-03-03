'use client'

import { ReactNode, createContext, useContext, useMemo } from 'react'
import { Agent } from '@atproto/api'
import { AuthForm } from './auth-form.tsx'
import { useCredentialAuth } from './credential/use-credential-auth.ts'
import { UseOAuthOptions, useOAuth } from './oauth/use-oauth.ts'

export type AuthContextValue = {
  pdsAgent: Agent
  signOut: () => void
  refresh: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export type AuthProviderProps = UseOAuthOptions & {
  children: ReactNode
  signUpUrl?: string
}

export const AuthProvider = ({
  children,
  signUpUrl,

  // UseOAuthOptions
  ...options
}: AuthProviderProps) => {
  const {
    isLoginPopup,
    isInitializing,
    client: oauthClient,
    agent: oauthAgent,
    signIn: oauthSignIn,
    signOut: oauthSignOut,
    refresh: oauthRefresh,
  } = useOAuth(options)

  const {
    agent: credentialAgent,
    signIn: credentialSignIn,
    signOut: credentialSignOut,
    refresh: credentialRefresh,
  } = useCredentialAuth()

  const value = useMemo<AuthContextValue | null>(() => {
    if (oauthAgent) {
      return {
        pdsAgent: oauthAgent,
        signOut: oauthSignOut,
        refresh: oauthRefresh,
      }
    }

    if (credentialAgent) {
      return {
        pdsAgent: credentialAgent,
        signOut: credentialSignOut,
        refresh: credentialRefresh,
      }
    }

    return null
  }, [
    oauthAgent,
    oauthSignOut,
    credentialAgent,
    credentialSignOut,
    oauthRefresh,
    credentialRefresh,
  ])

  if (isLoginPopup) {
    return <div>This window can be closed</div>
  }

  if (isInitializing) {
    return <div>Initializing...</div>
  }

  if (!value) {
    return (
      <AuthForm
        atpSignIn={credentialSignIn}
        signUpUrl={signUpUrl}
        oauthSignIn={oauthClient ? oauthSignIn : undefined}
      />
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context) return context

  throw new Error(`useAuthContext() must be used within an <AuthProvider />`)
}
