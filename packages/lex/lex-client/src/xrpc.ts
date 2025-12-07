import { LexValue } from '@atproto/lex-data'
import { lexParse, lexStringify } from '@atproto/lex-json'
import {
  DidString,
  InferParamsSchema,
  InferPayloadBody,
  Params,
  ParamsSchema,
  Procedure,
  Query,
  Restricted,
  Subscription,
} from '@atproto/lex-schema'
import { Agent } from './agent.js'
import {
  KnownError,
  XrpcResponseError,
  XrpcServiceError,
  xrpcErrorBodySchema,
} from './error.js'
import { XrpcResponse, XrpcResponseBody } from './response.js'
import { CallOptions, Namespace, Service, getMain } from './types.js'

export type XrpcOptions<M extends Procedure | Query = Procedure | Query> =
  CallOptions & XrpcRequestUrlOptions<M> & XrpcRequestInitOptions<M>

export async function xrpc<const M extends Query | Procedure>(
  agent: Agent,
  ns: NonNullable<unknown> extends XrpcOptions<M>
    ? Namespace<M>
    : Restricted<'This XRPC method requires an "options" argument'>,
): Promise<XrpcResponse<M>>
export async function xrpc<const M extends Query | Procedure>(
  agent: Agent,
  ns: Namespace<M>,
  options: XrpcOptions<M>,
): Promise<XrpcResponse<M>>
export async function xrpc<const M extends Query | Procedure>(
  agent: Agent,
  ns: Namespace<M>,
  options: XrpcOptions<M> = {} as XrpcOptions<M>,
): Promise<XrpcResponse<M>> {
  options.signal?.throwIfAborted()
  const method = getMain(ns)
  const url = xrpcRequestUrl(method, options)
  const request = xrpcRequestInit(method, options)
  const response = await agent.fetchHandler(url, request)
  return xrpcResponseHandler<M>(response, method, options)
}

export type XrpcRequestUrlOptions<M extends Query | Procedure | Subscription> =
  CallOptions &
    (undefined extends InferParamsSchema<M['parameters']>
      ? { params?: InferParamsSchema<M['parameters']> }
      : { params: InferParamsSchema<M['parameters']> })

export function xrpcRequestUrl<M extends Procedure | Query | Subscription>(
  method: M,
  options: XrpcRequestUrlOptions<M>,
) {
  const path = `/xrpc/${method.nsid}`

  const queryString = options.params
    ? xrpcRequestParams(method.parameters, options.params, options)
    : undefined

  return queryString ? `${path}?${queryString}` : path
}

export function xrpcRequestParams(
  schema: ParamsSchema | undefined,
  params: Params | undefined,
  options: CallOptions,
): undefined | string {
  const urlSearchParams = schema?.toURLSearchParams(
    options.validateRequest ? schema.parse(params) : (params as any),
  )
  return urlSearchParams?.size ? urlSearchParams.toString() : undefined
}

export type XrpcRequestInitOptions<T extends Query | Procedure> = CallOptions &
  (T extends Procedure
    ? never extends InferPayloadBody<T['input']>
      ? { body?: InferPayloadBody<T['input']> }
      : { body: InferPayloadBody<T['input']> }
    : { body?: never })

export function xrpcRequestInit<T extends Procedure | Query>(
  schema: T,
  options: XrpcRequestInitOptions<T>,
): RequestInit & { duplex?: 'half' } {
  const headers = xrpcRequestHeaders(options)

  // Requests with body
  if ('input' in schema && schema.input?.encoding) {
    if (
      options.validateRequest &&
      schema.input == null &&
      options.body !== undefined
    ) {
      throw new TypeError(
        `XRPC method ${schema.nsid} does not accept a request body`,
      )
    }

    headers.set('content-type', schema.input.encoding)
    return {
      duplex: 'half',
      redirect: 'follow',
      referrerPolicy: 'strict-origin-when-cross-origin', // (default)
      mode: 'cors', // (default)
      signal: options.signal,
      method: 'POST',
      headers,
      body: xrpcRequestBody(
        schema.input?.encoding,
        options.validateRequest
          ? schema.input?.body.parse(options.body)
          : options.body,
      ),
    }
  }

  // Requests without body
  return {
    duplex: 'half',
    redirect: 'follow',
    referrerPolicy: 'strict-origin-when-cross-origin', // (default)
    mode: 'cors', // (default)
    signal: options.signal,
    method: schema instanceof Query ? 'GET' : 'POST',
    headers,
  }
}

