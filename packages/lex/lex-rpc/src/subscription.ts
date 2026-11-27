import { decodeAll } from '@atproto/lex-cbor'
import type { LexValue } from '@atproto/lex-data'
import { isPlainObject } from '@atproto/lex-data'
import {
  type InferMethodMessage,
  type Main,
  type Restricted,
  type Subscription,
  type ValidationResult,
  getMain,
  lexErrorDataSchema,
} from '@atproto/lex-schema'
import {
  type WebSocketOptions,
  defaultShouldReconnect,
  websocket as wsClientWebsocket,
} from '@atproto/ws-client'
import {
  type Agent,
  type AgentConfig,
  type WebSocketFactory,
  type WebSocketHandler,
  type WebSocketHandlerOptions,
  buildAgent,
  isAgent,
} from './agent.js'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { type TransientError, isTransientError } from './errors.js'
import { isCausedBySignal } from './lib/abort.js'
import {
  XrpcSubscriptionConnectionError,
  XrpcSubscriptionError,
  XrpcSubscriptionFrameError,
  XrpcSubscriptionMessageError,
  XrpcSubscriptionParamsError,
  XrpcSubscriptionServerError,
  isRetryableSubscriptionError,
} from './subscription-errors.js'
import { type XrpcRequestParamsOptions, xrpcRequestUrl } from './xrpc.js'

// The errors of the connection itself, as `@atproto/ws-client` reports them to
// a factory's `shouldReconnect`, `onReconnect` and `onError` (alongside the
// subscription's own, from `./subscription-errors.js`). Re-exported so that
// they can be told apart without depending on `@atproto/ws-client` directly,
// which could resolve to another copy than this package's, failing every
// `instanceof` check.
export {
  BufferOverflowError,
  CloseCode,
  CloseError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  UnexpectedResponseError,
  WebSocketClientError,
  isReconnectableClose,
} from '@atproto/ws-client'

/**
 * The default reconnect policy of {@link createWebSocketFactory} (and so of
 * {@link defaultWebsocket}): `@atproto/ws-client`'s `defaultShouldReconnect()`
 * (the connection failures it classifies as transient), extended with the
 * transient failures of the subscription itself (see
 * {@link isRetryableSubscriptionError}). Combine it with your own conditions
 * in a custom `shouldReconnect`.
 *
 * @example Also catch up after being dropped for being too slow
 * ```typescript
 * const websocket = createWebSocketFactory({
 *   shouldReconnect: (err) =>
 *     defaultSubscriptionShouldReconnect(err) ||
 *     (err instanceof XrpcSubscriptionServerError &&
 *       err.error === 'ConsumerTooSlow'),
 * })
 * ```
 */
export function defaultSubscriptionShouldReconnect(err: unknown): boolean {
  return defaultShouldReconnect(err) || isRetryableSubscriptionError(err)
}

/**
 * Options of {@link createWebSocketFactory}: those of `@atproto/ws-client`'s
 * `websocket()` (`heartbeat`, `idleTimeoutMs`, `maxReconnectSeconds`,
 * `shouldReconnect`, the lifecycle hooks, …), except `signal` and `headers`,
 * which come from each subscription.
 */
export type WebSocketFactoryOptions = Omit<
  WebSocketOptions<'binary'>,
  'signal' | 'headers'
>

/**
 * Creates a {@link WebSocketFactory} over `@atproto/ws-client`, for
 * {@link AgentConfig.websocket}, with the given connection options. Each
 * connection receives binary frames (`dataMode: 'binary'`), with the `signal`
 * and `headers` of its subscription. `shouldReconnect` defaults to
 * {@link defaultSubscriptionShouldReconnect}: a custom one replaces it, so it
 * should also accept the errors that policy retries (or the transient error
 * frames of the subscription end the stream).
 *
 * @example
 * ```typescript
 * import { createWebSocketFactory, xrpcSubscribe } from '@atproto/lex-rpc/subscription'
 *
 * const websocket = createWebSocketFactory({ idleTimeoutMs: 60_000 })
 *
 * for await (const message of xrpcSubscribe(
 *   { service: 'https://relay.example.com', websocket },
 *   com.atproto.sync.subscribeRepos,
 * )) { ... }
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function createWebSocketFactory({
  shouldReconnect = defaultSubscriptionShouldReconnect,
  ...options
}: WebSocketFactoryOptions = {}): WebSocketFactory {
  return (url, { signal, headers }) =>
    wsClientWebsocket<'binary'>(url, {
      ...options,
      // Defaults
      shouldReconnect,
      // Overrides
      signal,
      headers,
      dataMode: 'binary',
    })
}

/**
 * The {@link WebSocketFactory} that {@link xrpcSubscribe} connects through when
 * given a service URL, or an {@link AgentConfig} without its own `websocket`:
 * {@link createWebSocketFactory} with the default options of
 * `@atproto/ws-client` (backoff, liveness), reconnecting per
 * {@link defaultSubscriptionShouldReconnect}. For other connection options,
 * create a factory of your own with {@link createWebSocketFactory}.
 *
 * @example
 * ```typescript
 * import { buildAgent } from '@atproto/lex-rpc'
 * import { defaultWebsocket } from '@atproto/lex-rpc/subscription'
 *
 * const agent = buildAgent({
 *   service: 'https://relay.example.com',
 *   websocket: defaultWebsocket,
 * })
 * ```
 */
