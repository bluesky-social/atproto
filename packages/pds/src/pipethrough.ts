import express from 'express'
import { IncomingHttpHeaders, ServerResponse } from 'node:http'
import { PassThrough, pipeline, Readable } from 'node:stream'
import { Dispatcher } from 'undici'

import {
  createDecoders,
  decodeStream,
  getServiceEndpoint,
  omit,
  streamToNodeBuffer,
} from '@atproto/common'
import { ResponseType, XRPCError as XRPCClientError } from '@atproto/xrpc'
import {
  CatchallHandler,
  HandlerPipeThroughBuffer,
  HandlerPipeThroughStream,
  InternalServerError,
  InvalidRequestError,
  parseReqNsid,
  XRPCError as XRPCServerError,
} from '@atproto/xrpc-server'

import AppContext from './context'
import { ids } from './lexicon/lexicons'
import { httpLogger } from './logger'

// List of content encodings that are supported by the PDS. One to use when
// cfg.proxy.preferCompressed is true, and one to use when it is false.
//
// Make sure to:
// 1) Explicitly define "identity" as this is the default encoding.
// 2) Define all the encoding actually supported by the PDS and that might be
//    requested by clients.

const ACCEPT_ENCODING_COMPRESSED = [
  ['gzip', { q: 1.0 }],
  ['deflate', { q: 0.9 }],
  ['br', { q: 0.8 }],
  ['identity', { q: 0.1 }],
] as const satisfies Accept[]

const ACCEPT_ENCODING_UNCOMPRESSED = [
  ['identity', { q: 1.0 }],
  ['gzip', { q: 0.3 }],
  ['deflate', { q: 0.2 }],
  ['br', { q: 0.1 }],
] as const satisfies Accept[]

export const proxyHandler = (ctx: AppContext): CatchallHandler => {
  const accessStandard = ctx.authVerifier.accessStandard()
  return async (req, res, next) => {
    // /!\ Hot path

    try {
      if (
        req.method !== 'GET' &&
        req.method !== 'HEAD' &&
        req.method !== 'POST'
      ) {
        throw new XRPCServerError(
          ResponseType.InvalidRequest,
          'XRPC requests only supports GET and POST',
        )
      }

      const body = req.method === 'POST' ? req : undefined
      if (body != null && !body.readable) {
        // Body was already consumed by a previous middleware
        throw new InternalServerError('Request body is not readable')
      }

      const lxm = parseReqNsid(req)
      if (PROTECTED_METHODS.has(lxm)) {
        throw new InvalidRequestError('Bad token method', 'InvalidToken')
      }

      const auth = await accessStandard({ req, res })
      if (!auth.credentials.isPrivileged && PRIVILEGED_METHODS.has(lxm)) {
        throw new InvalidRequestError('Bad token method', 'InvalidToken')
      }

      const { url: origin, did: aud } = await parseProxyInfo(ctx, req, lxm)

      const headers: IncomingHttpHeaders = {
        'accept-encoding':
          req.headers['accept-encoding'] ||
          formatAcceptHeader(
            ctx.cfg.proxy.preferCompressed
              ? ACCEPT_ENCODING_COMPRESSED
              : ACCEPT_ENCODING_UNCOMPRESSED,
          ),
        'accept-language': req.headers['accept-language'],
        'atproto-accept-labelers': req.headers['atproto-accept-labelers'],
        'x-bsky-topics': req.headers['x-bsky-topics'],

        'content-type': body && req.headers['content-type'],
        'content-encoding': body && req.headers['content-encoding'],
        'content-length': body && req.headers['content-length'],

        authorization: auth.credentials.did
          ? `Bearer ${await ctx.serviceAuthJwt(auth.credentials.did, aud, lxm)}`
          : undefined,
      }

      const dispatchOptions: Dispatcher.RequestOptions = {
        origin,
        method: req.method,
        path: req.originalUrl,
        body,
        headers,
      }

      await pipethroughStream(ctx, dispatchOptions, (upstream) => {
        res.status(upstream.statusCode)

        for (const [name, val] of responseHeaders(upstream.headers)) {
          res.setHeader(name, val)
        }

        // Note that we should not need to manually handle errors here (e.g. by
        // destroying the response), as the http server will handle them for us.
        res.on('error', logResponseError)

        // Default accept-encoding is "identity" meaning that if no value was
        // provided, the response should be sent as "identity". Since in that
        // case, our preferences (that may allow compressed payloads) were used,
        // we might need to decode the response.
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding
        if (!req.headers['accept-encoding']) {
          try {
            const dec = createDecoders(upstream.headers['content-encoding'])
            if (dec.length) {
              pipeline([...dec, res], (_err: Error | null) => {})
              res.setHeader('content-encoding', 'identity')
              return dec[0]
            }
          } catch {
            // Upstream encoding not supported, return the response as-is. Note
            // that in this case we could also throw an UpstreamFailure since
            // the upstream server is misbehaving (it should have returned a 406
            // if it dod not support any of the default encoding we provided).
          }
        }

        // Tell undici to write the upstream response directly to the response
        return res
      })
    } catch (err) {
      next(err)
    }
  }
}

