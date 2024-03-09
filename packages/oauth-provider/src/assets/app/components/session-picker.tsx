import { HTMLAttributes, useMemo, useState } from 'react'

import { Session } from '../types'
import { AccountPicker } from './account-picker'
import { LoginForm } from './login-form'

export type SessionPickerProps = {
  sessions: readonly Session[]
  loginHint?: string
  onSession: (session: Session) => void
  onLogin: (credentials: {
    username: string
    password: string
    remember: boolean
  }) => void
  onBack?: () => void
  backLabel?: string | JSX.Element
}

export function SessionPicker({
  sessions,
  onSession,
  onLogin,
  onBack = undefined,
  loginHint = undefined,
  backLabel = 'Back',
  ...props
}: SessionPickerProps & HTMLAttributes<HTMLElement>) {
  const [showOther, setShowOther] = useState(sessions.length === 0)

  const [sub, setSub] = useState(
    sessions.find((s) => s.initiallySelected)?.account.sub || null,
  )

  const selectedSession = useMemo(() => {
    return sub ? sessions.find((s) => s.account.sub == sub) : undefined
  }, [sub, sessions])

  const onAccount = useMemo(() => {
    return (a) => {
      const session = sessions.find((s) => s.account.sub === a.sub)
      if (session?.loginRequired) setSub(a.sub)
      else if (session) onSession(session)
    }
  }, [sessions, onSession])

  if (loginHint) {
    return (
      <LoginForm
        username={loginHint}
        usernameReadonly={true}
        onLogin={onLogin}
        onBack={onBack}
        backLabel={backLabel}
        {...props}
      />
    )
  }

  if (sessions.length === 0) {
    return (
      <LoginForm
        onLogin={onLogin}
        onBack={onBack}
        backLabel={backLabel}
        {...props}
      />
    )
  }

  if (showOther) {
    return (
      <LoginForm
        onLogin={onLogin}
        onBack={() => setShowOther(false)}
        backLabel={'Back'}
        {...props}
      />
    )
  }

  if (selectedSession && selectedSession.loginRequired) {
    return (
      <LoginForm
        username={selectedSession.account.preferred_username}
        usernameReadonly={true}
        onLogin={onLogin}
        onBack={() => setSub(null)}
        backLabel={'Back'}
        {...props}
      />
    )
  }

  const { className, ...rest } = props
  return (
    <div className={className}>
      <p className="font-medium p-4">Sign in as...</p>
      <AccountPicker
        accounts={sessions.map((s) => s.account)}
        onAccount={onAccount}
        onOther={() => setShowOther(true)}
        {...rest}
      />
      {onBack && (
        <div className="m-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onBack()}
            className="bg-transparent font-light text-primary rounded-md py-2"
          >
            {backLabel}
          </button>
        </div>
      )}
    </div>
  )
}
