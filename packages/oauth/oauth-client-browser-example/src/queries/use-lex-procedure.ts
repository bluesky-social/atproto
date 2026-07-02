import {
  UseMutationOptions,
  UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import {
  Client,
  InferMethodInputBody,
  InferMethodOutputBody,
  Main,
  Procedure,
  XrpcFailure,
  getMain,
} from '@atproto/lex'

export function useLexProcedure<T extends Procedure>(
  client: Client,
  ns: Main<T>,
  options?: Omit<
    UseMutationOptions<
      InferMethodOutputBody<T, Uint8Array>,
      XrpcFailure<T>,
      InferMethodInputBody<T, Uint8Array>
    >,
    'mutationFn'
  >,
): UseMutationResult<
  InferMethodOutputBody<T, Uint8Array>,
  XrpcFailure<T>,
  InferMethodInputBody<T, Uint8Array>
> {
  const schema = getMain(ns)

  return useMutation({
    ...options,
    mutationFn: async (body) => {
      const response = await client.xrpc(schema, { body } as any)
      return response.body as any
    },
  })
}
