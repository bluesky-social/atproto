import { useState } from 'react'

import { Session } from '../types'
import { AccountList } from './account-list'
import { LoginForm } from './login-form'

export function SessionSelector({
  sessions,
  onSession,
  onLogin,
  onBack = undefined,
}: {
  sessions: readonly Session[]
  onSession: (session: Session) => void
  onLogin: (credentials: {
    username: string
    password: string
    remember: boolean
  }) => void
  onBack?: () => void
}) {
  const [showLogin, setShowLogin] = useState(sessions.length === 0)

  return showLogin ? (
    <LoginForm
      onLogin={onLogin}
      onBack={
        sessions.length > 0
          ? () => {
              if (sessions.length > 0) setShowLogin(false)
            }
          : onBack
      }
    />
  ) : (
    <AccountList
      accounts={sessions.map((s) => s.account)}
      onAccount={(a) => {
        const session = sessions.find((s) => s.account.sub === a.sub)
        if (session) onSession(session)
      }}
      another={() => setShowLogin(true)}
      onBack={onBack}
    />
  )
}
