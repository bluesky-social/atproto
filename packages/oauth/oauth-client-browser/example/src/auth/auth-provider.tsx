'use client'

import { Agent } from '@atproto/api'
import { createContext, ReactNode, useContext, useMemo } from 'react'

import { useCredentialAuth } from './credential/use-credential-auth'
import { AuthForm } from './auth-form'
import { useOAuth, UseOAuthOptions } from './oauth/use-oauth'

export type AuthContext = {
  pdsAgent: Agent
  signOut: () => void
}

const AuthContext = createContext<AuthContext | null>(null)

export const AuthProvider = ({
  children,
  ...options
}: {
  children: ReactNode
} & UseOAuthOptions) => {
  const {
    isLoginPopup,
    isInitializing,
    client: oauthClient,
    agent: oauthAgent,
    signIn: oauthSignIn,
    signOut: oauthSignOut,
  } = useOAuth(options)

  const {
    agent: credentialAgent,
    signIn: credentialSignIn,
    signOut: credentialSignOut,
  } = useCredentialAuth()

  const value = useMemo<AuthContext | null>(
    () =>
      oauthAgent
        ? { pdsAgent: oauthAgent, signOut: oauthSignOut }
        : credentialAgent
          ? { pdsAgent: credentialAgent, signOut: credentialSignOut }
          : null,
    [oauthAgent, oauthSignOut, credentialAgent, credentialSignOut],
  )

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
        oauthSignIn={oauthClient ? oauthSignIn : undefined}
      />
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthContext {
  const context = useContext(AuthContext)
  if (context) return context

  throw new Error(`useAuthContext() must be used within an <AuthProvider />`)
}
