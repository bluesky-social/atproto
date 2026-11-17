import './polyfill.js'
import type { LexParseOptions } from '@atproto/lex-json'
import { jsonToLex } from '@atproto/lex-json'
import type {
  InferMethodOutputEncoding,
  InferOutput,
  LexValue,
  Payload,
  Procedure,
  Query,
  Restricted,
  ResultSuccess,
  Validator,
} from '@atproto/lex-schema'
import {
  XrpcAuthenticationError,
  XrpcError,
  XrpcInternalError,
  XrpcInvalidResponseError,
  XrpcResponseError,
  XrpcResponseValidationError,
} from './errors.js'
import { isEncodingString } from './types.js'
import type { EncodingString, XrpcUnknownResponsePayload } from './types.js'

const CONTENT_TYPE_BINARY = 'application/octet-stream'
const CONTENT_TYPE_JSON = 'application/json'

/**
 * A binary response payload that was not read yet.
 *
 * @see {@link XrpcStreamResponse}
 */
export type XrpcBinaryStream = ReadableStream<Uint8Array<ArrayBuffer>>

/**
 * The possible representations of a binary (non JSON) response payload.
 */
export type XrpcBinaryBody = Uint8Array<ArrayBuffer> | XrpcBinaryStream

/**
 * Resolves to `T` if the output of `TMethod` may be a binary payload (which
 * {@link XrpcStreamResponse} returns as a stream), and to a type error
 * otherwise.
 */
export type IfXrpcStreamable<TMethod extends Procedure | Query, T> =
  // @NOTE Testing against Uint8Array would not work, since LexValue (JSON
  // payloads) includes Uint8Array.
  XrpcBinaryStream extends XrpcResponseBody<TMethod, XrpcBinaryStream>
    ? T
    : Restricted<'This XRPC method never returns a binary payload'>

// @NOTE the output schema is used in "parse" mode (safeParse), which means that
// defaults will be applied and coercions will be performed, so we need to use
// InferOutput here to get the final parsed type, not Infer/InferInput. For this
// reason, we cannot use InferMethodOutputBody and InferMethodOutput from
// lex-schema here.

type InferEncodingType<TEncoding extends string> = TEncoding extends '*/*'
  ? EncodingString
  : TEncoding extends `${infer T extends string}/*`
    ? `${T}/${string}`
    : TEncoding

type InferBodyType<
  TEncoding extends string,
  TSchema,
  TBinary extends XrpcBinaryBody,
> = TSchema extends Validator
  ? InferOutput<TSchema>
  : TEncoding extends `application/json`
    ? LexValue
    : // Non-literal encodings (e.g. `string`) may be "application/json" at
      // runtime, in which case the payload gets parsed.
      `application/json` extends TEncoding
      ? LexValue | TBinary
      : TBinary

/**
 * The body type of an XRPC response, inferred from the method's output schema.
 *
 * For JSON responses, this is the parsed LexValue. For binary responses,
 * this is `TBinary` (a Uint8Array, unless streamed).
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 * @typeParam TBinary - The type of binary payloads
 */
export type XrpcResponseBody<
  TMethod extends Procedure | Query,
  TBinary extends XrpcBinaryBody = Uint8Array<ArrayBuffer>,
> =
  TMethod['output'] extends Payload<infer TEncoding, infer TSchema>
    ? TEncoding extends string
      ? InferBodyType<TEncoding, TSchema, TBinary>
      : undefined | LexValue | TBinary
    : never

/**
 * The full payload type of an XRPC response, including body and encoding.
 *
 * Returns `null` for methods that have no output.
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 * @typeParam TBinary - The type of binary payloads
 */
export type XrpcResponsePayload<
  TMethod extends Procedure | Query,
  TBinary extends XrpcBinaryBody = Uint8Array<ArrayBuffer>,