export const defaultWebsocket: WebSocketFactory = createWebSocketFactory()

/**
 * The messages of an XRPC subscription, as an async generator: `for await`
 * over it and the stream spans reconnects. Ends on `break`, `throw`, or an
 * aborted {@link WebSocketHandlerOptions.signal signal} (which rejects with the
 * abort reason).
 *
 * @typeParam M - The subscription method type
 */
export type XrpcSubscriptionIterable<M extends Subscription = Subscription> =
  AsyncGenerator<InferMethodMessage<M>, void, unknown>

/**
 * Options for subscribing to an XRPC subscription, based on the method schema.
 * The type system ensures required params are provided.
 *
 * @typeParam M - The subscription method type
 */
export type XrpcSubscribeOptions<M extends Subscription = Subscription> =
  XrpcRequestParamsOptions<M> &
    Pick<WebSocketHandlerOptions, 'signal' | 'headers'> &
    Partial<ParseMessageOptions>

/**
 * Subscribes to an XRPC subscription (a WebSocket event stream), yielding its
 * messages validated against the method's message schema.
 *
 * The stream is opened on the first pull, through the agent's
 * {@link Agent.websocketHandler websocketHandler}, which owns the connection
 * (and its reconnects). A frame that fails to decode or validate is handed back
 * to it (see {@link WebSocketHandler}). Errors thrown while building its URL
 * (by a `params` function, or by invalid params) are wrapped in an
 * {@link XrpcSubscriptionParamsError}, and connection failures reported by the
 * handler as a {@link TransientError} in an
 * {@link XrpcSubscriptionConnectionError}. Other errors (an abort reason, …)
 * are passed through unchanged.
 *
 * @param agent - The {@link Agent} to subscribe through, or the service URL or
 * {@link AgentConfig} to build one with (see {@link buildAgent}), connecting
 * through {@link defaultWebsocket} unless the config sets its own
 * {@link AgentConfig.websocket websocket}
 * @param ns - The lexicon subscription definition
 * @param options - Subscription {@link XrpcSubscribeOptions options}
 * @throws {TypeError} if given an {@link Agent} without a `websocketHandler`
 *
 * @example
 * ```typescript
 * for await (const message of xrpcSubscribe(
 *   agent,
 *   com.atproto.sync.subscribeRepos,
 *   { params: () => ({ cursor }) },
 * )) {
 *   if (message.$type === 'com.atproto.sync.subscribeRepos#commit') {
 *     cursor = message.seq
 *   }
 * }
 * ```
 */
export function xrpcSubscribe<const M extends Subscription>(
  agent: Agent | AgentConfig | string | URL,
  ns: NonNullable<unknown> extends XrpcSubscribeOptions<M>
    ? Main<M>
    : Restricted<'This XRPC subscription requires an "options" argument'>,
): XrpcSubscriptionIterable<M>
export function xrpcSubscribe<const M extends Subscription>(
  agent: Agent | AgentConfig | string | URL,
  ns: Main<M>,
  options: XrpcSubscribeOptions<M>,
): XrpcSubscriptionIterable<M>
export function xrpcSubscribe<const M extends Subscription>(
  agentOpts: Agent | AgentConfig | string | URL,
  ns: Main<M>,
  options: XrpcSubscribeOptions<M> = {} as XrpcSubscribeOptions<M>,
): XrpcSubscriptionIterable<M> {
  // @NOTE using a distinct (non-generator) function so that errors thrown from
  // buildWebsocketHandler are thrown immediately rather than during iteration.
  const method = getMain(ns)
  const websocketHandler = buildWebsocketHandler(agentOpts)
  return consume(websocketHandler, method, options)
}

