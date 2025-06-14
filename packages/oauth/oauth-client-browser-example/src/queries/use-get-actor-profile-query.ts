import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '../auth/auth-provider.tsx'

export function useGetActorProfileQuery() {
  const { agent } = useAuthContext()

  return useQuery({
    queryKey: ['profile', agent?.assertDid ?? null],
    queryFn: async () => {
      if (!agent) return null
      const { data } = await agent.com.atproto.repo.getRecord({
        repo: agent.assertDid,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
      })
      return data
    },
  })
}
