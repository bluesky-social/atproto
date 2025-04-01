import { Route as AccountRoute } from '#/routes/_appLayout/$did'
import { useAccountsQuery } from '#/data/useAccountsQuery'

export function useCurrentAccount() {
  const { data: accounts } = useAccountsQuery()
  const { did } = AccountRoute.useParams()
  const currentAccount =
    accounts?.find((account) => account.sub === did) ?? null

  if (!currentAccount) {
    throw new Error(
      `No current account available. Are you sure you're using this hook in the right context?`,
    )
  }

  return { currentAccount }
}
