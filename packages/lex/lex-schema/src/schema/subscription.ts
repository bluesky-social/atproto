import { LexValue } from '@atproto/lex-data'
import { Infer, NsidString, Schema } from '../core.js'
import { ParamsSchema } from './params.js'

/**
 * Infers the parameters type from a Subscription definition.
 *
 * @template S - The Subscription type
 */
export type InferSubscriptionParameters<S extends Subscription> = Infer<
  S['parameters']
>

/**
 * Infers the message type from a Subscription definition.
 *
 * @template S - The Subscription type
 */
export type InferSubscriptionMessage<S extends Subscription> = Infer<
  S['message']
>

/**
 * Represents a Lexicon subscription (WebSocket) endpoint definition.
 *
 * Subscriptions are real-time event streams delivered over WebSocket.
 * They have parameters for initializing the connection and a message
 * schema for validating incoming events.
 *
 * @template TNsid - The NSID identifying this subscription
 * @template TParameters - The connection parameters schema type
 * @template TMessage - The message schema type
 * @template TErrors - Array of error type strings, or undefined
 *
 * @example
 * ```ts
 * const firehose = new Subscription(
 *   'com.atproto.sync.subscribeRepos',
 *   l.params({ cursor: l.optional(l.integer()) }),
 *   repoEventSchema,
 *   ['FutureCursor']
 * )
 * ```
 */
export class Subscription<
  const TNsid extends NsidString = NsidString,
  const TParameters extends ParamsSchema = ParamsSchema,
  const TMessage extends Schema<LexValue> = Schema<LexValue>,
  const TErrors extends undefined | readonly string[] =
    | undefined
    | readonly string[],
> {
  readonly type = 'subscription' as const

  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly message: TMessage,
    readonly errors: TErrors,
  ) {}
}

/**
 * Creates a subscription definition for a Lexicon WebSocket endpoint.
 *
 * Subscriptions enable real-time event streaming. The connection is
 * initialized with parameters, and the server sends messages matching
 * the message schema.
 *
 * @param nsid - The NSID identifying this subscription endpoint
 * @param parameters - Schema for connection parameters
 * @param message - Schema for validating incoming messages
 * @param errors - Optional array of error type strings
 * @returns A new {@link Subscription} instance
 *
 * @example
 * ```ts
 * // Repository event stream
 * const subscribeRepos = l.subscription(
 *   'com.atproto.sync.subscribeRepos',
 *   l.params({
 *     cursor: l.optional(l.integer()),
 *   }),
 *   l.typedUnion([
 *     l.typedRef(() => commitEventSchema),
 *     l.typedRef(() => handleEventSchema),
 *     l.typedRef(() => identityEventSchema),
 *   ], false),
 *   ['FutureCursor', 'ConsumerTooSlow'],
 * )
 *
 * // Label stream
 * const subscribeLabels = l.subscription(
 *   'com.atproto.label.subscribeLabels',
 *   l.params({ cursor: l.optional(l.integer()) }),
 *   labelEventSchema,
 * )
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function subscription<
  const N extends NsidString,
  const P extends ParamsSchema,
  const M extends Schema<LexValue>,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, message: M, errors: E = undefined as E) {
  return new Subscription<N, P, M, E>(nsid, parameters, message, errors)
}
