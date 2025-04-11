import { useDeviceSessionsQuery } from '#/data/useDeviceSessionsQuery'
import { Route as AccountRoute } from '#/routes/account/_appLayout/$sub'

export function useCurrentSession() {
  const { data: sessions } = useDeviceSessionsQuery()
  const { sub } = AccountRoute.useParams()
  const current = sessions?.find(({ account }) => account.sub === sub)

  if (!current) {
    throw new Error(
      `No current account available. Are you sure you're using this hook in the right context?`,
    )
  }

  return current
}
