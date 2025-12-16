import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { XrpcFailure, XrpcResponse, l } from '@atproto/lex'
import { useBskyClient } from '../providers/BskyClientProvider.tsx'

export function useAtprotoQuery<S extends l.Query>(
  ns: NonNullable<unknown> extends l.InferMethodParams<S>
    ? S | { main: S }
    : l.Restricted<'This XRPC method requires a "params" argument'>,
): UseQueryResult<XrpcResponse<S>, XrpcFailure<S>>
export function useAtprotoQuery<S extends l.Query>(
  ns: S | { main: S },
  params: l.InferMethodParams<S>,
): UseQueryResult<XrpcResponse<S>, XrpcFailure<S>>
export function useAtprotoQuery<S extends l.Query>(
  ns: S | { main: S },
  params: l.InferMethodParams<S> = {} as l.InferMethodParams<S>,
): UseQueryResult<XrpcResponse<S>, XrpcFailure<S>> {
  const schema = 'main' in ns ? ns.main : ns
  const client = useBskyClient()

  const queryString = schema.parameters.toURLSearchParams(params).toString()

  return useQuery({
    queryKey: [client.did, schema.nsid, queryString],
    queryFn: async ({ signal }) => {
      const result = await client.xrpcSafe(schema, { signal, params } as any)
      if (result.success) return result
      throw result
    },
    retry: (failureCount, error) => {
      if (failureCount > 10) return false
      return error.shouldRetry()
    },
    retryDelay: (attemptIndex) => {
      return Math.min(1000 * 2 ** attemptIndex, 30000)
    },
  })
}
