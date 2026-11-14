import { decodeAll } from '@atproto/lex-cbor'
import type { LexErrorData, LexValue } from '@atproto/lex-data'
import { isPlainObject } from '@atproto/lex-data'
import {
  type InferMethodMessage,
  type Main,
  type Params,
  type Restricted,
  type Subscription,
  type ValidationResult,
  getMain,
  lexErrorDataSchema,
} from '@atproto/lex-schema'
import {
  WebSocketClientError,
  type WebSocketOptions,
  websocket,
} from '@atproto/ws-client'
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
 * The URL of the service to subscribe on, or a (possibly async) function
 * returning it, invoked before every connection, reconnects included — so the
 * service can change over the lifetime of a subscription (e.g. after a PDS
 * migration). The XRPC path replaces the URL's path, and `http(s)` is mapped
 * to `ws(s)`.
 *
 * A function that throws fails that connection attempt: the error goes through
 * {@link XrpcSubscribeWebSocketOptions.shouldReconnect} unchanged, and is not
 * retried by the default policy.
 */
export type XrpcSubscribeUrl = URL | (() => URL | Promise<URL>)

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
export type XrpcSubscribeMessageOptions = XrpcResponseOptions

/**
 * The connection options of a subscription. They are those of
 * `@atproto/ws-client`'s `websocket()` (heartbeat, idle timeout, flow control,
 * backoff, lifecycle hooks, …), except that frames are always binary, the
 * stream is receive-only, and every error that reaches a hook or the iterator
 * is an {@link XrpcSubscriptionError} — connection failures included, as
 * {@link XrpcSubscriptionConnectionError} — or, for an abort, the signal's
 * reason. Errors thrown by the caller's own callbacks are passed through
 * unchanged. Every other option (`headers`, `protocols`, and any connection
 * option `websocket()` accepts) is forwarded to it as-is.
 */
export type XrpcSubscribeWebSocketOptions = Omit<
  WebSocketOptions<'binary'>,
  'dataMode' | 'shouldReconnect' | 'onConnect' | 'onReconnect' | 'onError'
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
    XrpcSubscribeMessageOptions &
    XrpcSubscribeWebSocketOptions

