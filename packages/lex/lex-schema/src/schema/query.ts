import { NsidString } from '../core.js'
import { ParamsSchema } from './params.js'
import { Payload } from './payload.js'

/**
 * Represents a Lexicon query (HTTP GET) endpoint definition.
 *
 * Queries are read-only operations that retrieve data from a server.
 * They have parameters (passed as URL query parameters), an output
 * payload, and optional error types.
 *
 * @template TNsid - The NSID identifying this query
 * @template TParameters - The parameters schema type
 * @template TOutputPayload - The output payload type
 * @template TErrors - Array of error type strings, or undefined
 *
 * @example
 * ```ts
 * const getPostQuery = new Query(
 *   'app.bsky.feed.getPost',
 *   l.params({ uri: l.string({ format: 'at-uri' }) }),
 *   l.payload('application/json', postSchema),
 *   ['NotFound']
 * )
 * ```
 */
export class Query<
  const TNsid extends NsidString = NsidString,
  const TParameters extends ParamsSchema = ParamsSchema,
  const TOutputPayload extends Payload = Payload,
  const TErrors extends undefined | readonly string[] =
    | undefined
    | readonly string[],
> {
  readonly type = 'query' as const

  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly output: TOutputPayload,
    readonly errors: TErrors,
  ) {}
}

/**
 * Creates a query definition for a Lexicon GET endpoint.
 *
 * Queries retrieve data without side effects. Parameters are sent as
 * URL query string parameters.
 *
 * @param nsid - The NSID identifying this query endpoint
 * @param parameters - Schema for URL query parameters
 * @param output - Expected response payload schema
 * @param errors - Optional array of error type strings
 * @returns A new {@link Query} instance
 *
 * @example
 * ```ts
 * // Simple query with JSON output
 * const getProfile = l.query(
 *   'app.bsky.actor.getProfile',
 *   l.params({ actor: l.string({ format: 'at-identifier' }) }),
 *   l.jsonPayload({ displayName: l.string(), handle: l.string() }),
 * )
 *
 * // Query with pagination and errors
 * const getTimeline = l.query(
 *   'app.bsky.feed.getTimeline',
 *   l.params({
 *     limit: l.optional(l.integer({ minimum: 1, maximum: 100 })),
 *     cursor: l.optional(l.string()),
 *   }),
 *   l.jsonPayload({ feed: l.array(feedItemSchema), cursor: l.optional(l.string()) }),
 *   ['BlockedActor', 'BlockedByActor'],
 * )
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function query<
  const N extends NsidString,
  const P extends ParamsSchema,
  const O extends Payload,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, output: O, errors: E = undefined as E) {
  return new Query<N, P, O, E>(nsid, parameters, output, errors)
}