export type PipethroughOptions = {
  /**
   * Specify the issuer (requester) for service auth. If not provided, no
   * authorization headers will be added to the request.
   */
  iss?: string

  /**
   * Override the audience for service auth. If not provided, the audience will
   * be determined based on the proxy service.
   */
  aud?: string

  /**
   * Override the lexicon method for service auth. If not provided, the lexicon
   * method will be determined based on the request path.
   */
  lxm?: string
}

export async function pipethrough(
  ctx: AppContext,
  req: express.Request,
  options?: PipethroughOptions,
): Promise<
  HandlerPipeThroughStream & {
    stream: Readable
    headers: Record<string, string>
    encoding: string
  }
> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // pipethrough() is used from within xrpcServer handlers, which means that
    // the request body either has been parsed or is a readable stream that has
    // been piped for decoding & size limiting. Because of this, forwarding the
    // request body requires re-encoding it. Since we currently do not use
    // pipethrough() with procedures, proxying of request body is not
    // implemented.
    throw new InternalServerError(
      `Proxying of ${req.method} requests is not supported`,
    )
  }

  const lxm = parseReqNsid(req)

  const { url: origin, did: aud } = await parseProxyInfo(ctx, req, lxm)

  const dispatchOptions: Dispatcher.RequestOptions = {
    origin,
    method: req.method,
    path: req.originalUrl,
    headers: {
      'accept-language': req.headers['accept-language'],
      'atproto-accept-labelers': req.headers['atproto-accept-labelers'],
      'x-bsky-topics': req.headers['x-bsky-topics'],

      // Because we sometimes need to interpret the response (e.g. during
      // read-after-write, through asPipeThroughBuffer()), we need to ask the
      // upstream server for an encoding that both the requester and the PDS can
      // understand. Since we might have to do the decoding ourselves, we will
      // use our own preferences (and weight) to negotiate the encoding.
      'accept-encoding': negotiateContentEncoding(
        req.headers['accept-encoding'],
        ctx.cfg.proxy.preferCompressed
          ? ACCEPT_ENCODING_COMPRESSED
          : ACCEPT_ENCODING_UNCOMPRESSED,
      ),

      authorization: options?.iss
        ? `Bearer ${await ctx.serviceAuthJwt(options.iss, options.aud ?? aud, options.lxm ?? lxm)}`
        : undefined,
    },

    // Use a high water mark to buffer more data while performing async
    // operations before this stream is consumed. This is especially useful
    // while processing read-after-write operations.
    highWaterMark: 2 * 65536, // twice the default (64KiB)
  }

  const upstream = await pipethroughRequest(ctx, dispatchOptions)
  const encoding =
    safeString(upstream.headers['content-type']) ?? 'application/json'
  const headers = Object.fromEntries(responseHeaders(upstream.headers))

  // The default is "identity" meaning that if no encoding is specified, the
  // response should be sent as-is.
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding
  if (!req.headers['accept-encoding']) {
    return {
      encoding,
      headers: { ...headers, 'content-encoding': 'identity' },
      stream: decodeStream(upstream.body, upstream.headers['content-encoding']),
    }
  }

  return {
    encoding,
    headers,
    stream: upstream.body,
  }
}