> =
  TMethod['output'] extends Payload<infer TEncoding, infer TSchema>
    ? TEncoding extends string
      ? {
          encoding: InferEncodingType<TEncoding>
          body: InferBodyType<TEncoding, TSchema, TBinary>
        }
      : // If the schema does not specify an output encoding, anything could be
        // returned, including no payload at all (undefined).
        undefined | { body: LexValue | TBinary; encoding: string }
    : never

/**
 * Determines how a response body gets cancelled, and how failures to do so are
 * handled:
 *
 * - `"propagate"` (default): the cancellation is awaited, and its failures are
 *   thrown. If the body is discarded because of another error, the
 *   cancellation failure is thrown instead of that error.
 * - `"log"`: the cancellation is not awaited, and its failures are logged.
 * - a function: the cancellation is not awaited, and its failures are passed
 *   to that function.
 *
 * @note Cancelling the body of a response that was cloned only settles once
 * every clone was consumed or cancelled. Responses that may have pending clones
 * (e.g. created by the fetch handler) must use `"log"` or a function, as
 * `"propagate"` would otherwise result in a dead lock.
 */
export type XrpcCancellationErrorHandler =
  'propagate' | 'log' | ((err: unknown) => void)

export type XrpcResponseOptions = {
  /**
   * Whether to validate the response against the method's output schema.
   * Disabling this can improve performance but may lead to runtime errors if
   * the response does not conform to the expected schema. Only set this to
   * `false` if you are certain that the upstream service will always return
   * valid responses.
   *
   * @default true
   */
  validateResponse?: boolean

  /**
   * Whether to strictly process response payloads according to Lex encoding
   * rules. By default, the client will reject responses with invalid Lex data
   * (floats and invalid $bytes / $link objects).
   *
   * Setting this option to `false` will allow the client to accept such
   * responses in a non-strict mode, where invalid Lex data will be returned
   * as-is (e.g., floats will not be rejected, and invalid $bytes / $link
   * objects will not be converted to Uint8Array / Cid). When in non-strict
   * mode, the validation will also be relaxed when validating the response
   * against the method's output schema, allowing values that do not strictly
   * conform to the schema (e.g. datetime strings that are not valid RFC3339
   * format, blobs that are not of the right size/mime-type, etc.) to be
   * accepted as long as their basic structure is correct.
   *
   * When validation is enabled (the default), the values defined through the
   * method schema will be enforced, ensuring that the client can still process
   * the response even if the server returns invalid Lex data.
   *
   * @default true
   * @see {@link LexParseOptions.strict}
   */
  strictResponseProcessing?: boolean

  /**
   * Determines how response bodies that are discarded (e.g. because the
   * response is invalid) get cancelled, in order to release their underlying
   * resources (e.g. connection).
   *
   * @see {@link XrpcCancellationErrorHandler}
   * @default "propagate"
   */
  onCancellationError?: XrpcCancellationErrorHandler
}

/**
 * Properties shared by {@link XrpcResponse} and {@link XrpcStreamResponse}.
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 * @typeParam TBinary - The type of binary payloads
 */
export abstract class XrpcResponseBase<
  M extends Procedure | Query,
  TBinary extends XrpcBinaryBody,
> implements ResultSuccess<XrpcResponseBase<M, TBinary>> {
  /** @see {@link ResultSuccess.success} */
  readonly success = true as const

  /** @see {@link ResultSuccess.value} */
  get value(): this {
    return this
  }

  constructor(
    readonly method: M,
    readonly status: number,
    readonly headers: Headers,
    readonly payload: XrpcResponsePayload<M, TBinary>,
  ) {}

  /**
   * Whether the response payload was parsed as {@link LexValue} (`true`) or is
   * in binary form (`false`).
   */
  get isParsed(): boolean {
    return this.method.output.encoding === CONTENT_TYPE_JSON
  }

  /**
   * The Content-Type encoding of the response (e.g., 'application/json').
   * Returns `undefined` if the response has no body.
   */
  get encoding() {
    return this.payload?.encoding as InferMethodOutputEncoding<M>
  }

  /**
   * The parsed response body.
   *
   * For 'application/json' responses, this is the parsed and validated LexValue.
   * For binary responses, this is a Uint8Array ({@link XrpcResponse}) or a
   * {@link XrpcBinaryStream} ({@link XrpcStreamResponse}).
   * Returns `undefined` if the response has no body.
   */
  get body() {
    return this.payload?.body as XrpcResponseBody<M, TBinary>
  }
}

