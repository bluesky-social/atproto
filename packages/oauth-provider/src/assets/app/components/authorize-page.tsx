import { useMemo, useState } from 'react'

import type { AuthorizeData } from '../backend-data'
import { cookies } from '../cookies'
import { Account, Session } from '../types'

import { AcceptPage } from './accept-page'
import { PageLayout } from './page-layout'
import { LoginPage } from './login-page'
import { SessionSelectorPage } from './session-selector-page'

export function AuthorizePage({
  requestUri,
  clientId,
  clientMetadata,
  csrfCookie,
  consentRequired: initialConsentRequired,
  loginHint: initialLoginHint,
  sessions: initialSessions,
}: AuthorizeData) {
  const csrfToken = useMemo(() => cookies[csrfCookie], [csrfCookie])
  const [isDone, setIsDone] = useState(false)
  const [loginHint, setLoginHint] = useState(initialLoginHint)
  const [sessions, setSessions] = useState(initialSessions)
  const [sub, setSub] = useState(
    initialSessions.find((s) => s.initiallySelected)?.account.sub || null,
  )

  const selectedSession = sub && sessions.find((s) => s.account.sub == sub)

  const setAccount = (account: Account, consentRequired: boolean) => {
    setLoginHint(undefined)
    setSub(account.sub)
    if (consentRequired === false && initialConsentRequired === false) {
      authorizeAccept(account)
    }
  }

  const updateSession = (account: Account, consentRequired: boolean) => {
    const sessionIdx = sessions.findIndex((s) => s.account.sub === account.sub)
    if (sessionIdx === -1) {
      const newSession: Session = {
        initiallySelected: false,
        account,
        loginRequired: false,
        consentRequired,
      }
      setSessions([...sessions, newSession])
    } else {
      const curSession = sessions[sessionIdx]
      const newSession: Session = {
        ...curSession,
        initiallySelected: false,
        account,
        consentRequired,
        loginRequired: false,
      }
      setSessions([
        ...sessions.slice(0, sessionIdx),
        newSession,
        ...sessions.slice(sessionIdx + 1),
      ])
    }
  }

  const performLogin = async (credentials: {
    username: string
    password: string
    remember: boolean
  }) => {
    const r = await fetch('/oauth/authorize/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'same-origin',
      body: JSON.stringify({
        csrf_token: csrfToken,
        request_uri: requestUri,
        client_id: clientId,
        credentials,
      }),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error || 'Error', { cause: json })

    const { account, info } = json
    const consentRequired = !info.authorizedClients.includes(clientId)
    updateSession(account, consentRequired)
    setAccount(account, consentRequired)
  }

  const authorizeAccept = async (account: Account) => {
    setIsDone(true)

    const url = new URL('/oauth/authorize/accept', window.origin)
    url.searchParams.set('request_uri', requestUri)
    url.searchParams.set('account_sub', account.sub)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('csrf_token', csrfToken)

    window.location.href = url.href
  }

  const authorizeReject = () => {
    setIsDone(true)

    const url = new URL('/oauth/authorize/reject', window.origin)
    url.searchParams.set('request_uri', requestUri)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('csrf_token', csrfToken)

    window.location.href = url.href
  }

  if (isDone) {
    // TODO
    return (
      <PageLayout title="Login complete">You are being redirected</PageLayout>
    )
  }

  if (selectedSession) {
    if (selectedSession.loginRequired === false) {
      return (
        <AcceptPage
          onBack={() => setSub(null)}
          onAccept={() => authorizeAccept(selectedSession.account)}
          onReject={() => authorizeReject()}
          account={selectedSession.account}
          clientId={clientId}
          clientMetadata={clientMetadata}
        />
      )
    } else {
      return (
        <LoginPage
          username={selectedSession.account.preferred_username}
          usernameReadonly={true}
          onLogin={performLogin}
          onBack={() => authorizeReject()}
        />
      )
    }
  }

  if (loginHint) {
    return (
      <LoginPage
        username={loginHint}
        onLogin={performLogin}
        onBack={() => setLoginHint(undefined)}
      />
    )
  }

  return (
    <SessionSelectorPage
      sessions={sessions}
      onLogin={performLogin}
      onSession={({ account }) =>
        setAccount(
          account,
          sessions.find((s) => s.account.sub === account.sub)
            ?.consentRequired || false,
        )
      }
      onBack={() => authorizeReject()}
    />
  )
}
