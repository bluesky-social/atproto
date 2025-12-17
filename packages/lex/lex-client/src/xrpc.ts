import { LexValue, isLexScalar, isPlainObject } from '@atproto/lex-data'
import { lexStringify } from '@atproto/lex-json'
import {
  InferMethodInput,
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
import { BinaryBodyInit, CallOptions, Namespace, getMain } from './types.js'
import {
  Payload,
  buildAtprotoHeaders,
  isAsyncIterable,
  isBlobLike,
  toReadableStream,
} from './util.js'
import { XrpcResponseError, XrpcUnexpectedError } from './xrpc-error.js'
import { XrpcResponse } from './xrpc-response.js'

export * from './xrpc-error.js'
export * from './xrpc-response.js'

// If all params are optional, allow omitting the params object
type XrpcParamsOptions<P extends Params> =
  NonNullable<unknown> extends P ? { params?: P } : { params: P }

type XrpcRequestPayload<M extends Procedure | Query> = InferMethodInput<
  M,
  BinaryBodyInit
>

type XrpcInputOptions<In> = In extends { body: infer B; encoding: infer E }
  ? // encoding will be inferred from the schema at runtime if not provided
    { body: B; encoding?: E }
  : { body?: undefined; encoding?: undefined }

export type XrpcOptions<M extends Procedure | Query = Procedure | Query> =
  CallOptions &
    XrpcInputOptions<XrpcRequestPayload<M>> &
    XrpcParamsOptions<InferMethodParams<M>>

export type XrpcFailure<M extends Procedure | Query> =
  // An unexpected error occurred (e.g., network error, invalid response, etc.)
  | XrpcUnexpectedError
  // The server responded with a declared error.
  | (M extends { errors: readonly (infer N extends string)[] }
      ? XrpcResponseError<N>
      : never)

export type XrpcResult<M extends Procedure | Query> =
  | XrpcResponse<M>
  | XrpcFailure<M>

/**
 * Utility method to type cast the error thrown by {@link xrpc} to an
 * {@link XrpcFailure} matching the provided method. Only use this function
 * inside a catch block right after calling {@link xrpc}, and use the same
 * method type parameter as used in the {@link xrpc} call.
 *
 * @example
 *
 * ```ts
 * import { xrpc, asXrpcFailure } from '@atproto/lex'
 * import { app } from './lexicons.ts'
 *
 * const method = app.bsky.feed.getAuthorFeed.main
 * const result = await xrpc(agent, method, { params: { actor: 'alice' } }).catch(asXrpcFailure<typeof method>)
 *
 * if (result.success) {
 *   // Handle success
 * } else {
 *   // Handle failure
 *   if (result.error === "Unknown") {
 *     // Unable to perform the request
 *     const { reason } = result
 *     if (reason instanceof XrpcResponseError) {
 *       // The server returned a syntactically valid XRPC error response, but
 *       // used an error code that is not declared for this method
 *       reason.error // string (e.g. "AuthenticationRequired", "RateLimitExceeded", etc.)
 *       reason.message // string
 *       reason.status // number
 *       reason.headers // Headers
 *       reason.payload // { body: { error: string, message?: string }; encoding: string }
 *     } else if (reason instanceof XrpcInvalidResponseError) {
 *       // The response was incomplete (e.g. connection dropped), or
 *       // invalid (e.g. malformed JSON, data does not match schema).
 *       reason.error // "InvalidResponse"
 *       reason.message // string
 *       reason.response.status // number
 *       reason.response.headers // Headers
 *       reason.response.payload // null | { body: unknown; encoding: string }
 *     } else {
 *       reason // unknown (fetch failed)
 *     }
 *   } else {
 *     // A declared error for that method
 *     result // XrpcResponseError<'NotFound' | 'Unauthorized' | ...>
 *   }
 * }
 * ```
 */
export function asXrpcFailure<M extends Procedure | Query>(
  reason: unknown,
): XrpcFailure<M> {
  if (reason instanceof XrpcUnexpectedError) return reason
  // Here, we assume the caller is using this utility correctly, meaning that
  // the error was created while processing a request for method M, allowing us
  // to safely cast it.
  if (reason instanceof XrpcResponseError) return reason as XrpcFailure<M>
  throw reason
}

/**
 * @throws XrpcFailure<M>
 * @see {@link asXrpcFailure} to transform the promise rejection into an
 * {@link XrpcFailure<M>} value matching the provided method.
 */
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
  const method = getMain(ns)
  try {
    options.signal?.throwIfAborted()
    const url = xrpcRequestUrl(method, options)
    const request = xrpcRequestInit(method, options)
    const response = await agent.fetchHandler(url, request)
    return XrpcResponse.fromFetchResponse<M>(method, response, options)
  } catch (err) {
    if (!(err instanceof XrpcResponseError)) {
      throw XrpcUnexpectedError.from(err)
    }

    if (!method.errors?.includes(err.error)) {
      throw XrpcUnexpectedError.from(err)
    }

    throw err
  }
}

