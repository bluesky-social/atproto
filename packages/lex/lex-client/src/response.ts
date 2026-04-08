import { LexParseOptions, lexParseJsonBytes } from '@atproto/lex-json'
import {
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
  XrpcInvalidResponseError,
  XrpcResponseError,
  XrpcResponseValidationError,
} from './errors.js'
import {
  EncodingString,
  XrpcUnknownResponsePayload,
  isEncodingString,
} from './types.js'

const CONTENT_TYPE_BINARY = 'application/octet-stream'
const CONTENT_TYPE_JSON = 'application/json'

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
> = TSchema extends Validator
  ? InferOutput<TSchema>
  : TEncoding extends `application/json`
    ? LexValue
    : Uint8Array

/**
 * The body type of an XRPC response, inferred from the method's output schema.
 *
 * For JSON responses, this is the parsed LexValue. For binary responses,
 * this is a Uint8Array.
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 */
export type XrpcResponseBody<M extends Procedure | Query> =
  M['output'] extends Payload<infer TEncoding, infer TSchema>
    ? TEncoding extends string
      ? InferBodyType<TEncoding, TSchema>
      : undefined | LexValue | Uint8Array
    : never

/**
 * The full payload type of an XRPC response, including body and encoding.
 *
 * Returns `null` for methods that have no output.
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 */
export type XrpcResponsePayload<M extends Procedure | Query> =
  M['output'] extends Payload<infer TEncoding, infer TSchema>
    ? TEncoding extends string
      ? {
          encoding: InferEncodingType<TEncoding>
          body: InferBodyType<TEncoding, TSchema>
        }
      : // If the schema does not specify an output encoding, anything could be
        // returned, including no payload at all (undefined).
        undefined | { body: LexValue | Uint8Array; encoding: string }
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
 * Small container for XRPC response data.
 *
 * @implements {ResultSuccess<XrpcResponse<M>>} for convenience in result handling contexts.
 */
export class XrpcResponse<M extends Procedure | Query>
  implements ResultSuccess<XrpcResponse<M>>
{
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
    readonly payload: XrpcResponsePayload<M>,
  ) {}

  /**
   * Whether the response payload was parsed as {@link LexValue} (`true`) or is
   * in binary form {@link Uint8Array} (`false`).
   */
  get isParsed() {
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
   * For binary responses, this is a Uint8Array.
   * Returns `undefined` if the response has no body.
   */
  get body() {
    return this.payload?.body as XrpcResponseBody<M>
  }

  /**
   * @throws {XrpcResponseError} in case of (valid) XRPC error responses. Use
   * {@link XrpcResponseError.matchesSchemaErrors} to narrow the error type based on
   * the method's declared error schema. This can be narrowed further as a
   * {@link XrpcAuthenticationError} if the error is an authentication error.
   * @throws {XrpcInvalidResponseError} when the response is not a valid XRPC
   * response, or if the response does not conform to the method's schema.
   */
  static async fromFetchResponse<const M extends Procedure | Query>(
    method: M,
    response: Response,
    options?: XrpcResponseOptions,
  ): Promise<XrpcResponse<M>> {
    // @NOTE The body MUST either be read or canceled to avoid resource leaks.
    // Since nothing should cause an exception before "readPayload" is
    // called, we can safely not use a try/finally here.

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
      await response.body?.cancel()

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
    })

    if (!method.output.matchesEncoding(payload?.encoding)) {
      throw new XrpcInvalidResponseError(
        method,
        response,
        payload,
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
            payload,
            result.reason,
          )
        }

        const parsedPayload = {
          body: result.value,
          encoding: payload.encoding,
        } as XrpcResponsePayload<M>

        return new XrpcResponse<M>(
          method,
          response.status,
          response.headers,
          parsedPayload,
        )
      }
    }

    return new XrpcResponse<M>(
      method,
      response.status,
      response.headers,
      payload as XrpcResponsePayload<M>,
    )
  }
}

type ReadPayloadOptions = {
  /**
   * Whether to parse the response body as JSON and convert it to LexValue.
   *
   * @default false
   */
  parse?: false | LexParseOptions
}

/**
 * @note this function always consumes the response body
 */
async function readPayload(
  method: Query | Procedure,
  response: Response,
  options?: ReadPayloadOptions,
): Promise<undefined | XrpcUnknownResponsePayload> {
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
      const arrayBuffer = await response.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const body = lexParseJsonBytes(bytes, options.parse)
      return { encoding, body }
    }

    const arrayBuffer = await response.arrayBuffer()
    return { encoding, body: new Uint8Array(arrayBuffer) }
  } catch (cause) {
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

function stringifyEncoding(encoding: string | undefined) {
  return encoding ? `"${encoding}"` : 'no payload'
}
