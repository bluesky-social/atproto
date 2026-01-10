import { UseQueryResult, useQuery } from '@tanstack/react-query'
import {
  InferMethodParams,
  LexRpcFailure,
  LexRpcResponse,
  Query,
  Restricted,
} from '@atproto/lex'
import { useBskyClient } from '../providers/BskyClientProvider.tsx'

export function useLexQuery<S extends Query>(
  ns: NonNullable<unknown> extends InferMethodParams<S>
    ? S | { main: S }
    : Restricted<'This XRPC method requires a "params" argument'>,
): UseQueryResult<LexRpcResponse<S>, LexRpcFailure<S>>
export function useLexQuery<
  S extends Query,
  P extends false | InferMethodParams<S>,
>(
  ns: S | { main: S },
  params: P,
): UseQueryResult<P extends false ? null : LexRpcResponse<S>, LexRpcFailure<S>>
export function useLexQuery<S extends Query>(
  ns: S | { main: S },
  params: false | InferMethodParams<S> = {} as InferMethodParams<S>,
): UseQueryResult<null | LexRpcResponse<S>, LexRpcFailure<S>> {
  const schema = 'main' in ns ? ns.main : ns
  const client = useBskyClient()

  const queryString =
    params === false
      ? params
      : schema.parameters.toURLSearchParams(params).toString()

  return useQuery({
    queryKey: [client.did, schema.nsid, queryString],
    queryFn: async ({ signal }) => {
      if (params === false) return null
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
