import { decodeAll } from '@atproto/lex-cbor'
import type { LexErrorData, LexValue } from '@atproto/lex-data'
import { isPlainObject } from '@atproto/lex-data'
import {
  type InferMethodMessage,
  type Main,
  type Params,
  type Restricted,
  type Subscription,
  getMain,
  lexErrorDataSchema,
} from '@atproto/lex-schema'
import {
  WebSocketClientError,
  type WebSocketOptions,
  websocket,
} from '@atproto/ws-client'
import { type Agent, type AgentOptions, buildAgent } from './agent.js'
import type { XrpcResponseOptions } from './response.js'
import {
  XrpcSubscriptionConnectionError,
  XrpcSubscriptionError,
  XrpcSubscriptionInvalidMessageError,
  XrpcSubscriptionServerError,
  XrpcSubscriptionValidationError,
} from './subscription-errors.js'
import {
  type XrpcRequestParams,
  type XrpcRequestParamsInit,
  type XrpcRequestParamsOptions,
  xrpcRequestUrl,
} from './xrpc.js'

/**
 * The messages of an XRPC subscription, as an async generator: `for await`
 * over it and the stream spans reconnects. Ends on `break`, `throw`, or an
 * aborted {@link XrpcSubscribeWebSocketOptions.signal signal} (which rejects
 * with the abort reason).
 *
 * @typeParam M - The subscription method type
 */
export type XrpcSubscriptionIterable<M extends Subscription = Subscription> =
  AsyncGenerator<InferMethodMessage<M>, void, unknown>

/**
 * How the messages of a subscription are processed.
 *
 * @see {@link XrpcResponseOptions.validateResponse} - Disabling validation
 * yields the decoded messages as-is: defaults are not applied, so the values
 * may not match their inferred type. Only do this for a trusted server.
 * @see {@link XrpcResponseOptions.strictResponseProcessing} - Relaxes schema
 * validation. CBOR decoding is always strict.
 */
export type XrpcSubscribeMessageOptions<M extends Subscription = Subscription> =
  XrpcResponseOptions & {
    /**
     * Called with every message that does not match the subscription's message
     * schema (only when {@link XrpcResponseOptions.validateResponse} is enabled).
     * Returning skips the message; throwing ends the connection that delivered it
     * and the error goes through {@link XrpcSubscribeWebSocketOptions.shouldReconnect}.
     *
     * @default (error) => { throw error }
     */
    onInvalidMessage?: (error: XrpcSubscriptionValidationError<M>) => void
  }

/**
 * The connection options of a subscription. They are those of
 * `@atproto/ws-client`'s `websocket()` (heartbeat, idle timeout, flow control,
 * backoff, lifecycle hooks, …), except that frames are always binary, the
 * stream is receive-only, and every error that reaches a hook or the iterator
 * is an {@link XrpcSubscriptionError} — connection failures included, as
 * {@link XrpcSubscriptionConnectionError} — or, for an abort, the signal's
 * reason. Errors thrown by the caller's own callbacks are passed through
 * unchanged.
 */
export type XrpcSubscribeWebSocketOptions = Omit<
  WebSocketOptions<'binary'>,
  | 'dataMode'
  | 'parseMessage'
  | 'shouldReconnect'
  | 'onConnect'
  | 'onReconnect'
  | 'onError'
> & {
  /**
   * Controls reconnection. `true` (the default) retries when
   * {@link XrpcSubscriptionError.shouldRetry} says so: connection failures by
   * their own classification (close code, HTTP status of a rejected upgrade,
   * …), server errors only for transient error codes, invalid messages never.
   * `false` never reconnects. A function fully replaces the default policy.
   */
  shouldReconnect?: boolean | ((error: unknown, attempt: number) => boolean)
  /** A connection is up, including the first. */
  onConnect?: () => void
  /**
   * A connection ended with an error and a retry is coming. This is the only
   * place such errors surface.
   */
  onReconnect?: (error: unknown, reconnect: { attempt: number }) => void
  /**
   * A connection ended with an error that will not be retried. The same error
   * is what the iterator rejects with.
   */
  onError?: (error: unknown) => void
}

