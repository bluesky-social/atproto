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
 * @see {@link XrpcResponseModeOptions.responseType}
 */
export type XrpcBinaryStream = ReadableStream<Uint8Array<ArrayBuffer>>

/**
 * The possible representations of a binary (non JSON) response payload.
 */
export type XrpcBinaryBody = Uint8Array<ArrayBuffer> | XrpcBinaryStream

export type XrpcResponseType = 'buffer' | 'stream'

/**
 * Options that determine the type of the response payload. Since they are
 * inferred from the options of each request (see
 * {@link XrpcResponseModeParam}), they cannot be configured through
 * instance-wide defaults.
 */
export type XrpcResponseModeOptions = {
  /**
   * How binary (non JSON) response payloads are returned:
   *
   * - `"buffer"`: the payload is fully read into a {@link Uint8Array}.
   * - `"stream"`: the payload is returned, unread, as a {@link ReadableStream}.
   *   The caller becomes responsible for either consuming or cancelling it,
   *   which can be done by disposing of the response (`await using`). Fetch
   *   implementations that do not support streaming response bodies (e.g.
   *   React Native's built-in fetch) will cause an {@link XrpcInternalError}.
   *
   * JSON payloads and error responses are always buffered.
   *
   * @default "buffer"
   */
  responseType?: XrpcResponseType
}

/**
 * Picks the {@link XrpcResponseModeOptions} of `TOptions`. Typing request options as
 * `XrpcRequestOptions & XrpcResponseModeParam<TOptions>` allows `TOptions` to be inferred
 * from the options, while preserving excess property checks on the whole
 * options object.
 */
export type XrpcResponseModeParam<TOptions extends XrpcResponseModeOptions> =
  Pick<TOptions, keyof TOptions & keyof XrpcResponseModeOptions>

/**
 * The type of binary response payloads, according to the response mode
 * options `TOptions`.
 */
export type InferXrpcResponseBinary<TOptions extends XrpcResponseModeOptions> =
  TOptions extends { responseType?: infer T }
    ? BinaryForResponseType<T>
    : Uint8Array<ArrayBuffer>

type BinaryForResponseType<T> = T extends 'stream'
  ? XrpcBinaryStream
  : Uint8Array<ArrayBuffer>

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
}

/**
 * Small container for XRPC response.
 *
 * @implements {ResultSuccess<XrpcResponse<M>>} for convenience in result handling contexts.
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
 *
 * @example Streaming a binary response
 *
 * ```typescript
 * // Disposing of the response cancels the body if it was not fully consumed
 * await using response = await XrpcResponse.fromFetchResponse(
 *   com.atproto.sync.getBlob.main,
 *   fetchResponse,
 *   { responseType: 'stream' },
 * )
 *
 * for await (const chunk of response.body) {
 *   // ...
 * }
 * ```
 */
export class XrpcResponse<
  M extends Procedure | Query,
  TBinary extends XrpcBinaryBody = Uint8Array<ArrayBuffer>,
