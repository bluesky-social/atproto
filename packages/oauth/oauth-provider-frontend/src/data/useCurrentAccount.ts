import React from 'react'

import { Route as AccountRoute } from '#/routes/_appLayout/$did'
import { useAccountsQuery } from '#/data/useAccountsQuery'

export function useCurrentAccount() {
  const { data: accounts } = useAccountsQuery()
  const { did } = AccountRoute.useParams()

  return React.useMemo(() => {
    return {
      currentAccount: accounts?.find((account) => account.sub === did) ?? null,
    }
  }, [accounts, did])
}