// Request setup/formatting
// -------------------

async function parseProxyInfo(
  ctx: AppContext,
  req: express.Request,
  lxm: string,
): Promise<{ url: string; did: string }> {
  // /!\ Hot path

  const proxyToHeader = req.header('atproto-proxy')
  if (proxyToHeader) return parseProxyHeader(ctx, proxyToHeader)

  const defaultProxy = defaultService(ctx, lxm)
  if (defaultProxy) return defaultProxy

  throw new InvalidRequestError(`No service configured for ${lxm}`)
}

export const parseProxyHeader = async (
  // Using subset of AppContext for testing purposes
  ctx: Pick<AppContext, 'idResolver'>,
  proxyTo: string,
): Promise<{ did: string; url: string }> => {
  // /!\ Hot path

  const hashIndex = proxyTo.indexOf('#')

  if (hashIndex === 0) {
    throw new InvalidRequestError('no did specified in proxy header')
  }

  if (hashIndex === -1 || hashIndex === proxyTo.length - 1) {
    throw new InvalidRequestError('no service id specified in proxy header')
  }

  // More than one hash
  if (proxyTo.indexOf('#', hashIndex + 1) !== -1) {
    throw new InvalidRequestError('invalid proxy header format')
  }

  // Basic validation
  if (proxyTo.includes(' ')) {
    throw new InvalidRequestError('proxy header cannot contain spaces')
  }

  const did = proxyTo.slice(0, hashIndex)
  const didDoc = await ctx.idResolver.did.resolve(did)
  if (!didDoc) {
    throw new InvalidRequestError('could not resolve proxy did')
  }

  const serviceId = proxyTo.slice(hashIndex)
  const url = getServiceEndpoint(didDoc, { id: serviceId })
  if (!url) {
    throw new InvalidRequestError('could not resolve proxy did service url')
  }

  return { did, url }
}

/**
 * Utility function that wraps the undici stream() function and handles request
 * and response errors by wrapping them in XRPCError instances. This function is
 * more efficient than "pipethroughRequest" when a writable stream to pipe the
 * upstream response to is available.
 */
async function pipethroughStream(
  ctx: AppContext,
  dispatchOptions: Dispatcher.RequestOptions,
  successStreamFactory: Dispatcher.StreamFactory,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    void ctx.proxyAgent
      .stream(dispatchOptions, (upstream) => {
        if (upstream.statusCode >= 400) {
          const passThrough = new PassThrough()

          void tryParsingError(upstream.headers, passThrough).then((parsed) => {
            const xrpcError = new XRPCClientError(
              upstream.statusCode === 500
                ? ResponseType.UpstreamFailure
                : upstream.statusCode,
              parsed.error,
              parsed.message,
              Object.fromEntries(responseHeaders(upstream.headers, false)),
              { cause: dispatchOptions },
            )

            reject(xrpcError)
          }, reject)

          return passThrough
        }

        const writable = successStreamFactory(upstream)

        // As soon as the control was passed to the writable stream (i.e. by
        // returning the writable hereafter), pipethroughStream() is considered
        // to have succeeded. Any error occurring while writing upstream data to
        // the writable stream should be handled through the stream's error
        // state (i.e. successStreamFactory() must ensure that error events on
        // the returned writable will be handled).
        resolve()

        return writable
      })
      // The following catch block will be triggered with either network errors
      // or writable stream errors. In the latter case, the promise will already
      // be resolved, and reject()ing it there after will have no effect. Those
      // error would still be logged by the successStreamFactory() function.
      .catch(handleUpstreamRequestError)
      .catch(reject)
  })
}

/**
 * Utility function that wraps the undici request() function and handles request
 * and response errors by wrapping them in XRPCError instances.
 */
