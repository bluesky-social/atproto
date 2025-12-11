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
import { XrpcResponse } from './response.js'
import { BinaryBodyInit, CallOptions, Namespace, getMain } from './types.js'
import {
  Payload,
  buildAtprotoHeaders,
  encodingMatches,
  isAsyncIterable,
  isBlobLike,
  toReadableStream,
} from './util.js'

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
  schema: { input: LexPayload },
  options: CallOptions & { body?: LexValue | BinaryBodyInit },
  contentType?: string,
): null | Payload<BodyInit> {
  const data = options.body
  const { encoding } = schema.input

  if (encoding === undefined) {
    if (data !== undefined) {
      throw new TypeError(
        `Cannot send a ${typeof data} body with undefined encoding`,
      )
    }

    return null
  }

  if (data === undefined) {
    // This error would be returned by the server, but we can catch it earlier
    // to avoid un-necessary requests. Note that a content-length of 0 does not
    // necessary mean that the body is "empty" (e.g. an empty txt file).
    throw new XrpcError(
      KnownError.InvalidRequest,
      `A request body is expected but none was provided`,
    )
  }

  if (encoding === 'application/json') {
    if (contentType != null && contentType !== 'application/json') {
      throw new TypeError(
        `Cannot send a body with content-type "${contentType}" for "application/json" encoding`,
      )
    }

    // @NOTE Not using isLexValue because we don't need to deep-check here (pref)
    // @NOTE Not using !isBodyInit because strings and Uint8Arrays are allowed
    if (isLexScalar(data) || isPlainObject(data) || Array.isArray(data)) {
      return {
        encoding: 'application/json; charset=utf-8',
        body: lexStringify(
          options.validateRequest && schema.input.schema
            ? schema.input.schema.parse(data)
            : data,
        ),
      }
    }
  } else {
    switch (typeof data) {
      case 'string':
        return {
          body: data,
          encoding: buildEncoding(encoding, contentType),
        }
      case 'object': {
        if (
          ArrayBuffer.isView(data) ||
          data instanceof ArrayBuffer ||
          data instanceof ReadableStream
        ) {
          return {
            body: data,
            encoding: buildEncoding(encoding, contentType),
          }
        } else if (isAsyncIterable(data)) {
          return {
            body: toReadableStream(data),
            encoding: buildEncoding(encoding, contentType),
          }
        } else if (isBlobLike(data)) {
          return {
            body: data,
            encoding: buildEncoding(encoding, contentType || data.type),
          }
        }
      }
    }
  }

  throw new TypeError(`Invalid ${typeof data} body for ${encoding} encoding`)
}

function buildEncoding(encoding: string, contentType?: string) {
  if (contentType?.length) {
    const mime = contentType.split(';')[0].trim()
    if (encodingMatches(encoding, mime)) return contentType
    throw new TypeError(
      `Invalid content-type "${contentType}" for ${encoding} encoding`,
    )
  }

  // Fallback

  if (encoding === '*/*') {
    return 'application/octet-stream'
  }

  if (encoding.startsWith('text/')) {
    return encoding.includes('*')
      ? 'text/plain; charset=utf-8'
      : `${encoding}; charset=utf-8`
  }

  if (encoding.includes('*')) {
    throw new TypeError(`Cannot determine content-type for body`)
  }

  return encoding
}