/**
 * Small container for XRPC response, with binary payloads read into a
 * Uint8Array.
 *
 * @implements {ResultSuccess<XrpcResponse<M>>} for convenience in result handling contexts.
 * @see {@link XrpcStreamResponse} to stream binary payloads instead
 *
 * @example
 *
 * ```typescript
 * import { app } from '#/lexicons'
 * import { XrpcResponse } from '@atproto/lex-client'
 *
 * const fetchResponse = await fetch('https://example.com/xrpc/app.bsky.feed.getTimeline')
 *
 * const response = await XrpcResponse.fromFetchResponse(
 *   app.bsky.feed.getTimeline.main,
 *   fetchResponse,
 * )
 *
 * // Fully typed (validated) response body, according to the method's output schema
 * const { cursor, feed } = response.body
 * ```
 */
export class XrpcResponse<M extends Procedure | Query> extends XrpcResponseBase<
  M,
  Uint8Array<ArrayBuffer>
> {
  /**
   * @throws {XrpcResponseError} in case of (valid) XRPC error responses. Use
   * {@link XrpcResponseError.matchesSchemaErrors} to narrow the error type based on
   * the method's declared error schema. This can be narrowed further as a
   * {@link XrpcAuthenticationError} if the error is an authentication error.
   * @throws {XrpcInvalidResponseError} when the response is not a valid XRPC
   * response, or if the response does not conform to the method's schema.
   * @note The response body is always consumed or cancelled.
   */
  static async fromFetchResponse<const M extends Procedure | Query>(
    method: M,
    response: Response,
    options?: XrpcResponseOptions,
  ): Promise<XrpcResponse<M>> {
    const payload = (await readXrpcPayload(
      method,
      response,
      options,
      false,
    )) as XrpcResponsePayload<M>
    return new XrpcResponse<M>(
      method,
      response.status,
      response.headers,
      payload,
    )
  }
}

/**
 * XRPC response whose binary (non JSON) payload is returned, unread, as a
 * {@link XrpcBinaryStream}. JSON payloads and error responses are still
 * buffered (and validated).
 *
 * The caller owns the stream, and must either consume it or {@link cancel} it
 * in order to release the underlying resources (e.g. connection). Disposing of
 * the response (`await using`) cancels the stream if it was not consumed.
 *
 * @example
 *
 * ```typescript
 * await using response = await XrpcStreamResponse.fromFetchResponse(
 *   com.atproto.sync.getBlob.main,
 *   fetchResponse,
 * )
 *
 * for await (const chunk of response.body) {
 *   // ...
 * }
 * ```
 */
