import { useQuery } from '@tanstack/react-query'
import { useBskyClient } from '../lib/use-bsky-client.ts'

export function useGetSessionQuery() {
  const client = useBskyClient()

  return useQuery({
    queryKey: ['session', client.assertDid],
    queryFn: async () => {
      const { data } = await client.com.atproto.server.getSession()
      return data
    },
  })
}
