import { useDeviceSessionsQuery } from '#/data/useDeviceSessionsQuery'

export function useHasAccounts() {
  const { data: accounts } = useDeviceSessionsQuery()
  return accounts?.length > 0
}