export class XrpcStreamResponse<M extends Procedure | Query>
  extends XrpcResponseBase<M, XrpcBinaryStream>
  implements AsyncDisposable
{
  readonly #response: Response
  readonly #onCancellationError: XrpcCancellationErrorHandler | undefined

  constructor(
    method: M,
    response: Response,
    payload: XrpcResponsePayload<M, XrpcBinaryStream>,
    options?: Pick<XrpcResponseOptions, 'onCancellationError'>,
  ) {
    super(method, response.status, response.headers, payload)
    this.#response = response
    // @NOTE The options object is not kept, as it can be the whole request
    // options (see xrpc()), whose request body must not be retained.
    this.#onCancellationError = options?.onCancellationError
  }

  /**
   * Whether the response body is a {@link XrpcBinaryStream}. This is always the
   * case for binary payloads, but methods with an undeclared output may also
   * return a (parsed) JSON payload, or no payload at all.
   *
   * @example
   * ```typescript
   * if (response.hasBodyStream()) {
   *   for await (const chunk of response.body) {
   *     // ...
   *   }
   * }
   * ```
   */
  hasBodyStream(): this is { readonly body: XrpcBinaryStream } {
    return isReadableStream(this.payload?.body)
  }

  /**
   * Cancels the response body, releasing its underlying resources (e.g.
   * connection). This is a no-op if the body is not a stream (e.g. a JSON
   * payload), if it was fully consumed, or if it is locked (in which case it
   * must be cancelled through its reader).
   *
   * The cancellation is performed as determined by the
   * {@link XrpcResponseOptions.onCancellationError} option this response was
   * created with. By default (`"propagate"`), the cancellation is awaited, and
   * its failures are thrown.
   *
   * Cancellation failures are ignored once the body was read from, as they
   * would then typically be the error the reader already got (e.g. a network
   * error, which would otherwise be thrown twice when disposing of the response
   * with `await using`).
   */
  async cancel(reason?: unknown): Promise<void> {
    if (this.hasBodyStream()) {
      // @NOTE bodyUsed is the standard (portable) way of telling whether a
      // body stream was disturbed (read from or cancelled).
      const { body } = this
      const ignoreFailures =
        body === this.#response.body && this.#response.bodyUsed
      await cancelStream(
        body,
        reason,
        this.#onCancellationError,
        ignoreFailures,
      )
    }
  }

  /** @see {@link XrpcStreamResponse.cancel} */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.cancel()
  }

  /**
   * @throws {XrpcResponseError} in case of (valid) XRPC error responses.
   * @throws {XrpcInvalidResponseError} when the response is not a valid XRPC
   * response, or if the response does not conform to the method's schema.
   * @throws {XrpcInternalError} when the fetch implementation does not expose
   * the response body as a stream (e.g. React Native's built-in fetch).
   * @note The response body is always consumed or cancelled, unless it is
   * returned as a {@link XrpcBinaryStream}.
   * @see {@link XrpcResponse.fromFetchResponse}
   */
  static async fromFetchResponse<const M extends Procedure | Query>(
    method: IfXrpcStreamable<M, M>,
    response: Response,
    options?: XrpcResponseOptions,
  ): Promise<XrpcStreamResponse<M>>
  static async fromFetchResponse<const M extends Procedure | Query>(
    method: M,
    response: Response,
    options?: XrpcResponseOptions,
  ): Promise<XrpcStreamResponse<M>> {
    const payload = (await readXrpcPayload(
      method,
      response,
      options,
      true,
    )) as XrpcResponsePayload<M, XrpcBinaryStream>
    return new XrpcStreamResponse<M>(method, response, payload, options)
  }
}

/**
 * @note The response body is always consumed or cancelled, unless it is
 * returned as a stream.
 */
async function readXrpcPayload(
  method: Procedure | Query,
  response: Response,
  options: undefined | XrpcResponseOptions,
  stream: boolean,
): Promise<undefined | XrpcUnknownResponsePayload<XrpcBinaryBody>> {
  let payload: undefined | XrpcUnknownResponsePayload<XrpcBinaryBody>

  try {
    payload = await processFetchResponse(method, response, options, stream)
  } catch (err) {
    // Release the resources (e.g. undici connection) associated with the
    // response, in case it was not fully consumed.
    await cancelResponseBody(response, err, options?.onCancellationError)
    throw err
  }

  // Release the resources of empty bodies that were not read (stream mode)
  if (payload === undefined) {
    await cancelResponseBody(response, undefined, options?.onCancellationError)
  }

  return payload
}

