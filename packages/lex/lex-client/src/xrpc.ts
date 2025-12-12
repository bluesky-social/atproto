import { LexValue, isLexScalar, isPlainObject } from '@atproto/lex-data'
import { lexStringify } from '@atproto/lex-json'
import {
  InferMethodInputBody,
  InferMethodParams,
  Params,
  ParamsSchema,
  Payload as LexPayload,
  Procedure,
  Query,
  Restricted,
  Subscription,
} from '@atproto/lex-schema'
import { Agent } from './agent.js'
import { KnownError, XrpcError } from './error.js'
import { BinaryBodyInit, CallOptions, Namespace, getMain } from './types.js'
import {
  Payload,
  buildAtprotoHeaders,
  isAsyncIterable,
  isBlobLike,
  toReadableStream,
} from './util.js'
import { XrpcResponse } from './xrpc-response.js'

export * from './xrpc-response.js'

// If all params are optional, allow omitting the params object
type XrpcParamsOptions<P extends Params> =
  NonNullable<unknown> extends P ? { params?: P } : { params: P }

type XrpcRequestBody<M extends Procedure | Query> = InferMethodInputBody<
  M,
  BinaryBodyInit
>

type XrpcBodyOptions<B> = never extends B
  ? { body?: B }
  : undefined extends B
    ? { body?: B }
    : { body: B }

export type XrpcOptions<M extends Procedure | Query = Procedure | Query> =
  CallOptions &
    XrpcBodyOptions<XrpcRequestBody<M>> &
    XrpcParamsOptions<InferMethodParams<M>>

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
  return XrpcResponse.fromFetchResponse<M>(method, response, options)
}

function xrpcRequestUrl<M extends Procedure | Query | Subscription>(
  method: M,
  options: CallOptions & { params?: Params },
) {
  const path = `/xrpc/${method.nsid}`

  const queryString = options.params
    ? xrpcRequestParams(method.parameters, options.params, options)
    : undefined

  return queryString ? `${path}?${queryString}` : path
}

function xrpcRequestParams(
  schema: ParamsSchema | undefined,
  params: Params | undefined,
  options: CallOptions,
): undefined | string {
  const urlSearchParams = schema?.toURLSearchParams(
    options.validateRequest ? schema.parse(params) : (params as any),
  )
  return urlSearchParams?.size ? urlSearchParams.toString() : undefined
}

function xrpcRequestInit<T extends Procedure | Query>(
  schema: T,
  options: CallOptions & { body?: LexValue | BinaryBodyInit },
): RequestInit & { duplex?: 'half' } {
  const headers = buildAtprotoHeaders(options)

  // Tell the server what type of response we're expecting
  if (schema.output.encoding) {
    headers.set('accept', schema.output.encoding)
  }

  // Requests with body
  if ('input' in schema) {
    const contentType = headers.get('content-type') ?? undefined
    const input = xrpcProcedureInput(schema, options, contentType)

    if (input) {
      headers.set('content-type', input.encoding)
    } else if (contentType != null) {
      throw new TypeError(
        `Unexpected 'content-type' header (${contentType}) for empty body`,
      )
    }

    return {
      duplex: 'half',
      redirect: 'follow',
      referrerPolicy: 'strict-origin-when-cross-origin', // (default)
      mode: 'cors', // (default)
      signal: options.signal,
      method: 'POST',
      headers,
      body: input?.body,
    }
  }

  // Requests without body
  return {
    duplex: 'half',
    redirect: 'follow',
    referrerPolicy: 'strict-origin-when-cross-origin', // (default)
    mode: 'cors', // (default)
    signal: options.signal,
    method: 'GET',
    headers,
  }
}

function xrpcProcedureInput(
  method: Procedure,
  options: CallOptions & { body?: LexValue | BinaryBodyInit },
  contentType?: string,
): null | Payload<BodyInit> {
  const { input } = method
  const { body } = options

  if (options.validateRequest) {
    input.schema?.check(body)
  }

  // Special handling for endpoints expecting application/json input
  if (input.encoding === 'application/json') {
    // @NOTE **NOT** using isLexValue here to avoid deep checks in order to
    // distinguish between LexValue and BinaryBodyInit.
    if (!isLexScalar(body) && !isPlainObject(body) && !Array.isArray(body)) {
      throw new TypeError(`Expected LexValue body, got ${typeof body}`)
    }

    return buildPayload(input, lexStringify(body), contentType)
  }

  // Other encodings will be sent unaltered (ie. as binary data)
  switch (typeof body) {
    case 'undefined':
    case 'string':
      return buildPayload(input, body, contentType)
    case 'object': {
      if (body === null) break
      if (
        ArrayBuffer.isView(body) ||
        body instanceof ArrayBuffer ||
        body instanceof ReadableStream
      ) {
        return buildPayload(input, body, contentType)
      } else if (isAsyncIterable(body)) {
        return buildPayload(input, toReadableStream(body), contentType)
      } else if (isBlobLike(body)) {
        return buildPayload(input, body, contentType || body.type)
      }
    }
  }

  throw new TypeError(
    `Invalid ${typeof body} body for ${input.encoding} encoding`,
  )
}

function buildPayload(
  schema: LexPayload,
  body: undefined | BodyInit,
  contentType?: string,
): null | Payload<BodyInit> {
  if (schema.encoding === undefined) {
    if (body !== undefined) {
      throw new TypeError(
        `Cannot send a ${typeof body} body with undefined encoding`,
      )
    }

    return null
  }

  if (body === undefined) {
    // This error would be returned by the server, but we can catch it earlier
    // to avoid un-necessary requests. Note that a content-length of 0 does not
    // necessary mean that the body is "empty" (e.g. an empty txt file).
    throw new XrpcError(
      KnownError.InvalidRequest,
      `A request body is expected but none was provided`,
    )
  }

  const encoding = buildEncoding(schema, contentType)
  return { encoding, body }
}

function buildEncoding(schema: LexPayload, contentType?: string): string {
  // Should never happen (required for type safety)
  if (!schema.encoding) {
    throw new TypeError('Unexpected payload')
  }

  if (contentType?.length) {
    if (!schema.matchesEncoding(contentType)) {
      throw new TypeError(
        `Cannot send a body with content-type "${contentType}" for "${schema.encoding}" encoding`,
      )
    }
    return contentType
  }

  // Fallback

  if (schema.encoding === '*/*') {
    return 'application/octet-stream'
  }

  if (schema.encoding.startsWith('text/')) {
    return schema.encoding.includes('*')
      ? 'text/plain; charset=utf-8'
      : `${schema.encoding}; charset=utf-8`
  }

  if (!schema.encoding.includes('*')) {
    return schema.encoding
  }

  throw new TypeError(
    `Unable to determine payload encoding. Please provide a 'content-type' header matching ${schema.encoding}.`,
  )
}
