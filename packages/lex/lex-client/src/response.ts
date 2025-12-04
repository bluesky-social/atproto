import { lexParse } from '@atproto/lex-json'
import {
  InferMethodOutputData,
  InferMethodOutputEncoding,
  Procedure,
  Query,
  ResultSuccess,
} from '@atproto/lex-schema'
import {
  KnownError,
  XrpcErrorBody,
  XrpcResponseError,
  XrpcServiceError,
  xrpcErrorBodySchema,
} from './error.js'
import { Payload } from './util.js'

export type XrpcResponsePayload<M extends Procedure | Query> =
  InferMethodOutputEncoding<M> extends infer E extends string
    ? Payload<NonNullable<InferMethodOutputData<M>>, E>
    : null

/**
 * Small container for XRPC response data.
 *
 * @implements {ResultSuccess<XrpcResponse<M>>} for convenience in result handling contexts.
 */
export class XrpcResponse<const M extends Procedure | Query>
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
   * Whether the response payload data was parsed (as string or LexValue) or is
   * raw binary data (Uint8Array).
   */
  get isBinaryData() {
    return this.method.output.encoding === '*/*'
  }

  get encoding() {
    return this.payload?.encoding as InferMethodOutputEncoding<M>
  }

  get data() {
    return this.payload?.data as InferMethodOutputData<M>
  }

  static async createFromResponse<const M extends Procedure | Query>(
    schema: M,
    response: Response,
    options?: { validateResponse?: boolean },
  ): Promise<XrpcResponse<M>> {
    // @NOTE The body MUST either be read or canceled to avoid resource leaks.
    // Since nothing should cause an exception before "readPayload" is
    // called, we can safely not use a try/finally here.

    const payload = await readPayload(response, {
      asBinaryData: schema.output.encoding === '*/*',
    }).catch((cause) => {
      throw new XrpcServiceError(
        KnownError.InvalidResponse,
        response.status,
        response.headers,
        null,
        'Failed to read XRPC response',
        { cause },
      )
    })

    // @NOTE redirect is set to 'follow', so we shouldn't get 3xx responses here
    if (response.status < 200 || response.status >= 300) {
      // All unsuccessful responses should follow a standard error response
      // schema. The Content-Type should be application/json, and the payload
      // should be a JSON object with the following fields:
      // - error (string, required): type name of the error (generic ASCII
      //   constant, no whitespace)
      // - message (string, optional): description of the error, appropriate for
      //   display to humans
      if (
        payload !== null &&
        payload.encoding === 'application/json' &&
        xrpcErrorBodySchema.matches(payload.data)
      ) {
        throw new XrpcResponseError(
          response.status,
          response.headers,
          payload as Payload<XrpcErrorBody>,
        )
      }

      throw new XrpcServiceError(
        response.status >= 500
          ? KnownError.InternalServerError
          : KnownError.InvalidResponse,
        response.status,
        response.headers,
        payload,
      )
    }

    // Response is successful (2xx). Validate payload (data and encoding) against schema.
    if (schema.output.encoding == null) {
      // Schema expects no payload
      if (payload) {
        throw new XrpcServiceError(
          KnownError.InvalidResponse,
          response.status,
          response.headers,
          payload,
          `Expected response with no body, got ${payload.encoding}`,
        )
      }
    } else {
      // Schema expects a payload
      if (
        !payload ||
        !encodingMatches(schema.output.encoding, payload.encoding)
      ) {
        throw new XrpcServiceError(
          KnownError.InvalidResponse,
          response.status,
          response.headers,
          payload,
          payload
            ? `Expected ${schema.output.encoding} response, got ${payload.encoding}`
            : `Expected non-empty response with content-type ${schema.output.encoding}`,
        )
      }

      // Assert valid response body.
      if (schema.output.schema && options?.validateResponse !== false) {
        const result = schema.output.schema.safeParse(payload.data, {
          allowTransform: false,
        })

        if (!result.success) {
          throw new XrpcServiceError(
            KnownError.InvalidResponse,
            response.status,
            response.headers,
            payload,
            `Response validation failed: ${result.error.message}`,
            { cause: result.error },
          )
        }
      }
    }

    return new XrpcResponse<M>(
      schema,
      response.status,
      response.headers,
      payload as XrpcResponsePayload<M>,
    )
  }
}

/**
 * @note this function always consumes the response body
 */
async function readPayload(
  response: Response,
  options: { asBinaryData: boolean },
): Promise<Payload | null> {
  const encoding = response.headers.get('content-type')?.split(';')[0].trim()

  // Response content-type is undefined
  if (encoding == null) {
    // If there is no body, return null (= no payload)
    if (response.body == null) return null

    // If the body is empty, return null (= no payload)
    const body = await response.arrayBuffer()
    if (body.byteLength === 0) return null

    // If we got data despite no content-type, treat it as binary
    return { encoding: 'application/octet-stream', data: new Uint8Array(body) }
  }

  if (!options.asBinaryData) {
    if (encoding === 'application/json') {
      // @NOTE Using `lexParse(text)` (instead of `jsonToLex(json)`) here as using
      // a reviver function during JSON.parse should be faster than parsing to
      // JSON then converting to Lex (?)

      // @TODO verify statement above
      return { encoding, data: lexParse(await response.text()) }
    }

    if (encoding.startsWith('text/')) {
      return { encoding, data: await response.text() }
    }
  }

  return { encoding, data: new Uint8Array(await response.arrayBuffer()) }
}

function encodingMatches(
  accept: string | undefined,
  actual: string | undefined,
): boolean {
  // Handle undefined cases
  if (accept === undefined) {
    // Expecting no body
    return actual === undefined
  } else if (!actual) {
    // Expecting a body, but got no content-type
    return false
  }

  if (accept === '*/*') {
    return true
  }

  if (accept.endsWith('/*')) {
    return actual.startsWith(accept.slice(0, -1))
  }

  // Invalid: Lexicon can only specify "*/*" or "type/*" wildcards
  if (accept.includes('*')) {
    return false
  }

  return accept === actual
}