async function processFetchResponse(
  method: Procedure | Query,
  response: Response,
  options: undefined | XrpcResponseOptions,
  stream: boolean,
): Promise<undefined | XrpcUnknownResponsePayload<XrpcBinaryBody>> {
  // Always turn 4xx/5xx responses into XrpcResponseError
  if (response.status >= 400) {
    const payload = await readPayload(method, response, {
      // Always parse errors in non-strict mode
      parse: { strict: false },
    })

    if (response.status === 401) {
      throw new XrpcAuthenticationError(method, response, payload)
    }

    throw new XrpcResponseError(method, response, payload)
  }

  // @NOTE redirect is set to 'follow', so we shouldn't get 3xx responses here
  if (response.status < 200 || response.status >= 300) {
    throw new XrpcInvalidResponseError(
      method,
      response,
      undefined,
      `Unexpected status code ${response.status}`,
    )
  }

  const payload = await readPayload(method, response, {
    // Parse response if there is a schema, or if the encoding is
    // "application/json"
    parse:
      method.output.schema || method.output.encoding === CONTENT_TYPE_JSON
        ? { strict: options?.strictResponseProcessing ?? true }
        : // If there is no declared output encoding, we'll parse the output (in loose mode)
          method.output.encoding == null
          ? { strict: false }
          : false,
    // Payloads validated against a schema are always buffered
    stream: stream && !method.output.schema,
  })

  if (!method.output.matchesEncoding(payload?.encoding)) {
    throw new XrpcInvalidResponseError(
      method,
      response,
      // Streamed payloads are not exposed through errors (they get cancelled)
      isBufferedPayload(payload) ? payload : undefined,
      `Expected ${stringifyEncoding(method.output.encoding)} response (got ${stringifyEncoding(payload?.encoding)})`,
    )
  }

  // Response is successful (2xx). Validate payload (data and encoding) against schema.
  if (method.output.encoding != null) {
    // If the schema specifies an output, verify that the response properly
    // matches the expected format (encoding and schema, if present). If no
    // output is specified, any payload could be returned.

    // Needed for type safety. Should never happen since matchesEncoding()
    // should return not succeed if there is a schema encoding but no payload.
    if (!payload) throw new Error('Expected payload')

    // Assert valid response body.
    if (method.output.schema && options?.validateResponse !== false) {
      const result = method.output.schema.safeParse(payload.body, {
        strict: options?.strictResponseProcessing ?? true,
      })

      if (!result.success) {
        throw new XrpcResponseValidationError(
          method,
          response,
          // Payloads are never streamed when there is a schema
          payload as XrpcUnknownResponsePayload,
          result.reason,
        )
      }

      return { body: result.value as LexValue, encoding: payload.encoding }
    }
  }

  return payload
}

type ReadPayloadOptions = {
  /**
   * Whether to parse the response body as JSON and convert it to LexValue.
   *
   * @default false
   */
  parse?: false | LexParseOptions

  /**
   * Whether to return (unparsed) payloads as a stream, instead of reading them
   * into a Uint8Array.
   *
   * @default false
   */
  stream?: boolean
}

/**
 * @note this function always consumes the response body, unless it is returned
 * as a stream, or known to be empty without being read (stream mode).
 */