> implements ResultSuccess<XrpcResponse<M, TBinary>> {
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
   * For binary responses, this is a Uint8Array, or a {@link XrpcBinaryStream}
   * when using the "stream" {@link XrpcResponseModeOptions.responseType}.
   * Returns `undefined` if the response has no body.
   */
  get body() {
    return this.payload?.body as XrpcResponseBody<M, TBinary>
  }

  /**
   * Cancels the response body if it is a {@link XrpcBinaryStream} that is not
   * locked (e.g. by a reader). This is a no-op for buffered payloads, and for
   * streams that were already fully consumed.
   *
   * @note The cancellation is initiated, but not awaited, as it would never
   * settle for responses that were cloned (until every clone is consumed).
   */
  async [Symbol.asyncDispose](): Promise<void> {
    const body = this.payload?.body
    if (isReadableStream(body)) cancelStream(body)
  }

  /**
   * @throws {XrpcResponseError} in case of (valid) XRPC error responses. Use
   * {@link XrpcResponseError.matchesSchemaErrors} to narrow the error type based on
   * the method's declared error schema. This can be narrowed further as a
   * {@link XrpcAuthenticationError} if the error is an authentication error.
   * @throws {XrpcInvalidResponseError} when the response is not a valid XRPC
   * response, or if the response does not conform to the method's schema.
   * @throws {XrpcInternalError} when streaming the response payload is not
   * supported by the fetch implementation.
   * @note The response body is always consumed or cancelled, unless it gets
   * returned as a {@link XrpcBinaryStream}.
   */
  static async fromFetchResponse<
    const M extends Procedure | Query,
    O extends XrpcResponseModeOptions = NonNullable<unknown>,
  >(
    method: M,
    response: Response,
    options?: XrpcResponseOptions & XrpcResponseModeParam<O>,
  ): Promise<XrpcResponse<M, InferXrpcResponseBinary<O>>>
  static async fromFetchResponse<const M extends Procedure | Query>(
    method: M,
    response: Response,
    options?: XrpcResponseOptions & XrpcResponseModeOptions,
  ): Promise<XrpcResponse<M, XrpcBinaryBody>> {
    try {
      return await processFetchResponse(method, response, options)
    } catch (err) {
      // Release the resources (e.g. undici connection) associated with the
      // response, in case it was not fully consumed.
      cancelResponseBody(response, err)
      throw err
    }
  }
}

async function processFetchResponse<M extends Procedure | Query>(
  method: M,
  response: Response,
  options?: XrpcResponseOptions & XrpcResponseModeOptions,
): Promise<XrpcResponse<M, XrpcBinaryBody>> {
  // Always turn 4xx/5xx responses into XrpcResponseError
  if (response.status >= 400) {
    const payload = await readPayload(method, response, {
      // Always parse errors in non-strict mode
      parse: { strict: false },
    })

    if (response.status === 401) {
      throw new XrpcAuthenticationError<M>(method, response, payload)
    }

    throw new XrpcResponseError<M>(method, response, payload)
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
    stream: options?.responseType === 'stream' && !method.output.schema,
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

      const parsedPayload = {
        body: result.value,
        encoding: payload.encoding,
      } as XrpcResponsePayload<M, XrpcBinaryBody>

      return new XrpcResponse<M, XrpcBinaryBody>(
        method,
        response.status,
        response.headers,
        parsedPayload,
      )
    }
  }

  return new XrpcResponse<M, XrpcBinaryBody>(
    method,
    response.status,
    response.headers,
    payload as XrpcResponsePayload<M, XrpcBinaryBody>,
  )
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
 * as a stream.
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
          cancelResponseBody(response)
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

  if (body) return body

  // A null body is a body without content (e.g. 204 responses)
  if (body === null) {
    return new ReadableStream({
      start: (controller) => controller.close(),
    })
  }

  // Some fetch implementations (e.g. React Native's built-in fetch) do not
  // expose the response body as a stream.
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

function cancelResponseBody(response: Response, reason?: unknown): void {
  if (response.body && !response.bodyUsed) {
    cancelStream(response.body, reason)
  }
}

/**
 * Cancels a stream that is not locked, in order to release its underlying
 * resources (e.g. undici connection).
 *
 * @note The cancellation is not awaited (and failures are logged) because, if
 * the response it originates from was cloned, cancel() only settles once every
 * clone was consumed or cancelled, which could result in a dead lock.
 */
function cancelStream(stream: ReadableStream, reason?: unknown): void {
  if (stream.locked) return
  stream.cancel(reason).catch(logCancellationError)
}

function logCancellationError(err: unknown): void {
  console.warn('Failed to cancel response body', err)
}

function stringifyEncoding(encoding: string | undefined) {
  return encoding ? `"${encoding}"` : 'no payload'
}
