import { AtpSessionData, AtpAgent } from '@atproto/api'
import { useCallback, useMemo, useState } from 'react'

type Session = AtpSessionData & { service: string }

export function useCredentialAuth() {
  const createAgent = useCallback((service: string) => {
    const agent = new AtpAgent({
      service,
      persistSession: (type, session) => {
        if (session) {
          saveSession({ ...session, service })
        } else {
          setAgent((a) => (a === agent ? null : a))
          deleteSession()
        }
      },
    })
    return agent
  }, [])

  const [agent, setAgent] = useState<null | AtpAgent>(() => {
    const prev = loadSession()
    if (!prev) return null

    const agent = createAgent(prev.service)
    agent.resumeSession(prev)
    return agent
  })

  const signIn = useCallback(
    async ({
      identifier,
      password,
      authFactorToken,
      service,
    }: {
      identifier: string
      password: string
      authFactorToken?: string
      service: string
    }) => {
      const agent = createAgent(service)
      await agent.login({ identifier, password, authFactorToken })
      setAgent(agent)
    },
    [createAgent],
  )

  return useMemo(
    () => ({
      agent,
      signIn,
      signOut: () => agent?.logout(),
      refresh: () => agent?.sessionManager.refreshSession(),
    }),
    [signIn, agent],
  )
}

const SESSION_KEY = '@@ATPROTO/SESSION'

function loadSession(): Session | undefined {
  try {
    const str = localStorage.getItem(SESSION_KEY)
    const obj: unknown = str ? JSON.parse(str) : undefined
    if (isSession(obj)) return obj
    return undefined
  } catch (e) {
    return undefined
  }
}

function isSession(obj: unknown): obj is Session {
  if (obj == null || typeof obj !== 'object') return false
  const rec = obj as Record<string, unknown>
  return (
    typeof rec['refreshJwt'] !== 'string' &&
    typeof rec['accessToken'] !== 'string' &&
    typeof rec['handle'] !== 'string' &&
    typeof rec['did'] !== 'string' &&
    typeof rec['service'] !== 'string'
  )
}

function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function deleteSession() {
  localStorage.removeItem(SESSION_KEY)
}