async function pipethroughRequest(
  ctx: AppContext,
  dispatchOptions: Dispatcher.RequestOptions,
) {
  // HandlerPipeThroughStream requires a readable stream to be returned, so we
  // use the (less efficient) request() function instead.

  const upstream = await ctx.proxyAgent
    .request(dispatchOptions)
    .catch(handleUpstreamRequestError)

  if (upstream.statusCode >= 400) {
    const parsed = await tryParsingError(upstream.headers, upstream.body)

    // Note "XRPCClientError" is used instead of "XRPCServerError" in order to
    // allow users of this function to capture & handle these errors (namely in
    // "app.bsky.feed.getPostThread").
    throw new XRPCClientError(
      upstream.statusCode === 500
        ? ResponseType.UpstreamFailure
        : upstream.statusCode,
      parsed.error,
      parsed.message,
      Object.fromEntries(responseHeaders(upstream.headers, false)),
      { cause: dispatchOptions },
    )
  }

  return upstream
}

function handleUpstreamRequestError(
  err: unknown,
  message = 'pipethrough network error',
): never {
  httpLogger.warn({ err }, message)
  throw new XRPCServerError(ResponseType.UpstreamFailure, message, undefined, {
    cause: err,
  })
}

// Request parsing/forwarding
// -------------------

type Accept = [name: string, flags: { q: number }]

// accept-encoding defaults to "identity with lowest priority"
const DEFAULT_ACCEPT_ENC = ['identity', { q: 0.001 }] as const satisfies Accept
const ACCEPT_FORBID_IDENTITY = ['identity', { q: 0 }] as const satisfies Accept

function negotiateContentEncoding(
  acceptHeader: undefined | string | string[],
  preferences: readonly [Accept, ...Accept[]],
): string {
  if (!acceptHeader) {
    // If no accept-encoding header is provided, we will use our own preferences
    // and decode the response if needed.
    return formatAcceptHeader(preferences)
  }

  const acceptMap = Object.fromEntries<undefined | Accept[1]>(
    parseAcceptHeader(acceptHeader) ?? [DEFAULT_ACCEPT_ENC],
  )

  // The logic hereafter assumes that the preferences includes "identity". Let's
  // make sure it does.
  if (!preferences.some(isIdentityAccept)) {
    preferences = [...preferences, ACCEPT_FORBID_IDENTITY]
  }

  const common = preferences.filter(([name]) => {
    const acceptFlags = acceptMap[name] ?? acceptMap['*']
    if (name === 'identity') {
      // Per HTTP/1.1, identity must always be accepted unless explicitly rejected
      return acceptFlags?.q !== 0
    } else {
      return acceptFlags ? acceptFlags.q > 0 : false
    }
  })

  // Since preferences included "identity" we are sure that if common is empty,
  // then the downstream client explicitly rejected it, and we can indeed throw
  // a 406 here.
  if (!common.some(isAllowedAccept)) {
    throw new XRPCServerError(
      ResponseType.NotAcceptable,
      'this service does not support any of the requested encodings',
    )
  }

  return formatAcceptHeader(
    // Because "identity" is always accepted unless explicitly rejected, and
    // because preferences do contain "identity", we need to make sure that
    // "identity" is explicitly defined in the proxied accept-encoding header.
    common.some(isIdentityAccept)
      ? (common as [Accept, ...Accept[]])
      : [ACCEPT_FORBID_IDENTITY, ...common],
  )
}

function isIdentityAccept(accept: Accept): boolean {
  return accept[0] === 'identity'
}

function isAllowedAccept(accept: Accept): boolean {
  return accept[1].q > 0
}

/**
 * @param fallbackQ - Adds a "*;q=fallbackQ" to the end of the list. There is no need to specify "0" here.
 * @see {@link https://developer.mozilla.org/en-US/docs/Glossary/Quality_values}
 */
function formatAcceptHeader(accept: readonly [Accept, ...Accept[]]): string {
  const formatted = accept.map(formatAcceptPart)
  return formatted.join(', ')
}

function formatAcceptPart([enc, flags]: Accept): string {
  return `${enc};q=${flags.q}`
}

