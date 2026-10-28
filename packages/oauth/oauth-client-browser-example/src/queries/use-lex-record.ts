import { type UseQueryResult, useQuery } from '@tanstack/react-query'
import {
  type Client,
  type GetOptions,
  type GetOutput,
  type Main,
  type RecordSchema,
  type Restricted,
  XrpcError,
  getMain,
  rkeyFor,
} from '@atproto/lex'

const QUERY_KEY_PREFIX = 'lex-record'
type LexRecordKey = readonly [
  typeof QUERY_KEY_PREFIX,
  string | null,
  string,
  string | null,
  string,
]

export function getLexRecordKey<S extends RecordSchema>(
  client: Client,
  ns: NonNullable<unknown> extends GetOptions<S>
    ? Main<S>
    : Restricted<'This record schema requires an "rkey"'>,
): LexRecordKey
export function getLexRecordKey<S extends RecordSchema>(
  client: Client,
  ns: Main<S>,
  options: GetOptions<S>,
): LexRecordKey
export function getLexRecordKey<S extends RecordSchema>(
  client: Client,
  ns: Main<S>,
  options: GetOptions<S> = {} as GetOptions<S>,
): LexRecordKey {
  const schema = getMain(ns)
  const rkey = rkeyFor(schema, options.rkey)
  return [
    QUERY_KEY_PREFIX,
    client.did ?? null,
    schema.$type,
    options.repo ?? null,
    rkey,
  ]
}

export function useLexRecord<S extends RecordSchema>(
  client: Client,
  ns: NonNullable<unknown> extends GetOptions<S>
    ? Main<S>
    : Restricted<'This record schema requires an "rkey"'>,
): UseQueryResult<GetOutput<S>>
export function useLexRecord<S extends RecordSchema>(
  client: Client,
  ns: Main<S>,
  options: GetOptions<S>,
): UseQueryResult<GetOutput<S>>
export function useLexRecord<S extends RecordSchema>(
  client: Client,
  ns: Main<S>,
  options: GetOptions<S> = {} as GetOptions<S>,
): UseQueryResult<GetOutput<S>> {
  const schema = getMain(ns)

  return useQuery({
    queryKey: getLexRecordKey(client, ns, options),
    queryFn: async ({ signal }) => {
      return client.get(schema, { ...options, signal })
    },
    retry: (failureCount, error) => {
      if (failureCount > 10) return false
      return error instanceof XrpcError && error.shouldRetry()
    },
    retryDelay: (attemptIndex) => {
      return Math.min(1000 * 2 ** attemptIndex, 30000)
    },
  })
}
