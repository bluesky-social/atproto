import { AtpSessionData, AtpSessionManager } from '@atproto/api'
import { useCallback, useMemo, useState } from 'react'

type Session = AtpSessionData & { service: string }

export function useAtpAuth() {
  const persistSession = useCallback((session?: Session) => {
    if (session) {
      saveSession(session)
    } else {
      deleteSession()
      setSession(null)
    }
  }, [])

  const [session, setSession] = useState<null | AtpSessionManager>(() => {
    const prev = loadSession()
    if (!prev) return null

    const { service } = prev

    const session = new AtpSessionManager({
      service,
      persistSession: (type, session) => {
        persistSession(session && { ...session, service })
      },
    })
    session.resumeSession(prev)
    return session
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
      const session = new AtpSessionManager({
        service,
        persistSession: (type, session) => {
          persistSession(session && { ...session, service })
        },
      })
      await session.login({ identifier, password, authFactorToken })
      setSession(session)
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (session) {
      // Is there no way to clear credentials?
      // await session.logout()
      setSession(null)
    }
  }, [session])

  return useMemo(
    () => ({ signIn, signOut, session }),
    [signIn, signOut, session],
  )
}

const SESSION_KEY = '@@ATPROTO/SESSION'

function loadSession(): Session | undefined {
  try {
    const str = localStorage.getItem(SESSION_KEY)
    const obj: unknown = str ? JSON.parse(str) : undefined
    if (
      obj &&
      obj['service'] &&
      obj['refreshJwt'] &&
      obj['accessJwt'] &&
      obj['handle'] &&
      obj['did']
    ) {
      return obj as Session
    }
    return undefined
  } catch (e) {
    return undefined
  }
}

function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function deleteSession() {
  localStorage.removeItem(SESSION_KEY)
}
