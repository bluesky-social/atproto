import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from '@tanstack/react-query'
import {
  type Client,
  type Main,
  type Query,
  type Restricted,
  type XrpcFailure,
  type XrpcRequestParams,
  type XrpcResponse,
  getMain,
} from '@atproto/lex'

export type UseLexQueryKey = [
  did: string | null,
  nsid: string,
  queryString: null | string,
]

export type UseLexQueryOptions<S extends Query> = Omit<
  UseQueryOptions<XrpcResponse<S>, XrpcFailure<S>>,
  'queryKey' | 'queryFn' | 'retry' | 'retryDelay'
>

export type UseLexQueryResult<S extends Query> = UseQueryResult<
  XrpcResponse<S>,
  XrpcFailure<S>
>

export function useLexQuery<S extends Query>(
  client: Client,
  ns: NonNullable<unknown> extends XrpcRequestParams<S>
    ? Main<S>
    : Restricted<'This XRPC method requires a "params" argument'>,
): UseLexQueryResult<S>
export function useLexQuery<S extends Query>(
  client: Client,
  ns: Main<S>,
  params: false | XrpcRequestParams<S>,
  options?: UseLexQueryOptions<S>,
): UseLexQueryResult<S>
export function useLexQuery<S extends Query>(
  client: Client,
  ns: Main<S>,
  params: false | XrpcRequestParams<S> = {} as XrpcRequestParams<S>,
  options?: UseLexQueryOptions<S>,
): UseLexQueryResult<S> {
  const schema = getMain(ns)

  const queryString =
    params === false
      ? null
      : schema.parameters.toURLSearchParams(params).toString()

  return useQuery({
    ...options,
    enabled: params === false ? false : options?.enabled,
    queryKey: [client.did ?? null, schema.nsid, queryString],
    queryFn: async ({ signal }) => {
      return client.xrpc(schema, { signal, params } as any)
    },
    retry: () => false, // Performed by client.xrpc()
  })
}
