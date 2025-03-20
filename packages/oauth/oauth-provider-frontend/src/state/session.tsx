import React from 'react'

import { Session } from '#/api'

type Context = {
  session: Session | null
  setSession: (session: Session | null) => void
}

const Context = React.createContext<Context>({
  session: null,
  setSession: () => {},
})

export function Provider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Context['session']>(null)

  const ctx = React.useMemo(
    () => ({
      session,
      setSession,
    }),
    [session, setSession],
  )

  return <Context.Provider value={ctx}>{children}</Context.Provider>
}

export function useSession() {
  return React.useContext(Context)
}
