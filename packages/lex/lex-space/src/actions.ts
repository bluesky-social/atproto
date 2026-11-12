import type {
  ActionOptions,
  Client,
  XrpcRequestParams,
  XrpcResponseBody,
} from '@atproto/lex-client'
import { main as listSpacesQuery } from './lexicons/com/atproto/space/listSpaces.js'

export type ListSpacesParams = XrpcRequestParams<typeof listSpacesQuery>
export type ListSpacesOutput = XrpcResponseBody<typeof listSpacesQuery>

/**
 * Lists the spaces the user holds a repo in, or is the authority of.
 *
 * @example
 * ```typescript
 * const { spaces, cursor } = await client.call(listSpaces, { limit: 50 })
 *
 * // Only the spaces the user is the authority of
 * const { spaces } = await client.call(listSpaces, { spaceDid: client.did })
 * ```
 */
export async function listSpaces(
  client: Client,
  params?: ListSpacesParams,
  options?: ActionOptions,
): Promise<ListSpacesOutput> {
  return client.call(listSpacesQuery, params ?? {}, {
    ...options,
    service: null,
    labelers: null,
  })
}
