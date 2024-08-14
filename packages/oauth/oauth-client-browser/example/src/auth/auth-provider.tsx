'use client'

import { Agent } from '@atproto/api'
import { createContext, ReactNode, useContext, useMemo } from 'react'

import { useAtpAuth } from './atp/use-atp-auth'
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
  } = useOAuth(options)

  const { agent: atpAgent, signIn: atpSignIn } = useAtpAuth()

  const value = useMemo<AuthContext | null>(
    () =>
      oauthAgent
        ? { pdsAgent: oauthAgent, signOut: () => oauthAgent.signOut() }
        : atpAgent
          ? { pdsAgent: atpAgent, signOut: () => atpAgent.logout() }
          : null,
    [atpAgent, oauthAgent],
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
        atpSignIn={atpSignIn}
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
