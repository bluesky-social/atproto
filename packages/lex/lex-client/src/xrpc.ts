import { LexValue, isLexScalar, isPlainObject } from '@atproto/lex-data'
import { lexStringify } from '@atproto/lex-json'
import {
  InferInput,
  InferPayload,
  Main,
  Params,
  Payload,
  Procedure,
  Query,
  Restricted,
  Subscription,
  getMain,
} from '@atproto/lex-schema'
import { Agent } from './agent.js'
import { XrpcFailure, asXrpcFailure } from './errors.js'
import { XrpcResponse } from './response.js'
import { BinaryBodyInit, CallOptions } from './types.js'
import {
  buildAtprotoHeaders,
  isAsyncIterable,
  isBlobLike,
  toReadableStream,
} from './util.js'

// If all params are optional, allow omitting the params object
type XrpcParamsOptions<P extends Params> =
  NonNullable<unknown> extends P ? { params?: P } : { params: P }

/**
 * The query/path parameters type for an XRPC method, inferred from its schema.
 *
 * @typeParam M - The XRPC method type (Procedure, Query, or Subscription)
 */
export type XrpcRequestParams<M extends Procedure | Query | Subscription> =
  InferInput<M['parameters']>

type XrpcRequestPayload<M extends Procedure | Query> = M extends Procedure
  ? InferPayload<M['input'], BinaryBodyInit>
  : undefined

type XrpcInputOptions<In> = In extends { body: infer B; encoding: infer E }
  ? // encoding will be inferred from the schema at runtime if not provided
    { body: B; encoding?: E }
  : { body?: undefined; encoding?: undefined }

/**
 * Options for making an XRPC request.
 *
 * Combines {@link CallOptions} with method-specific params and body requirements.
 * The type system ensures required params/body are provided based on the method schema.
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 * @see {@link CallOptions} for general request options like signal and validateRequest
 * @see {@link XrpcParamsOptions} for method-specific query parameters
 * @see {@link XrpcInputOptions} for method-specific body and encoding requirements
 *
 * @example Query with params
 * ```typescript
 * const options: XrpcOptions<typeof app.bsky.feed.getTimeline.main> = {
 *   params: { limit: 50 }
 * }
 * ```
 *
 * @example Procedure with body
 * ```typescript
 * const options: XrpcOptions<typeof com.atproto.repo.createRecord.main> = {
 *   body: { repo: did, collection: 'app.bsky.feed.post', record: { ... } }
 * }
 * ```
 */
export type XrpcOptions<M extends Procedure | Query = Procedure | Query> =
  CallOptions &
    XrpcInputOptions<XrpcRequestPayload<M>> &
    XrpcParamsOptions<XrpcRequestParams<M>>

/**
 * Makes an XRPC request and throws on failure.
 *
 * This is the low-level function for making XRPC calls. For most use cases,
 * prefer using {@link Client.xrpc} which provides a more ergonomic API.
 *
 * @param agent - The {@link Agent} to use for making the request
 * @param ns - The lexicon method definition
 * @param options - Request {@link XrpcOptions options} (params, body, headers, etc.)
 * @returns The successful {@link XrpcResponse}
 * @throws {XrpcFailure} When the request fails
 *
 * @example
 * ```typescript
 * const response = await xrpc(agent, app.bsky.feed.getTimeline.main, {
 *   params: { limit: 50 }
 * })
 * ```
 */
export async function xrpc<const M extends Query | Procedure>(
  agent: Agent,
  ns: NonNullable<unknown> extends XrpcOptions<M>
    ? Main<M>
    : Restricted<'This XRPC method requires an "options" argument'>,
): Promise<XrpcResponse<M>>
export async function xrpc<const M extends Query | Procedure>(
  agent: Agent,
  ns: Main<M>,
  options: XrpcOptions<M>,
): Promise<XrpcResponse<M>>
export async function xrpc<const M extends Query | Procedure>(
  agent: Agent,
  ns: Main<M>,
  options: XrpcOptions<M> = {} as XrpcOptions<M>,
): Promise<XrpcResponse<M>> {
  const response = await xrpcSafe<M>(agent, ns, options)
  if (response.success) return response
  else throw response
}

/**
 * Union type representing either a successful response or a failure.
 *
 * Both {@link XrpcResponse} and {@link XrpcFailure} have a `success` property
 * that can be used to discriminate between them.
 *
 * @typeParam M - The XRPC method type
 */
export type XrpcResult<M extends Procedure | Query> =
  | XrpcResponse<M>
  | XrpcFailure<M>

/**
 * Makes an XRPC request without throwing on failure.
 *
 * Returns a discriminated union that can be checked via the `success` property.
 * This is useful for handling errors without try/catch blocks. This also allow
 * failure results to be typed with the method schema, which can provide better
 * type safety when handling errors (e.g. checking for specific error codes).
 *
 * @param agent - The {@link Agent} to use for making the request
 * @param ns - The lexicon method definition
 * @param options - Request {@link XrpcOptions options} (params, body, headers, etc.)
 * @returns Either a successful {@link XrpcResponse} or an {@link XrpcFailure}
 *
 * @example
 * ```typescript
 * const result = await xrpcSafe(agent, app.bsky.actor.getProfile.main, {
 *   params: { actor: 'alice.bsky.social' }
 * })
 *
 * if (result.success) {
 *   console.log(result.body.displayName)
 * } else {
 *   console.error('Request failed:', result.error)
 * }
 * ```
 */
export async function xrpcSafe<const M extends Query | Procedure>(
  agent: Agent,
  ns: NonNullable<unknown> extends XrpcOptions<M>
    ? Main<M>
    : Restricted<'This XRPC method requires an "options" argument'>,
): Promise<XrpcResult<M>>
export async function xrpcSafe<const M extends Query | Procedure>(
  agent: Agent,
  ns: Main<M>,
  options: XrpcOptions<M>,
): Promise<XrpcResult<M>>
export async function xrpcSafe<const M extends Query | Procedure>(
  agent: Agent,
  ns: Main<M>,
  options: XrpcOptions<M> = {} as XrpcOptions<M>,
): Promise<XrpcResult<M>> {
  options.signal?.throwIfAborted()
  const method: M = getMain(ns)
  try {
    const url = xrpcRequestUrl(method, options)
    const request = xrpcRequestInit(method, options)
    const response = await agent.fetchHandler(url, request)
    return await XrpcResponse.fromFetchResponse<M>(method, response, options)
  } catch (cause) {
    return asXrpcFailure(method, cause)
  }
}

function xrpcRequestUrl<M extends Procedure | Query | Subscription>(
  method: M,
  options: CallOptions & { params?: Params },
) {
  const path = `/xrpc/${method.nsid}`

  const queryString = method.parameters
    ?.toURLSearchParams(options.params ?? {})
    .toString()

  return queryString ? `${path}?${queryString}` : path
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
): null | { body: BodyInit; encoding: string } {
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
  schema: Payload,
  body: undefined | BodyInit,
  encodingHint?: string,
): null | { body: BodyInit; encoding: string } {
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

function buildEncoding(schema: Payload, encodingHint?: string): string {
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
