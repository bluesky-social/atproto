import { useQuery } from '@tanstack/react-query'
import { type BlobRef, type Client, getBlobCidString } from '@atproto/lex'

export function useGetBlob(
  client: Client,
  ref: BlobRef | null | undefined,
  did = client.did,
) {
  const cid = ref ? getBlobCidString(ref) : null

  return useQuery({
    queryKey: ['getBlob', cid],
    enabled: !!did && !!cid,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    refetchInterval: false,
    queryFn: async () => {
      const { body, encoding } = await client.getBlob(did!, cid!)
      return new Blob([body], { type: encoding })
    },
  })
}
