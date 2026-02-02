import { NsidString } from '../core.js'
import { ParamsSchema } from './params.js'
import { Payload } from './payload.js'

/**
 * Represents a Lexicon procedure (HTTP POST) endpoint definition.
 *
 * Procedures are operations that may modify state on the server.
 * They have parameters, an input payload (request body), an output
 * payload (response body), and optional error types.
 *
 * @template TNsid - The NSID identifying this procedure
 * @template TParameters - The parameters schema type
 * @template TInputPayload - The request body payload type
 * @template TOutputPayload - The response body payload type
 * @template TErrors - Array of error type strings, or undefined
 *
 * @example
 * ```ts
 * const createPost = new Procedure(
 *   'app.bsky.feed.post',
 *   l.params({}),
 *   l.jsonPayload({ text: l.string() }),
 *   l.jsonPayload({ uri: l.string(), cid: l.string() }),
 *   ['InvalidRecord']
 * )
 * ```
 */
export class Procedure<
  const TNsid extends NsidString = NsidString,
  const TParameters extends ParamsSchema = ParamsSchema,
  const TInputPayload extends Payload = Payload,
  const TOutputPayload extends Payload = Payload,
  const TErrors extends undefined | readonly string[] =
    | undefined
    | readonly string[],
> {
  readonly type = 'procedure' as const

  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly input: TInputPayload,
    readonly output: TOutputPayload,
    readonly errors: TErrors,
  ) {}
}

/**
 * Creates a procedure definition for a Lexicon POST endpoint.
 *
 * Procedures can modify server state. They accept both URL parameters
 * and a request body (input payload).
 *
 * @param nsid - The NSID identifying this procedure endpoint
 * @param parameters - Schema for URL query parameters
 * @param input - Schema for request body payload
 * @param output - Schema for response body payload
 * @param errors - Optional array of error type strings
 * @returns A new {@link Procedure} instance
 *
 * @example
 * ```ts
 * // Create record procedure
 * const createRecord = l.procedure(
 *   'com.atproto.repo.createRecord',
 *   l.params({}),
 *   l.jsonPayload({
 *     repo: l.string({ format: 'at-identifier' }),
 *     collection: l.string({ format: 'nsid' }),
 *     record: l.unknown(),
 *   }),
 *   l.jsonPayload({
 *     uri: l.string({ format: 'at-uri' }),
 *     cid: l.string({ format: 'cid' }),
 *   }),
 *   ['InvalidRecord', 'RepoNotFound'],
 * )
 *
 * // Procedure with binary input
 * const uploadBlob = l.procedure(
 *   'com.atproto.repo.uploadBlob',
 *   l.params({}),
 *   l.payload('*\/*', undefined), // Accept any content type
 *   l.jsonPayload({ blob: l.blob() }),
 * )
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function procedure<
  const N extends NsidString,
  const P extends ParamsSchema,
  const I extends Payload,
  const O extends Payload,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, input: I, output: O, errors: E = undefined as E) {
  return new Procedure<N, P, I, O, E>(nsid, parameters, input, output, errors)
}
