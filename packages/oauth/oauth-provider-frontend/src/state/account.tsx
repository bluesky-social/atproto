import React from 'react'

import { Session } from '#/api'
import { useAccountsQuery } from '#/data/useAccountsQuery'
import * as storage from '#/storage'

type Context = {
  currentAccountDid: string | null
  setCurrentAccountDid: (nextCurrentAccountDid: string | null) => void
}

const Context = React.createContext<Context>({
  currentAccountDid: null,
  setCurrentAccountDid: () => {},
})

export function Provider({ children }: { children: React.ReactNode }) {
  const [currentAccountDid, setCurrentAccountDid] = React.useState<
    Context['currentAccountDid']
  >(() => {
    return storage.get('prevCurrentAccountDid')
  })

  const wrappedSetCurrentAccountDid = React.useCallback(
    (nextCurrentAccountDid: string | null) => {
      storage.set('prevCurrentAccountDid', nextCurrentAccountDid ?? null)
      setCurrentAccountDid(nextCurrentAccountDid)
    },
    [setCurrentAccountDid],
  )

  const ctx = React.useMemo(
    () => ({
      currentAccountDid,
      setCurrentAccountDid: wrappedSetCurrentAccountDid,
    }),
    [currentAccountDid, wrappedSetCurrentAccountDid],
  )

  return <Context.Provider value={ctx}>{children}</Context.Provider>
}

export function useCurrentAccount() {
  const { data: accounts } = useAccountsQuery()
  const { currentAccountDid, setCurrentAccountDid } = React.useContext(Context)
  return React.useMemo(() => {
    return {
      currentAccount:
        accounts?.find((account) => account.did === currentAccountDid) ?? null,
      setCurrentAccount(account: Session | null) {
        setCurrentAccountDid(account?.did ?? null)
      },
    }
  }, [accounts, currentAccountDid, setCurrentAccountDid])
}