async function* consume<M extends Subscription>(
  websocketHandler: WebSocketHandler,
  method: M,
  options: XrpcSubscribeOptions<M>,
): XrpcSubscriptionIterable<M> {
  // @NOTE Build the parsing options object once
  const parseOptions: Readonly<ParseMessageOptions> = Object.freeze({
    validateResponse: options.validateResponse ?? true,
    strictResponseProcessing: options.strictResponseProcessing ?? true,
    onMessageError: options.onMessageError ?? thrower,
  })

  const { signal, headers } = options

  // Errors thrown while building the URL (e.g. by a `params` function) are the
  // caller's own: wrapped in an XrpcSubscriptionParamsError, so that they are
  // neither mistaken for connection failures, nor retried unless their cause
  // is transient. An abort reason is left as-is.
  const path = async () => {
    try {
      return await xrpcRequestUrl(method, options)
    } catch (cause) {
      if (isCausedBySignal(cause, signal)) throw cause
      throw new XrpcSubscriptionParamsError(method, cause)
    }
  }

  const iterable = websocketHandler(path, {
    // @NOTE We manually re-build the options here because the websocketHandler
    // is a user provider function that could parse other options that are not
    // part of the WebsocketHandler interface.
    signal,
    headers,
  })

  // Stepped by hand rather than with `for await`, which can only end the
  // stream: a frame that fails to parse is handed back to it with `throw()`,
  // which lets the handler end the connection that delivered it and decide
  // whether to reconnect (i.e. continue iterating by returning a next result),
  // like for any connection failure.
  const iterator = iterable[Symbol.asyncIterator]()
  try {
    let frameResult = await iterator.next()
    while (!frameResult.done) {
      let message: InferMethodMessage<M> | undefined
      try {
        message = parseFrame(method, frameResult.value, parseOptions)
      } catch (error) {
        if (!iterator.throw) throw error
        frameResult = await iterator.throw(error)
        continue
      }
      if (message !== undefined) yield message
      frameResult = await iterator.next()
    }
  } catch (error) {
    // An abort rejects with its reason as-is, which may itself be a handler
    // error (e.g. a ws-client `CloseError` chosen to set the close code).
    if (isCausedBySignal(error, signal)) throw error
    if (error instanceof XrpcSubscriptionError) throw error
    if (isTransientError(error)) {
      throw new XrpcSubscriptionConnectionError(method, error)
    }
    throw error
  } finally {
    // A consumer `break` or `throw()` at the `yield` above: close the stream,
    // as a `for await` would. A no-op once the stream has ended.
    await iterator.return?.()
  }
}

function buildWebsocketHandler(
  agentOpts: Agent | AgentConfig | string | URL,
): WebSocketHandler {
  const agent: Agent = isAgent(agentOpts)
    ? agentOpts
    : buildAgent(
        agentOpts instanceof URL || typeof agentOpts === 'string'
          ? { service: agentOpts, websocket: defaultWebsocket }
          : typeof agentOpts === 'object'
            ? {
                ...agentOpts,
                websocket: agentOpts.websocket ?? defaultWebsocket,
              }
            : // Not allowed by the types (e.g. a FetchHandler, from untyped
              // code): built as-is, without a websocketHandler.
              agentOpts,
      )

  const websocketHandler = agent.websocketHandler?.bind(agent)
  if (websocketHandler) return websocketHandler

  throw new TypeError(
    'The agent needs a websocketHandler to support XRPC subscriptions',
  )
}

// Frame header `op` values (https://atproto.com/specs/event-stream)
const MESSAGE_FRAME = 1
const ERROR_FRAME = -1

type ParseMessageOptions = {
  validateResponse: boolean
  strictResponseProcessing: boolean

  /**
   * Hook that allows ignoring messages from a valid frame that fail validation
   * according to the message schema.
   */
  onMessageError: (error: XrpcSubscriptionMessageError) => void
}

