import { useDeviceSessionsQuery } from '#/data/useDeviceSessionsQuery'
import { Route as AccountRoute } from '#/routes/_appLayout/$did'

export function useCurrentSession() {
  const { data: accounts } = useDeviceSessionsQuery()
  const { did } = AccountRoute.useParams()
  const current = accounts?.find(({ account }) => account.sub === did)

  if (!current) {
    throw new Error(
      `No current account available. Are you sure you're using this hook in the right context?`,
    )
  }

  return current
}
