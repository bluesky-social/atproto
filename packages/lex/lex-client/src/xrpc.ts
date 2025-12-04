import { LexValue, isLexScalar, isPlainObject } from '@atproto/lex-data'
import { lexStringify } from '@atproto/lex-json'
import {
  InferMethodInputData,
  InferMethodParams,
  Params,
  ParamsSchema,
  Procedure,
  Query,
  Restricted,
  Subscription,
} from '@atproto/lex-schema'
import { Agent } from './agent.js'
import { KnownError, XrpcError } from './error.js'
import { XrpcResponse } from './response.js'
import { BinaryData, CallOptions, Namespace, getMain } from './types.js'
import { buildAtprotoHeaders, isBlobLike } from './util.js'

// If all params are optional, allow omitting the params object
type XrpcParamsOptions<P extends Params> =
  NonNullable<unknown> extends P ? { params?: P } : { params: P }

// If a procedure only allows Uint8Array bodies (and *not* other LexValues), we
// also accept BinaryData
type ToBodyInit<B> = [B] extends [Uint8Array] ? BinaryData : B

type XrpcBodyOptions<B> = never extends B
  ? { body?: B }
  : undefined extends B
    ? { body?: B }
    : { body: B }

export type XrpcOptions<M extends Procedure | Query = Procedure | Query> =
  CallOptions &
    XrpcBodyOptions<ToBodyInit<InferMethodInputData<M>>> &
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
  return XrpcResponse.createFromResponse<M>(method, response, options)
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
  options: CallOptions & { body?: LexValue | BinaryData },
): RequestInit & { duplex?: 'half' } {
  const headers = buildAtprotoHeaders(options)

  // Requests with body
  if ('input' in schema) {
    const input = xrpcProcedureInput(schema, options)

    // @NOTE Caller can override content-type header by setting it explicitly
    if (input?.type !== undefined && !headers.has('content-type')) {
      headers.set('content-type', input.type)
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
  schema: Procedure,
  options: CallOptions & { body?: LexValue | BinaryData },
): null | { body: BodyInit; type: string } {
  const { body } = options
  const { encoding } = schema.input

  if (encoding === undefined) {
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

  if (encoding === 'application/json') {
    // @NOTE Not using isLexValue because we don't need to deep-check here (pref)
    // @NOTE Not using !isBodyInit because strings and Uint8Arrays are allowed
    if (isLexScalar(body) || isPlainObject(body) || Array.isArray(body)) {
      const type = 'application/json; charset=utf-8'
      return {
        body: lexStringify(
          options.validateRequest && schema.input.schema
            ? schema.input.schema.parse(body)
            : body,
        ),
        type,
      }
    }
  } else if (encoding === '*/*' || encoding === 'application/octet-stream') {
    if (
      ArrayBuffer.isView(body) ||
      body instanceof ArrayBuffer ||
      body instanceof ReadableStream
    ) {
      const type = encoding === '*/*' ? 'application/octet-stream' : encoding
      return { body, type }
    }

    if (isBlobLike(body)) {
      const type =
        encoding === '*/*' ? body.type || 'application/octet-stream' : encoding
      return { body, type }
    }

    if (typeof body === 'string') {
      const type =
        encoding === '*/*'
          ? 'text/plain; charset=utf-8'
          : 'application/octet-stream'
      return { body, type }
    }
  } else {
    throw new TypeError(`Unsupported encoding: ${encoding}`)
  }

  throw new TypeError(`Invalid ${typeof body} body for ${encoding} encoding`)
}
