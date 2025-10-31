import { useQuery } from '@tanstack/react-query'
import { useBskyClient } from '../lib/use-bsky-client.ts'

export function useGetActorProfileQuery() {
  const client = useBskyClient()

  return useQuery({
    queryKey: ['profile', client.assertDid],
    queryFn: async () => {
      if (!client) return null
      const { data } = await client.com.atproto.repo.getRecord({
        repo: client.assertDid,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
      })
      return data
    },
  })
}
