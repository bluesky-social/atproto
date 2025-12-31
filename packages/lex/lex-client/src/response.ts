import { lexParse } from '@atproto/lex-json'
import {
  InferMethodOutputBody,
  InferMethodOutputEncoding,
  Procedure,
  Query,
  ResultSuccess,
} from '@atproto/lex-schema'
import {
  LexRpcResponseError,
  LexRpcUpstreamError,
  isLexRpcErrorPayload,
} from './errors.js'
import { Payload } from './util.js'

export type LexRpcResponseBody<M extends Procedure | Query> =
  InferMethodOutputBody<M, Uint8Array>

export type LexRpcResponsePayload<M extends Procedure | Query> =
  InferMethodOutputEncoding<M> extends infer E extends string
    ? Payload<LexRpcResponseBody<M>, E>
    : null

/**
 * Small container for XRPC response data.
 *
 * @implements {ResultSuccess<LexRpcResponse<M>>} for convenience in result handling contexts.
 */
export class LexRpcResponse<const M extends Procedure | Query>
  implements ResultSuccess<LexRpcResponse<M>>
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
    readonly payload: LexRpcResponsePayload<M>,
  ) {}

  /**
   * Whether the response payload was parsed as {@link LexValue} (`true`) or is
   * in binary form {@link Uint8Array} (`false`).
   */
  get isParsed() {
    return this.encoding === 'application/json' && shouldParse(this.method)
  }

  get encoding() {
    return this.payload?.encoding as InferMethodOutputEncoding<M>
  }

  get body() {
    return this.payload?.body as LexRpcResponseBody<M>
  }

  /**
   * @throws {LexRpcResponseError} in case of (valid) XRPC error responses. Use
   * {@link LexRpcResponseError.matchesSchema} to narrow the error type based on
   * the method's declared error schema.
   * @throws {LexRpcUpstreamError} when the response is not a valid XRPC
   * response, or if the response does not conform to the method's schema.
   */
  static async fromFetchResponse<const M extends Procedure | Query>(
    method: M,
    response: Response,
    options?: { validateResponse?: boolean },
  ): Promise<LexRpcResponse<M>> {
    // @NOTE The body MUST either be read or canceled to avoid resource leaks.
    // Since nothing should cause an exception before "readPayload" is
    // called, we can safely not use a try/finally here.

    // @NOTE redirect is set to 'follow', so we shouldn't get 3xx responses here
    if (response.status < 200 || response.status >= 300) {
      // Always parse json for error responses
      const payload = await readPayload(response, { parse: true })

      if (response.status >= 400 && isLexRpcErrorPayload(payload)) {
        throw new LexRpcResponseError(
          method,
          response.status,
          response.headers,
          payload,
        )
      }

      if (response.status >= 500) {
        throw new LexRpcUpstreamError(
          'UpstreamFailure',
          `Upstream server encountered an error`,
          response,
          payload,
        )
      }

      throw new LexRpcUpstreamError(
        'InvalidResponse',
        response.status >= 400
          ? `Upstream server returned an invalid response payload`
          : `Upstream server returned an invalid status code`,
        response,
        payload,
      )
    }

    // Only parse json if the schema expects it
    const payload = await readPayload(response, {
      parse: shouldParse(method),
    })

    // Response is successful (2xx). Validate payload (data and encoding) against schema.
    if (method.output.encoding == null) {
      // Schema expects no payload
      if (payload) {
        throw new LexRpcUpstreamError(
          'InvalidResponse',
          `Expected response with no body, got ${payload.encoding}`,
          response,
          payload,
        )
      }
    } else {
      // Schema expects a payload
      if (!payload || !method.output.matchesEncoding(payload.encoding)) {
        throw new LexRpcUpstreamError(
          'InvalidResponse',
          payload
            ? `Expected ${method.output.encoding} response, got ${payload.encoding}`
            : `Expected non-empty response with content-type ${method.output.encoding}`,
          response,
          payload,
        )
      }

      // Assert valid response body.
      if (method.output.schema && options?.validateResponse !== false) {
        const result = method.output.schema.safeParse(payload.body, {
          allowTransform: false,
        })

        if (!result.success) {
          throw new LexRpcUpstreamError(
            'InvalidResponse',
            `Response validation failed: ${result.reason.message}`,
            response,
            payload,
            { cause: result.reason },
          )
        }
      }
    }

    return new LexRpcResponse<M>(
      method,
      response.status,
      response.headers,
      payload as LexRpcResponsePayload<M>,
    )
  }
}

function shouldParse(method: Procedure | Query) {
  return method.output.encoding === 'application/json'
}

/**
 * @note this function always consumes the response body
 */
async function readPayload(
  response: Response,
  options?: { parse?: boolean },
): Promise<Payload | null> {
  // @TODO Should we limit the maximum response size here (this could also be
  // done by the FetchHandler)?

  const encoding = response.headers
    .get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase()

  // Response content-type is undefined
  if (!encoding) {
    // If the body is empty, return null (= no payload)
    const body = await response.arrayBuffer()
    if (body.byteLength === 0) return null

    // If we got data despite no content-type, treat it as binary
    return {
      encoding: 'application/octet-stream',
      body: new Uint8Array(body),
    }
  }

  if (options?.parse && encoding === 'application/json') {
    // @NOTE It might be worth returning the raw bytes here (Uint8Array) and
    // perform the lex parsing using cborg/json, allowing to do
    // bytes->LexValue in one step instead of bytes->text->JSON->LexValue.
    // This would require adding encode/decode utilities to lex-json (similar
    // to @ipld/dag-json)
    const text = await response.text()

    try {
      // @NOTE Using `lexParse(text)` (instead of `jsonToLex(json)`) here as
      // using a reviver function during JSON.parse should be faster than
      // parsing to JSON then converting to Lex (?)

      // @TODO verify statement above
      return { encoding, body: lexParse(text) }
    } catch (cause) {
      throw new LexRpcUpstreamError(
        'InvalidResponse',
        'Invalid JSON response body',
        response,
        null,
        { cause },
      )
    }
  }

  return { encoding, body: new Uint8Array(await response.arrayBuffer()) }
}