export function xrpcRequestHeaders(options: {
  headers?: HeadersInit
  service?: Service
  labelers?: Iterable<DidString>
}): Headers {
  const headers = new Headers(options.headers)

  if (options.service && !headers.has('atproto-proxy')) {
    headers.set('atproto-proxy', options.service)
  }

  if (options.labelers) {
    headers.set(
      'atproto-accept-labelers',
      [...options.labelers, headers.get('atproto-accept-labelers')?.trim()]
        .filter(Boolean)
        .join(', '),
    )
  }

  return headers
}

function xrpcRequestBody(
  encoding: string | undefined,
  body: LexValue | undefined,
): BodyInit | null {
  if (encoding === undefined) {
    return null
  }

  if (encoding === 'application/json') {
    if (body !== undefined) return lexStringify(body)
  } else if (encoding.startsWith('text/')) {
    if (typeof body === 'string') return body
  } else {
    if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer) return body
  }

  throw new TypeError(`Invalid ${typeof body} body for ${encoding} encoding`)
}

export async function xrpcResponseHandler<M extends Procedure | Query>(
  response: Response,
  schema: M,
  options?: { validateResponse?: boolean },
): Promise<XrpcResponse<M>> {
  // @NOTE The body MUST either be read or canceled to avoid resource leaks.
  // Since nothing should cause an exception before "readXrpcResponseBody" is
  // called, we can safely not use a try/finally here.

  const encoding = extractEncoding(response.headers)

  const body = await readResponseBody(response, encoding).catch((cause) => {
    throw new XrpcServiceError(
      KnownError.InvalidResponse,
      response.status,
      response.headers,
      undefined,
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
      body != null &&
      encoding === 'application/json' &&
      xrpcErrorBodySchema.matches(body)
    ) {
      throw new XrpcResponseError(
        response.status,
        response.headers,
        encoding,
        body,
      )
    }

    throw new XrpcServiceError(
      response.status >= 500
        ? KnownError.InternalServerError
        : KnownError.InvalidResponse,
      response.status,
      response.headers,
      body,
    )
  }

  // Check response encoding
  if (schema.output.encoding !== encoding) {
    throw new XrpcServiceError(
      KnownError.InvalidResponse,
      response.status,
      response.headers,
      body,
      `Expected response with content-type ${schema.output.encoding}, got ${encoding}`,
    )
  }

  if (schema.output.encoding == null) {
    if (body !== undefined) {
      throw new XrpcServiceError(
        KnownError.InvalidResponse,
        response.status,
        response.headers,
        body,
        `Expected empty response body`,
      )
    }

    return new XrpcResponse<M>(
      schema,
      response.status,
      response.headers,
      undefined as XrpcResponseBody<M>,
    )
  } else {
    // @NOTE this should already be enforced by readXrpcResponseBody
    if (body === undefined) {
      throw new XrpcServiceError(
        KnownError.InvalidResponse,
        response.status,
        response.headers,
        body,
        `Expected non-empty response body`,
      )
    }

    return new XrpcResponse<M>(
      schema,
      response.status,
      response.headers,
      schema.output.schema == null || options?.validateResponse === false
        ? (body as XrpcResponseBody<M>)
        : (schema.output.schema.parse(body) as XrpcResponseBody<M>),
    )
  }
}

export function extractEncoding(headers: Headers): string | undefined {
  const contentType = headers.get('content-type')
  if (!contentType) return undefined
  return contentType.split(';')[0].trim()
}

export async function readResponseBody(
  response: Response,
  encoding: string,
): Promise<LexValue>
export async function readResponseBody(
  response: Response,
  encoding: string | undefined,
): Promise<LexValue | undefined>
export async function readResponseBody(
  response: Response,
  encoding: string | undefined,
): Promise<LexValue | undefined> {
  // When encoding is undefined or empty, we expect no body
  if (encoding == null) {
    if (response.body == null) return undefined

    // Let's make sure the body is empty (while avoiding reading it all).
    if (!('getReader' in response.body)) {
      // Some environments may not support body.getReader(), fall back to
      // reading the whole body.
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0) return undefined
    } else {
      const reader = response.body.getReader()
      const next = await reader.read()
      if (next.done) return undefined
      await reader.cancel() // Drain the rest of the (non-empty) body stream
    }

    throw new SyntaxError('Content-type is undefined but body is not empty')
  }

  if (encoding === 'application/json') {
    // @NOTE Using `lexParse(text)` (instead of `jsonToLex(json)`) here as using
    // a reviver function during JSON.parse should be faster than parsing to
    // JSON then converting to Lex (?)

    // @TODO verify statement above
    return lexParse(await response.text())
  }

  if (encoding.startsWith('text/')) {
    return response.text()
  }

  return new Uint8Array(await response.arrayBuffer())
}