export async function xrpcSafe<const M extends Query | Procedure>(
  agent: Agent,
  ns: NonNullable<unknown> extends XrpcOptions<M>
    ? Namespace<M>
    : Restricted<'This XRPC method requires an "options" argument'>,
): Promise<XrpcResult<M>>
export async function xrpcSafe<const M extends Query | Procedure>(
  agent: Agent,
  ns: Namespace<M>,
  options: XrpcOptions<M>,
): Promise<XrpcResult<M>>
export async function xrpcSafe<const M extends Query | Procedure>(
  agent: Agent,
  ns: Namespace<M>,
  options: XrpcOptions<M> = {} as XrpcOptions<M>,
): Promise<XrpcResult<M>> {
  return xrpc<M>(agent, ns, options).catch(asXrpcFailure<M>)
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
  options: CallOptions & {
    body?: LexValue | BinaryBodyInit
    encoding?: string
  },
): RequestInit & { duplex?: 'half' } {
  const headers = buildAtprotoHeaders(options)

  // Tell the server what type of response we're expecting
  if (schema.output.encoding) {
    headers.set('accept', schema.output.encoding)
  }

  // Caller should not set content-type header
  if (headers.has('content-type')) {
    const contentType = headers.get('content-type')
    throw new TypeError(`Unexpected content-type header (${contentType})`)
  }

  // Requests with body
  if ('input' in schema) {
    const encodingHint = options.encoding
    const input = xrpcProcedureInput(schema, options, encodingHint)

    if (input) {
      headers.set('content-type', input.encoding)
    } else if (encodingHint != null) {
      throw new TypeError(`Unexpected encoding hint (${encodingHint})`)
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
  encodingHint?: string,
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

    return buildPayload(input, lexStringify(body), encodingHint)
  }

  // Other encodings will be sent unaltered (ie. as binary data)
  switch (typeof body) {
    case 'undefined':
    case 'string':
      return buildPayload(input, body, encodingHint)
    case 'object': {
      if (body === null) break
      if (
        ArrayBuffer.isView(body) ||
        body instanceof ArrayBuffer ||
        body instanceof ReadableStream
      ) {
        return buildPayload(input, body, encodingHint)
      } else if (isAsyncIterable(body)) {
        return buildPayload(input, toReadableStream(body), encodingHint)
      } else if (isBlobLike(body)) {
        return buildPayload(input, body, encodingHint || body.type)
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
  encodingHint?: string,
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
    throw new TypeError(`A request body is expected but none was provided`)
  }

  const encoding = buildEncoding(schema, encodingHint)
  return { encoding, body }
}

function buildEncoding(schema: LexPayload, encodingHint?: string): string {
  // Should never happen (required for type safety)
  if (!schema.encoding) {
    throw new TypeError('Unexpected payload')
  }

  if (encodingHint?.length) {
    if (!schema.matchesEncoding(encodingHint)) {
      throw new TypeError(
        `Cannot send a body with content-type "${encodingHint}" for "${schema.encoding}" encoding`,
      )
    }
    return encodingHint
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