/**
 * Decodes an event stream frame (a CBOR header followed by a CBOR body) into
 * the message it carries, validated against the subscription's message schema
 * unless {@link ParseMessageOptions.validateResponse} is disabled. A message's
 * `$type` is restored from its header's `t` (a `#fragment` being relative to
 * the subscription's NSID).
 *
 * @returns `undefined` for a frame with an unknown `op`, which the event stream
 * specification requires clients to ignore. Unknown `t` values are left to the
 * message schema, which accepts them when it is an open union (as lexicon
 * unions are by default).
 * @throws {XrpcSubscriptionFrameError} for invalid framing, which the
 * specification requires to drop the connection: undecodable CBOR, an invalid
 * header, or a message (`op: 1`) or error (`op: -1`) frame that does not carry
 * exactly one body. Frames with an unknown `op` are not decoded past their
 * header, so that a future frame type is not bound to the current layout (e.g.
 * carrying several messages, or none): only their header must be valid.
 * @throws {XrpcSubscriptionServerError} for an error frame.
 * @throws {XrpcSubscriptionMessageError} for a message not matching the
 * message schema.
 * @see {@link https://atproto.com/specs/event-stream AT Protocol Event Stream Specification}
 */
function parseFrame<M extends Subscription>(
  method: M,
  frame: Uint8Array,
  options: ParseMessageOptions,
): undefined | InferMethodMessage<M> {
  // /!\ HOT PATH - this function is called for every incoming message frame, so
  // it should be optimized for performance.

  // Decoded lazily, one value at a time, since the number of values following
  // the header depends on its `op`.
  const values = decodeAll(frame)

  const header = decodeNext(method, values).value
  if (!isBaseHeader(header)) {
    throw new XrpcSubscriptionFrameError(method, 'Invalid header')
  }

  if (header.op === MESSAGE_FRAME) {
    const body = decodeNext(method, values).value
    if (!isPlainObject(body) || !decodeNext(method, values).done) {
      throw new XrpcSubscriptionFrameError(
        method,
        'Expected an object body with no extra data',
      )
    }

    const { t } = header
    if (t === undefined) {
      // noop
    } else if (typeof t !== 'string' || t.length === 0) {
      throw new XrpcSubscriptionFrameError(
        method,
        `Invalid header t value: ${typeof t}`,
      )
    } else {
      // The decoded body is not shared with anyone, so the $type is set in
      // place rather than by copying the (potentially large) message.
      body.$type = t.charCodeAt(0) === 0x23 /* # */ ? `${method.nsid}${t}` : t
    }

    if (!options.validateResponse) {
      return body as InferMethodMessage<M>
    }

    // @NOTE method.message should be an open union (it is built like that by
    // lex-builder), which would result in the message being validated as a
    // Unknown$TypedObject (that can be ignored, or not, by the consumer)
    const result = method.message.safeParse(body, {
      strict: options.strictResponseProcessing,
    }) as ValidationResult<InferMethodMessage<M>>

    if (result.success) return result.value

    const error = new XrpcSubscriptionMessageError(method, body, result.reason)

    // @NOTE Throws by default
    options.onMessageError(error)

    return undefined // skip the message
  } else if (header.op === ERROR_FRAME) {
    // @NOTE Checked regardless of `validateResponse`: the error frame's body
    // is part of the framing, which the error below relies on.
    const body = decodeNext(method, values).value
    if (!lexErrorDataSchema.matches(body) || !decodeNext(method, values).done) {
      throw new XrpcSubscriptionFrameError(method, 'Invalid error frame')
    }

    // Error frame close the subscription with an error, which is why we don't
    // provide a hook to handle (and ignore) error frames.
    throw new XrpcSubscriptionServerError(method, body)
  } else {
    // Unknown op codes are ignored without decoding past their header.
    return undefined
  }
}

/**
 * Decodes the next value of a frame.
 *
 * @throws {XrpcSubscriptionFrameError} if it is not valid CBOR.
 */
function decodeNext<M extends Subscription>(
  method: M,
  values: Iterator<LexValue, void, unknown>,
): IteratorResult<LexValue, void> {
  try {
    return values.next()
  } catch (cause) {
    throw new XrpcSubscriptionFrameError(method, 'Undecodable CBOR', { cause })
  }
}

interface BaseHeader {
  op: number
  [key: string]: unknown
}
function isBaseHeader(header: unknown): header is BaseHeader {
  return isPlainObject(header) && Number.isInteger(header.op)
}

function thrower(err: Error) {
  throw err
}