async function readPayload(
  method: Query | Procedure,
  response: Response,
  options?: ReadPayloadOptions & { stream?: false },
): Promise<undefined | XrpcUnknownResponsePayload>
async function readPayload(
  method: Query | Procedure,
  response: Response,
  options?: ReadPayloadOptions,
): Promise<undefined | XrpcUnknownResponsePayload<XrpcBinaryBody>>
async function readPayload(
  method: Query | Procedure,
  response: Response,
  options?: ReadPayloadOptions,
): Promise<undefined | XrpcUnknownResponsePayload<XrpcBinaryBody>> {
  try {
    // @TODO Should we limit the maximum response size here (this could also be
    // done by the FetchHandler)?

    const encoding = response.headers
      .get('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase()

    // Response content-type is undefined
    if (!encoding) {
      if (options?.stream) {
        // Determine whether the payload is empty without reading the body
        if (
          response.body === null ||
          response.headers.get('content-length')?.trim() === '0'
        ) {
          return undefined
        }

        return {
          encoding: CONTENT_TYPE_BINARY,
          body: getBodyStream(method, response),
        }
      }

      // If the body is empty, return undefined (= no payload)
      const arrayBuffer = await response.arrayBuffer()
      if (arrayBuffer.byteLength === 0) return undefined

      // If we got data despite no content-type, treat it as binary
      return {
        encoding: CONTENT_TYPE_BINARY,
        body: new Uint8Array(arrayBuffer),
      }
    }

    if (!isEncodingString(encoding)) {
      throw new TypeError(`Invalid content-type "${encoding}" in response`)
    }

    if (options?.parse && encoding === CONTENT_TYPE_JSON) {
      // @NOTE See ./response.bench.ts to comparison of different parsing approaches.
      const json = await response.json()
      const body = jsonToLex(json, options.parse)
      return { encoding, body }
    }

    if (options?.stream) {
      return { encoding, body: getBodyStream(method, response) }
    }

    const arrayBuffer = await response.arrayBuffer()
    return { encoding, body: new Uint8Array(arrayBuffer) }
  } catch (cause) {
    if (cause instanceof XrpcError) throw cause

    const message = 'Unable to parse response payload'
    const messageDetail = cause instanceof TypeError ? cause.message : undefined
    throw new XrpcInvalidResponseError(
      method,
      response,
      undefined,
      messageDetail ? `${message}: ${messageDetail}` : message,
      { cause },
    )
  }
}

function getBodyStream(
  method: Query | Procedure,
  response: Response,
): XrpcBinaryStream {
  const { body } = response

  // A null body is a body without content (e.g. 204 responses)
  if (body === null) {
    return new ReadableStream({
      start: (controller) => controller.close(),
    })
  }

  if (isReadableStream(body)) return body

  // Some fetch implementations do not expose the response body as a
  // ReadableStream: React Native's built-in fetch does not expose it at all,
  // and node-fetch exposes a Node.js Readable instead.
  throw new XrpcInternalError(
    method,
    'Streaming response payloads is not supported by the fetch() implementation',
  )
}

function isBufferedPayload(
  payload: undefined | XrpcUnknownResponsePayload<XrpcBinaryBody>,
): payload is XrpcUnknownResponsePayload {
  return payload != null && !isReadableStream(payload.body)
}

function isReadableStream(value: unknown): value is ReadableStream {
  // @NOTE Using duck typing to support ReadableStream polyfills
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ReadableStream).getReader === 'function' &&
    typeof (value as ReadableStream).cancel === 'function'
  )
}

/**
 * Cancels the response body, if it was not consumed yet.
 *
 * @see {@link XrpcResponseOptions.onCancellationError}
 */
async function cancelResponseBody(
  response: Response,
  reason: unknown,
  onCancellationError?: XrpcCancellationErrorHandler,
): Promise<void> {
  const { body } = response
  if (body && !response.bodyUsed) {
    await cancelStream(body, reason, onCancellationError)
  }
}

/**
 * Cancels a stream, unless it is locked (e.g. by a reader).
 *
 * @param ignoreFailures - Whether to silence cancellation failures, regardless
 * of `onCancellationError` (which still determines whether the cancellation
 * is awaited).
 * @see {@link XrpcCancellationErrorHandler}
 */
async function cancelStream(
  stream: ReadableStream,
  reason: unknown,
  onCancellationError: XrpcCancellationErrorHandler = 'propagate',
  ignoreFailures = false,
): Promise<void> {
  if (
    stream.locked ||
    // Support for alternative fetch implementations
    typeof stream.cancel !== 'function'
  ) {
    return
  }

  if (onCancellationError === 'propagate') {
    try {
      await stream.cancel(reason)
    } catch (err) {
      if (!ignoreFailures) throw err
    }
  } else {
    const errorHandler = ignoreFailures
      ? ignoreError
      : onCancellationError === 'log'
        ? logCancellationError
        : onCancellationError
    void stream.cancel(reason).catch(errorHandler)
  }
}

function ignoreError(): void {}

function logCancellationError(err: unknown): void {
  console.warn('Failed to cancel response body', err)
}

function stringifyEncoding(encoding: string | undefined) {
  return encoding ? `"${encoding}"` : 'no payload'
}
