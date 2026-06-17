import { UseQueryResult, useQuery } from '@tanstack/react-query'
import {
  Query,
  Restricted,
  XrpcFailure,
  XrpcRequestParams,
  XrpcResponse,
  getMain,
} from '@atproto/lex'
import { useBskyClient } from '../providers/BskyClientProvider.tsx'

export function useLexQuery<S extends Query>(
  ns: NonNullable<unknown> extends XrpcRequestParams<S>
    ? S | { main: S }
    : Restricted<'This XRPC method requires a "params" argument'>,
): UseQueryResult<XrpcResponse<S>, XrpcFailure<S>>
export function useLexQuery<
  S extends Query,
  P extends false | XrpcRequestParams<S>,
>(
  ns: S | { main: S },
  params: P,
): UseQueryResult<P extends false ? null : XrpcResponse<S>, XrpcFailure<S>>
export function useLexQuery<S extends Query>(
  ns: S | { main: S },
  params: false | XrpcRequestParams<S> = {} as XrpcRequestParams<S>,
): UseQueryResult<null | XrpcResponse<S>, XrpcFailure<S>> {
  const schema = getMain(ns)
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
      if (result.success) return result.value
      throw result.reason
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
