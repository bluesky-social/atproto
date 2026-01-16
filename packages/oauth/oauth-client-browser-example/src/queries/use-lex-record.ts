import { UseQueryResult, useQuery } from '@tanstack/react-query'
import {
  GetOptions,
  GetOutput,
  XrpcResponseError,
  XrpcUnexpectedError,
  l,
} from '@atproto/lex'
import { useBskyClient } from '../providers/BskyClientProvider.tsx'

export function useLexRecord<S extends l.RecordSchema>(
  ns: NonNullable<unknown> extends GetOptions<S>
    ? S | { main: S }
    : l.Restricted<'This record schema requires a "rkey" argument'>,
): UseQueryResult<GetOutput<S>>
export function useLexRecord<S extends l.RecordSchema>(
  ns: S | { main: S },
  options: GetOptions<S>,
): UseQueryResult<GetOutput<S>>
export function useLexRecord<S extends l.RecordSchema>(
  ns: S | { main: S },
  options: GetOptions<S> = {} as GetOptions<S>,
): UseQueryResult<GetOutput<S>> {
  const schema = 'main' in ns ? ns.main : ns
  const client = useBskyClient()

  return useQuery({
    queryKey: [
      options?.repo ?? client.did ?? null,
      schema.$type,
      options.rkey ?? null,
    ],
    queryFn: async ({ signal }) => {
      return client.get(schema, { ...options, signal })
    },
    retry: (failureCount, error) => {
      if (failureCount > 10) return false
      return (
        (error instanceof XrpcUnexpectedError ||
          error instanceof XrpcResponseError) &&
        error.shouldRetry()
      )
    },
    retryDelay: (attemptIndex) => {
      return Math.min(1000 * 2 ** attemptIndex, 30000)
    },
  })
}
