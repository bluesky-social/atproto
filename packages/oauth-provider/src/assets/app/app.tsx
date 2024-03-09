import { useMemo, useState } from 'react'

import type { AuthorizeData } from './backend-data'
import { cookies } from './cookies'
import { Account, Session } from './types'

import { AcceptPage } from './pages/accept-page'
import { PageLayout } from './components/page-layout'
import { SessionSelectionPage } from './pages/session-selector-page'

export function App({
  requestUri,
  clientId,
  clientMetadata,
  csrfCookie,
  loginHint,
  sessions: initialSessions,
}: AuthorizeData) {
  const csrfToken = useMemo(() => cookies[csrfCookie], [csrfCookie])
  const [isDone, setIsDone] = useState(false)
  const [sessions, setSessions] = useState(initialSessions)
  const [selectedSession, onSession] = useState<Session | null>(null)

  const updateSession = useMemo(() => {
    return (account: Account, consentRequired: boolean): Session => {
      const sessionIdx = sessions.findIndex(
        (s) => s.account.sub === account.sub,
      )
      if (sessionIdx === -1) {
        const newSession: Session = {
          initiallySelected: false,
          account,
          loginRequired: false,
          consentRequired,
        }
        setSessions([...sessions, newSession])
        return newSession
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
        return newSession
      }
    }
  }, [sessions, setSessions])

  const onLogin = async (credentials: {
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
    const session = updateSession(account, consentRequired)
    onSession(session)
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
    return (
      <AcceptPage
        onBack={() => onSession(null)}
        onAccept={() => authorizeAccept(selectedSession.account)}
        onReject={() => authorizeReject()}
        account={selectedSession.account}
        clientId={clientId}
        clientMetadata={clientMetadata}
      />
    )
  }

  return (
    <SessionSelectionPage
      clientId={clientId}
      clientMetadata={clientMetadata}
      loginHint={loginHint}
      sessions={sessions}
      onLogin={onLogin}
      onSession={onSession}
      onBack={() => authorizeReject()}
      backLabel="Deny access"
    />
  )
}
