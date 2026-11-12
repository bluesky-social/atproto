import {
  type XrpcSubscribeOptions,
  type XrpcSubscribeUrl,
  type XrpcSubscriptionIterable,
  xrpcSubscribe,
} from '@atproto/lex-rpc'
import { main as subscribeReposSchema } from './lexicons/com/atproto/sync/subscribeRepos.defs.js'

/**
 * Options for subscribing to a repository event stream (firehose).
 *
 * @see {@link subscribeRepos}
 */
export type SubscribeReposOptions = Omit<
  XrpcSubscribeOptions<typeof subscribeReposSchema>,
  'params'
> & {
  /**
   * Where to start the stream from (the last `seq` already processed), or
   * `undefined` to start from the live tip.
   *
   * A value is only the starting point: from then on the cursor follows the
   * `seq` of each yielded message, so a reconnect resumes right after the last
   * message handed to the consumer. A function is instead called before every
   * connection, and nothing is tracked: use it when the consumer persists its
   * own cursor (e.g. once a message has been processed).
   */
  cursor?: number | (() => number | Promise<number>)
}

/**
 * Subscribes to the repository event stream (firehose) of a service (a PDS or
 * a relay), resuming from the last received `seq` across reconnects.
 *
 * @param url - The service URL, or a function returning it (see {@link XrpcSubscribeUrl})
 * @param options - Subscription options, including the starting {@link SubscribeReposOptions.cursor cursor}
 * @returns An async generator of `com.atproto.sync.subscribeRepos` messages
 *
 * @example
 * ```typescript
 * const url = new URL('https://relay.example.com')
 * for await (const message of subscribeRepos(url, { cursor })) {
 *   if (message.$type === 'com.atproto.sync.subscribeRepos#commit') {
 *     console.log(message.repo, message.ops)
 *   }
 * }
 * ```
 *
 * @see {@link xrpcSubscribe} for the generic variant
 */
export async function* subscribeRepos(
  url: XrpcSubscribeUrl,
  { cursor: cursorInput, ...options }: SubscribeReposOptions = {},
): XrpcSubscriptionIterable<typeof subscribeReposSchema> {
  if (typeof cursorInput === 'function') {
    return yield* xrpcSubscribe(url, subscribeReposSchema, {
      ...options,
      params: async () => ({ cursor: await cursorInput() }),
    })
  }

  let cursor: number | undefined = cursorInput
  for await (const message of xrpcSubscribe(url, subscribeReposSchema, {
    ...options,
    params: () => ({ cursor }),
  })) {
    if ('seq' in message) cursor = message.seq
    yield message
  }
}