function parseAcceptHeader(
  acceptHeader: undefined | string | string[],
): undefined | Accept[] {
  if (acceptHeader == null) return undefined

  return Array.isArray(acceptHeader)
    ? acceptHeader.flatMap(parseAcceptHeader).filter(isNonNullable)
    : acceptHeader.split(',').map(parseAcceptPart)
}

function parseAcceptPart(part: string): Accept {
  const flags = { q: 1 }

  const params = part.trim().split(';')
  if (params.length > 2) {
    throw new InvalidRequestError(`Invalid accept header`)
  }

  const token = params[0].toLowerCase()
  if (!token) {
    throw new InvalidRequestError(`Invalid accept header`)
  }

  if (params.length === 2) {
    const param = params[1]
    const { 0: key, 1: value, length } = param.split('=')

    if (length !== 2 || !value || (key !== 'q' && key !== 'Q')) {
      throw new InvalidRequestError(`Invalid accept header`)
    }

    const q = parseFloat(value)
    if (q === 0 || (Number.isFinite(q) && q <= 1 && q >= 0.001)) {
      flags.q = q
    }
  }

  return [token, flags]
}

function isNonNullable<T>(val: T): val is NonNullable<T> {
  return val != null
}

export function isJsonContentType(
  contentType?: string | string[],
): boolean | undefined {
  if (contentType == null) return undefined
  if (typeof contentType !== 'string') return undefined
  return /application\/(?:\w+\+)?json/i.test(contentType)
}

async function tryParsingError(
  headers: IncomingHttpHeaders,
  readable: Readable,
): Promise<{ error?: string; message?: string }> {
  if (isJsonContentType(headers['content-type']) === false) {
    // We don't known how to parse non JSON content types so we can discard the
    // whole response.
    //
    // @NOTE we could also simply "drain" the stream here. This would prevent
    // the upstream HTTP/1.1 connection from getting destroyed (closed). This
    // would however imply to read the whole upstream response, which would be
    // costly in terms of bandwidth and I/O processing. It is recommended to use
    // HTTP/2 to avoid this issue (be able to destroy a single response stream
    // without resetting the whole connection). This is not expected to happen
    // too much as 4xx and 5xx responses are expected to be JSON.
    readable.destroy()

    return {}
  }

  try {
    const buffer = await bufferUpstreamResponse(
      readable,
      headers['content-encoding'],
    )

    const errInfo: unknown = JSON.parse(buffer.toString('utf8'))
    return {
      error: safeString(errInfo?.['error']),
      message: safeString(errInfo?.['message']),
    }
  } catch (err) {
    // Failed to read, decode, buffer or parse. No big deal.
    return {}
  }
}

export async function bufferUpstreamResponse(
  readable: Readable,
  contentEncoding?: string | string[],
): Promise<Buffer> {
  try {
    // Needed for type-safety (should never happen irl)
    if (Array.isArray(contentEncoding)) {
      throw new TypeError(
        'upstream service returned multiple content-encoding headers',
      )
    }

    return await streamToNodeBuffer(decodeStream(readable, contentEncoding))
  } catch (err) {
    if (!readable.destroyed) readable.destroy()

    throw new XRPCServerError(
      ResponseType.UpstreamFailure,
      err instanceof TypeError ? err.message : 'unable to decode request body',
      undefined,
      { cause: err },
    )
  }
}

export async function asPipeThroughBuffer(
  input: HandlerPipeThroughStream,
): Promise<HandlerPipeThroughBuffer> {
  return {
    buffer: await bufferUpstreamResponse(
      input.stream,
      input.headers?.['content-encoding'],
    ),
    headers: omit(input.headers, ['content-encoding', 'content-length']),
    encoding: input.encoding,
  }
}

// Response parsing/forwarding
// -------------------

const RES_HEADERS_TO_FORWARD = ['atproto-repo-rev', 'atproto-content-labelers']

