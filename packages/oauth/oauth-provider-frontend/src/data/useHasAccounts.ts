import { useAccountsQuery } from '#/data/useAccountsQuery'

export function useHasAccounts() {
  const { data: accounts } = useAccountsQuery()
  return accounts?.length > 0
}