/**
 * Options for subscribing to an XRPC subscription, based on the method schema.
 * The type system ensures required params are provided.
 *
 * @typeParam M - The subscription method type
 */
export type XrpcSubscribeOptions<M extends Subscription = Subscription> =
  XrpcRequestParamsOptions<XrpcRequestParams<M>> &
    XrpcSubscribeMessageOptions<M> &
    XrpcSubscribeWebSocketOptions

/**
 * Subscribes to an XRPC subscription (a WebSocket event stream), yielding its
 * messages validated against the method's message schema.
 *
 * The connection is opened on the first pull, and re-established (with
 * backoff) when it fails with a retryable error. Every connection is opened
 * through the agent's {@link Agent.fetchHandler}, as a WebSocket handshake
 * request (a `GET` with an `Upgrade: websocket` header): the agent sends it
 * like any other request, with its credentials and through its retry logic.
 * Its fetch must therefore be able to open WebSockets, which the agents built
 * from a service URL can (see `createWebSocketFetch()` for the others). A
 * refused upgrade fails like an XRPC request would: by HTTP status.
 *
 * @param agentOpts - The {@link Agent}, or service URL, to subscribe to
 * @param ns - The lexicon subscription definition
 * @param options - Subscription {@link XrpcSubscribeOptions options}
 *
 * @example
 * ```typescript
 * for await (const message of xrpcSubscribe(
 *   'https://relay.example.com',
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
  agentOpts: Agent | AgentOptions,
  ns: NonNullable<unknown> extends XrpcSubscribeOptions<M>
    ? Main<M>
    : Restricted<'This XRPC subscription requires an "options" argument'>,
): XrpcSubscriptionIterable<M>
export function xrpcSubscribe<const M extends Subscription>(
  agentOpts: Agent | AgentOptions,
  ns: Main<M>,
  options: XrpcSubscribeOptions<M>,
): XrpcSubscriptionIterable<M>
export function xrpcSubscribe<const M extends Subscription>(
  agentOpts: Agent | AgentOptions,
  ns: Main<M>,
  options: XrpcSubscribeOptions<M> = {} as XrpcSubscribeOptions<M>,
): XrpcSubscriptionIterable<M> {
  return subscribe(buildAgent(agentOpts), getMain(ns), options)
}

async function* subscribe<M extends Subscription>(
  agent: Agent,
  method: M,
  options: XrpcSubscribeOptions<M>,
): XrpcSubscriptionIterable<M> {
  const {
    params,
    validateResponse = true,
    strictResponseProcessing = true,
    onInvalidMessage = throwError,
    shouldReconnect = true,
    onConnect,
    onReconnect,
    onError,
    ...websocketOptions
  } = options as XrpcSubscribeOptions & {
    params?: XrpcRequestParamsInit<Params>
  }
  const { signal } = websocketOptions
  const wrapError = errorWrapper(method)

  const parseMessage = (
    bytes: Uint8Array,
  ): InferMethodMessage<M> | undefined => {
    const frame = decodeFrame(method, bytes)
    if (frame === undefined) return undefined

    if (frame.op === ERROR_FRAME) {
      throw new XrpcSubscriptionServerError(method, frame.body)
    }

    if (!validateResponse) {
      return frame.body as InferMethodMessage<M>
    }

    const result = method.message.safeParse(frame.body, {
      strict: strictResponseProcessing,
    })
    if (result.success) {
      return result.value as InferMethodMessage<M>
    }

    onInvalidMessage(
      new XrpcSubscriptionValidationError(method, frame.body, result.reason),
    )
    return undefined
  }

  const stream = websocket<'binary', InferMethodMessage<M>>(
    async (init) => {
      const path = await xrpcRequestUrl(method, { params })
      return agent.fetchHandler(path, init)
    },
    {
      ...websocketOptions,
      dataMode: 'binary',
      parseMessage,
      shouldReconnect:
        typeof shouldReconnect === 'function'
          ? (error, attempt) => shouldReconnect(wrapError(error), attempt)
          : shouldReconnect &&
            ((error) => {
              const wrapped = wrapError(error)
              return (
                wrapped instanceof XrpcSubscriptionError &&
                wrapped.shouldRetry()
              )
            }),
      // Subscriptions are receive-only, so the sender is not handed out.
      onConnect: onConnect && (() => onConnect()),
      onReconnect:
        onReconnect && ((error, info) => onReconnect(wrapError(error), info)),
      onError: onError && ((error) => onError(wrapError(error))),
    },
  )

  try {
    yield* stream
  } catch (error) {
    // An abort rejects with its reason as-is, which may itself be a
    // ws-client error (a `CloseError` chosen to set the close code).
    if (signal?.aborted && error === signal.reason) throw error
    throw wrapError(error)
  }
}

function throwError(error: unknown): never {
  throw error
}

/**
 * Wraps `@atproto/ws-client` errors into {@link XrpcSubscriptionConnectionError}
 * instances, memoized so that the policy, the hooks and the iterator rejection
 * all see the same instance for the same failure.
 */