function* responseHeaders(
  headers: IncomingHttpHeaders,
  includeContentHeaders = true,
): Generator<[string, string]> {
  if (includeContentHeaders) {
    const length = headers['content-length']
    if (length) yield ['content-length', length]

    const encoding = headers['content-encoding']
    if (encoding) yield ['content-encoding', encoding]

    const type = headers['content-type']
    if (type) yield ['content-type', type]

    const language = headers['content-language']
    if (language) yield ['content-language', language]
  }

  for (let i = 0; i < RES_HEADERS_TO_FORWARD.length; i++) {
    const name = RES_HEADERS_TO_FORWARD[i]
    const val = headers[name]
    if (typeof val === 'string') yield [name, val]
  }
}

// Utils
// -------------------

export const PRIVILEGED_METHODS = new Set([
  ids.ChatBskyActorDeleteAccount,
  ids.ChatBskyActorExportAccountData,
  ids.ChatBskyConvoDeleteMessageForSelf,
  ids.ChatBskyConvoGetConvo,
  ids.ChatBskyConvoGetConvoForMembers,
  ids.ChatBskyConvoGetLog,
  ids.ChatBskyConvoGetMessages,
  ids.ChatBskyConvoLeaveConvo,
  ids.ChatBskyConvoListConvos,
  ids.ChatBskyConvoMuteConvo,
  ids.ChatBskyConvoSendMessage,
  ids.ChatBskyConvoSendMessageBatch,
  ids.ChatBskyConvoUnmuteConvo,
  ids.ChatBskyConvoUpdateRead,
  ids.ComAtprotoServerCreateAccount,
])

// These endpoints are related to account management and must be used directly,
// not proxied or service-authed. Service auth may be utilized between PDS and
// entryway for these methods.
export const PROTECTED_METHODS = new Set([
  ids.ComAtprotoAdminSendEmail,
  ids.ComAtprotoIdentityRequestPlcOperationSignature,
  ids.ComAtprotoIdentitySignPlcOperation,
  ids.ComAtprotoIdentityUpdateHandle,
  ids.ComAtprotoServerActivateAccount,
  ids.ComAtprotoServerConfirmEmail,
  ids.ComAtprotoServerCreateAppPassword,
  ids.ComAtprotoServerDeactivateAccount,
  ids.ComAtprotoServerGetAccountInviteCodes,
  ids.ComAtprotoServerListAppPasswords,
  ids.ComAtprotoServerRequestAccountDelete,
  ids.ComAtprotoServerRequestEmailConfirmation,
  ids.ComAtprotoServerRequestEmailUpdate,
  ids.ComAtprotoServerRevokeAppPassword,
  ids.ComAtprotoServerUpdateEmail,
])

const defaultService = (
  ctx: AppContext,
  nsid: string,
): { url: string; did: string } | null => {
  switch (nsid) {
    case ids.ToolsOzoneTeamAddMember:
    case ids.ToolsOzoneTeamDeleteMember:
    case ids.ToolsOzoneTeamUpdateMember:
    case ids.ToolsOzoneTeamListMembers:
    case ids.ToolsOzoneCommunicationCreateTemplate:
    case ids.ToolsOzoneCommunicationDeleteTemplate:
    case ids.ToolsOzoneCommunicationUpdateTemplate:
    case ids.ToolsOzoneCommunicationListTemplates:
    case ids.ToolsOzoneModerationEmitEvent:
    case ids.ToolsOzoneModerationGetEvent:
    case ids.ToolsOzoneModerationGetRecord:
    case ids.ToolsOzoneModerationGetRepo:
    case ids.ToolsOzoneModerationQueryEvents:
    case ids.ToolsOzoneModerationQueryStatuses:
    case ids.ToolsOzoneModerationSearchRepos:
      return ctx.cfg.modService
    case ids.ComAtprotoModerationCreateReport:
      return ctx.cfg.reportService
    default:
      return ctx.cfg.bskyAppView
  }
}

const safeString = (str: unknown): string | undefined => {
  return typeof str === 'string' ? str : undefined
}

function logResponseError(this: ServerResponse, err: unknown): void {
  httpLogger.warn({ err }, 'error forwarding upstream response')
}
