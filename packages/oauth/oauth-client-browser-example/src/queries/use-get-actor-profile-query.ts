import { useQuery } from '@tanstack/react-query'
import * as app from '../lexicons/app.ts'
import { useAuthenticatedBskyClient } from '../providers/BskyClientProvider.tsx'

export function useGetActorProfileQuery() {
  const client = useAuthenticatedBskyClient()

  return useQuery({
    queryKey: ['profile', client.did],
    queryFn: async ({ signal }) => {
      return client.get(app.bsky.actor.profile, { signal })
    },
  })
}