function errorWrapper<M extends Subscription>(method: M) {
  const wrapped = new WeakMap<
    WebSocketClientError,
    XrpcSubscriptionConnectionError<M>
  >()
  return (error: unknown): unknown => {
    if (!(error instanceof WebSocketClientError)) return error
    let result = wrapped.get(error)
    if (!result) {
      result = new XrpcSubscriptionConnectionError(method, error)
      wrapped.set(error, result)
    }
    return result
  }
}

// Frame header `op` values (https://atproto.com/specs/event-stream)
const MESSAGE_FRAME = 1
const ERROR_FRAME = -1

type Frame =
  | { op: typeof MESSAGE_FRAME; body: LexValue }
  | { op: typeof ERROR_FRAME; body: LexErrorData }

/**
 * Decodes an event stream frame: a CBOR header followed by a CBOR body. A
 * message's `$type` is restored from its header's `t` (a `#fragment` being
 * relative to the subscription's NSID).
 *
 * @returns `undefined` for a frame with an unknown `op`, which the event stream
 * specification requires clients to ignore. Unknown `t` values are left to the
 * message schema, which accepts them when it is an open union (as lexicon
 * unions are by default).
 * @throws {XrpcSubscriptionInvalidMessageError} for invalid framing, which the
 * specification requires to drop the connection.
 */
function decodeFrame(
  method: Subscription,
  bytes: Uint8Array,
): Frame | undefined {
  let header: LexValue | undefined
  let body: LexValue | undefined
  let rest: LexValue[]
  try {
    ;[header, body, ...rest] = decodeAll(bytes)
  } catch (cause) {
    throw new XrpcSubscriptionInvalidMessageError(
      method,
      'Invalid frame: undecodable CBOR',
      { cause },
    )
  }

  if (body === undefined || rest.length > 0) {
    throw new XrpcSubscriptionInvalidMessageError(
      method,
      'Invalid frame: expected exactly a header and a body',
    )
  }

  if (!isPlainObject(header) || !Number.isInteger(header.op)) {
    throw new XrpcSubscriptionInvalidMessageError(
      method,
      'Invalid frame: invalid header',
    )
  }

  if (header.op === MESSAGE_FRAME) {
    const { t } = header
    if (t === undefined) return { op: MESSAGE_FRAME, body }

    if (typeof t !== 'string' || !isPlainObject(body)) {
      throw new XrpcSubscriptionInvalidMessageError(
        method,
        'Invalid frame: a typed message must have a string type and an object body',
      )
    }

    // The decoded body is not shared with anyone, so the $type is set in place
    // rather than by copying the (potentially large) message.
    body.$type = t.charCodeAt(0) === 0x23 /* # */ ? `${method.nsid}${t}` : t
    return { op: MESSAGE_FRAME, body }
  }

  if (header.op === ERROR_FRAME) {
    if (!lexErrorDataSchema.matches(body)) {
      throw new XrpcSubscriptionInvalidMessageError(
        method,
        'Invalid frame: invalid error frame body',
      )
    }
    return { op: ERROR_FRAME, body }
  }

  return undefined
}