/**
 * Subscribes to an XRPC subscription (a WebSocket event stream), yielding its
 * messages validated against the method's message schema.
 *
 * The connection is opened on the first pull, and re-established (with
 * backoff) when it fails with a retryable error. Every connection option of
 * `@atproto/ws-client` (see {@link XrpcSubscribeWebSocketOptions}) is passed
 * through to the WebSocket.
 *
 * @param url - The {@link XrpcSubscribeUrl service URL}, or a function returning it
 * @param ns - The lexicon subscription definition
 * @param options - Subscription {@link XrpcSubscribeOptions options}
 *
 * @example
 * ```typescript
 * for await (const message of xrpcSubscribe(
 *   new URL('https://relay.example.com'),
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
  url: XrpcSubscribeUrl,
  ns: NonNullable<unknown> extends XrpcSubscribeOptions<M>
    ? Main<M>
    : Restricted<'This XRPC subscription requires an "options" argument'>,
): XrpcSubscriptionIterable<M>
export function xrpcSubscribe<const M extends Subscription>(
  url: XrpcSubscribeUrl,
  ns: Main<M>,
  options: XrpcSubscribeOptions<M>,
): XrpcSubscriptionIterable<M>
export function xrpcSubscribe<const M extends Subscription>(
  url: XrpcSubscribeUrl,
  ns: Main<M>,
  options: XrpcSubscribeOptions<M> = {} as XrpcSubscribeOptions<M>,
): XrpcSubscriptionIterable<M> {
  return subscribe(url, getMain(ns), options)
}

async function* subscribe<M extends Subscription>(
  url: XrpcSubscribeUrl,
  method: M,
  options: XrpcSubscribeOptions<M>,
): XrpcSubscriptionIterable<M> {
  const {
    params,
    validateResponse = true,
    strictResponseProcessing = true,
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

  const stream = websocket<'binary'>(
    async () => {
      const path = await xrpcRequestUrl(method, { params })
      return toWebSocketUrl(path, typeof url === 'function' ? await url() : url)
    },
    {
      ...websocketOptions,
      dataMode: 'binary',
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

  const parseOptions: ParseMessageOptions = {
    validateResponse,
    strictResponseProcessing,
  }

  // Stepped by hand rather than with `for await`, which can only end the
  // stream: a frame that fails to parse is handed back to it with `throw()`,
  // which ends the connection that delivered it and classifies the error
  // through `shouldReconnect` (with backoff and hooks), like any connection
  // failure.
  try {
    let result = await stream.next()
    while (!result.done) {
      let message: InferMethodMessage<M> | undefined
      try {
        message = parseMessage(method, result.value, parseOptions)
      } catch (error) {
        result = await stream.throw(error)
        continue
      }
      if (message !== undefined) yield message
      result = await stream.next()
    }
  } catch (error) {
    // An abort rejects with its reason as-is, which may itself be a
    // ws-client error (a `CloseError` chosen to set the close code).
    if (signal?.aborted && error === signal.reason) throw error
    throw wrapError(error)
  } finally {
    // A consumer `break` or `throw()` at the `yield` above: close the stream,
    // as a `for await` would. A no-op once the stream has ended.
    await stream.return()
  }
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

function toWebSocketUrl(path: `/${string}`, service: URL): URL {
  // A new URL, so the caller's own is never mutated.
  const result = new URL(path, service)
  switch (result.protocol) {
    case 'https:':
      result.protocol = 'wss:'
      return result
    case 'http:':
      result.protocol = 'ws:'
      return result
    case 'wss:':
    case 'ws:':
      return result
    default:
      throw new TypeError(
        `Unsupported protocol "${result.protocol}" for an XRPC subscription`,
      )
  }
}

// Frame header `op` values (https://atproto.com/specs/event-stream)
const MESSAGE_FRAME = 1
const ERROR_FRAME = -1

type ParseMessageOptions = {
  validateResponse: boolean
  strictResponseProcessing: boolean
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
 * @throws {XrpcSubscriptionInvalidMessageError} for invalid framing, which the
 * specification requires to drop the connection.
 * @throws {XrpcSubscriptionServerError} for an error frame.
 * @throws {XrpcSubscriptionValidationError} for a message not matching the
 * message schema.
 * @see {@link https://atproto.com/specs/event-stream AT Protocol Event Stream Specification}
 */
function parseMessage<M extends Subscription>(
  method: M,
  bytes: Uint8Array,
  options: ParseMessageOptions,
): undefined | InferMethodMessage<M> {
  // /!\ HOT PATH - this function is called for every incoming message frame, so
  // it should be optimized for performance.
  let header: LexValue | undefined
  let body: LexValue | undefined
  let next: LexValue | undefined
  try {
    ;[header, body, next] = decodeAll(bytes)
  } catch (cause) {
    throw new XrpcSubscriptionInvalidMessageError(
      method,
      'Invalid frame: undecodable CBOR',
      { cause },
    )
  }

  if (body === undefined || next !== undefined) {
    throw new XrpcSubscriptionInvalidMessageError(
      method,
      'Invalid frame: expected exactly a header and a body',
    )
  }

  if (isPlainObject(header)) {
    if (header.op === MESSAGE_FRAME) {
      const { t } = header

      if (t === undefined) {
        // noop
      } else if (typeof t !== 'string' || !isPlainObject(body)) {
        throw new XrpcSubscriptionInvalidMessageError(
          method,
          'Invalid frame: a typed message must have a string type and an object body',
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

      if (!result.success) {
        throw new XrpcSubscriptionValidationError(method, body, result.reason)
      }

      return result.value
    } else if (header.op === ERROR_FRAME) {
      if (options.validateResponse && !lexErrorDataSchema.matches(body)) {
        throw new XrpcSubscriptionInvalidMessageError(
          method,
          'Invalid frame: invalid error frame body',
        )
      }

      throw new XrpcSubscriptionServerError(method, body as LexErrorData)
    } else if (Number.isInteger(header.op)) {
      // noop for other numeric op codes
      return undefined
    }
  }

  throw new XrpcSubscriptionInvalidMessageError(
    method,
    'Invalid frame: invalid header',
  )
}
