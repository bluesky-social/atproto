import express from 'express'
import { IncomingHttpHeaders } from 'node:http'
import { Duplex, Readable } from 'node:stream'
import { Dispatcher } from 'undici'

import {
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
        'accept-encoding': req.headers['accept-encoding'],
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

// List of content encodings that are supported by the PDS. Because proxying
// occurs between data centers, where connectivity is supposedly stable & good,
// and because payloads are small, we prefer encoding that are fast (gzip,
// deflate, identity) over heavier encodings (Brotli). Upstream servers should
// be configured to prefer any encoding over identity in case of big,
// uncompressed payloads.
const SUPPORTED_ENCODINGS = [
  ['gzip', { q: '1.0' }],
  ['deflate', { q: '0.9' }],
  ['identity', { q: '0.3' }],
  ['br', { q: '0.1' }],
] as const satisfies Accept[]

export async function pipethrough(
  ctx: AppContext,
  req: express.Request,
  options?: PipethroughOptions,
): Promise<HandlerPipeThroughStream> {
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

  // Because we sometimes need to interpret the response (e.g. during
  // read-after-write, through asPipeThroughBuffer()), we need to ask the
  // upstream server for an encoding that both the requester and the PDS can
  // understand.
  const acceptEncoding = negotiateAccept(
    req.headers['accept-encoding'],
    SUPPORTED_ENCODINGS,
  )

  const headers: IncomingHttpHeaders = {
    'accept-language': req.headers['accept-language'],
    'atproto-accept-labelers': req.headers['atproto-accept-labelers'],
    'x-bsky-topics': req.headers['x-bsky-topics'],

    'accept-encoding': `${formatAccepted(acceptEncoding)}, *;q=0`, // Reject anything else (q=0)

    authorization: options?.iss
      ? `Bearer ${await ctx.serviceAuthJwt(options.iss, options.aud ?? aud, options.lxm ?? lxm)}`
      : undefined,
  }

  const dispatchOptions: Dispatcher.RequestOptions = {
    origin,
    method: req.method,
    path: req.originalUrl,
    headers,

    // Use a high water mark to buffer more data while performing async
    // operations before this stream is consumed. This is especially useful
    // while processing read-after-write operations.
    highWaterMark: 2 * 65536, // twice the default (64KiB)
  }

  const upstream = await pipethroughRequest(ctx, dispatchOptions)

  return {
    stream: upstream.body,
    headers: Object.fromEntries(responseHeaders(upstream.headers)),
    encoding:
      safeString(upstream.headers['content-type']) ?? 'application/json',
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
  await ctx.proxyAgent
    .stream(dispatchOptions, (upstream) => {
      // Upstream resulted in an error, create a writable stream for undici
      // that will decode & parse the error message and construct an XRPCError
      if (upstream.statusCode !== ResponseType.Success) {
        return Duplex.from(async function (
          res: AsyncGenerator<Buffer, void, unknown>,
        ): Promise<void> {
          return handleUpstreamResponseError(dispatchOptions, upstream, res)
        })
      }

      try {
        return successStreamFactory(upstream)
      } catch (err) {
        // Assume any error thrown from successStreamFactory() is due to an
        // unsupported or invalid value in "upstream" (statusCode or headers).
        // This will allow to distinguish requests errors bellow.
        return handleUpstreamRequestError(
          err,
          dispatchOptions,
          'unable to process upstream response',
        )
      }
    })
    .catch((err) => {
      if (err instanceof XRPCServerError) throw err
      if (err instanceof XRPCClientError) throw err

      // Any other error here was caused by undici, the network or the writable
      // stream returned by the function above (e.g. decoding error).
      return handleUpstreamRequestError(err, dispatchOptions)
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
    .catch((err) => handleUpstreamRequestError(err, dispatchOptions))

  if (upstream.statusCode !== ResponseType.Success) {
    return handleUpstreamResponseError(dispatchOptions, upstream)
  }

  return upstream
}

async function handleUpstreamResponseError(
  dispatchOptions: Dispatcher.RequestOptions,
  data: Dispatcher.ResponseData,
): Promise<never>
async function handleUpstreamResponseError(
  dispatchOptions: Dispatcher.RequestOptions,
  data: Dispatcher.StreamFactoryData,
  body: Readable | AsyncGenerator<Buffer, void, unknown>,
): Promise<never>
async function handleUpstreamResponseError(
  dispatchOptions: Dispatcher.RequestOptions,
  data: Dispatcher.StreamFactoryData | Dispatcher.ResponseData,
  body?: Readable | AsyncGenerator<Buffer, void, unknown>,
): Promise<never> {
  const stream = body ?? ('body' in data ? data.body : undefined)

  // Type-safety, should never happen
  if (!stream) throw new TypeError('body is required')

  const buffer = await bufferUpstreamResponse(
    stream,
    data.headers['content-encoding'],
  )

  const errInfo = safeParseJson(buffer.toString('utf8'))

  // Throwing here will cause the promise returned by stream() to
  // reject. This will cause the `.catch` block below to be triggered.
  throw new XRPCClientError(
    data.statusCode,
    safeString(errInfo?.['error']),
    safeString(errInfo?.['message']),
    Object.fromEntries(responseHeaders(data.headers, false)),
    { cause: dispatchOptions },
  )
}

function handleUpstreamRequestError(
  err: unknown,
  dispatchOptions: Dispatcher.RequestOptions,
  message = 'pipethrough network error',
): never {
  httpLogger.warn({ err }, message)
  throw new XRPCServerError(ResponseType.UpstreamFailure, message, undefined, {
    cause: [err, dispatchOptions],
  })
}

// Request parsing/forwarding
// -------------------

type Accept = [name: string, flags: Record<string, string>]

function negotiateAccept(
  acceptHeader: undefined | string | string[],
  supported: readonly Accept[],
): readonly Accept[] {
  // Optimization: if no accept-encoding header is present, skip negotiation
  if (!acceptHeader?.length) {
    return supported
  }

  const acceptNames = extractAcceptedNames(acceptHeader)
  const common = acceptNames.includes('*')
    ? supported
    : supported.filter(nameIncludedIn, acceptNames)

  // There must be at least one common encoding with a non-zero q value
  if (!common.some(isNotRejected)) {
    throw new XRPCServerError(
      ResponseType.NotAcceptable,
      'this service does not support any of the requested encodings',
    )
  }

  return common
}

function formatAccepted(accept: readonly Accept[]): string {
  return accept.map(formatEncodingDev).join(', ')
}

function formatEncodingDev([enc, flags]: Accept): string {
  let ret = enc
  for (const name in flags) ret += `;${name}=${flags[name]}`
  return ret
}

function nameIncludedIn(this: readonly string[], accept: Accept): boolean {
  return this.includes(accept[0])
}

function isNotRejected(accept: Accept): boolean {
  return accept[1]['q'] !== '0'
}

function extractAcceptedNames(
  acceptHeader: undefined | string | string[],
): string[] {
  if (!acceptHeader?.length) {
    return ['*']
  }

  return Array.isArray(acceptHeader)
    ? acceptHeader.flatMap(extractAcceptedNames)
    : acceptHeader.split(',').map(extractAcceptedName).filter(isNonNullable)
}

function extractAcceptedName(def: string): string | undefined {
  // No need to fully parse since we only care about allowed values
  const parts = def.split(';')
  if (parts.some(isQzero)) return undefined
  return parts[0].trim()
}

function isQzero(def: string): boolean {
  return def.trim() === 'q=0'
}

function isNonNullable<T>(val: T): val is NonNullable<T> {
  return val != null
}

export async function bufferUpstreamResponse(
  stream: Readable | AsyncIterable<Uint8Array>,
  contentEncoding?: string | string[],
): Promise<Buffer> {
  // Needed for type-safety (should never happen irl)
  if (Array.isArray(contentEncoding)) {
    throw new XRPCServerError(
      ResponseType.UpstreamFailure,
      'upstream service returned multiple content-encoding headers',
    )
  }

  try {
    return streamToNodeBuffer(decodeStream(stream, contentEncoding))
  } catch (err) {
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

const RES_HEADERS_TO_FORWARD = [
  'content-type',
  'content-language',
  'atproto-repo-rev',
  'atproto-content-labelers',
]

function* responseHeaders(
  headers: IncomingHttpHeaders,
  includeContentHeaders = true,
): Generator<[string, string]> {
  if (includeContentHeaders) {
    const length = headers['content-length']
    if (length) yield ['content-length', length]

    const encoding = headers['content-encoding']
    if (encoding) yield ['content-encoding', encoding]
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

export const safeParseJson = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}
