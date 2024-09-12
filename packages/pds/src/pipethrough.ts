import {
  decodeStream,
  getServiceEndpoint,
  omit,
  streamToBytes,
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
import express from 'express'
import { IncomingHttpHeaders } from 'node:http'
import { Duplex, PassThrough, Readable } from 'node:stream'
import { Dispatcher } from 'undici'

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

      await pipethroughInternal(
        ctx,
        {
          origin,
          method: req.method,
          path: req.originalUrl,
          body,
          headers,
        },
        (upstream) => {
          res.status(upstream.statusCode)

          for (const [name, val] of responseHeaders(upstream.headers)) {
            res.setHeader(name, val)
          }

          return res
        },
      )
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

const PIPETHROUGH_ACCEPTED_ENCODINGS = [
  // Because proxying occurs between data centers, where connectivity is
  // supposedly stable & good, prefer encoding that are fast (gzip, deflate,
  // identity) over heavier encodings (Brotli).
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
    PIPETHROUGH_ACCEPTED_ENCODINGS,
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
  }

  return new Promise<HandlerPipeThroughStream>((resolve, reject) => {
    void pipethroughInternal(ctx, dispatchOptions, (upstream) => {
      const stream = new PassThrough({
        autoDestroy: true,
        // Use a high water mark to buffer more data while performing async
        // operations before this stream is consumed. This is especially useful
        // while processing read-after-write operations.
        highWaterMark: 4 * 16384, // 4 times the default (64kb)
      })

      // This will resolve the promise before the stream starts flowing. If an
      // error occurs after that, pipethroughInternal() will reject causing the
      // `.catch` callback below to be triggered. Since the promise will have
      // already resolved, this will have no effect. Once the promise is
      // resolved, any error must be handled through the returned stream.
      resolve({
        stream,
        headers: Object.fromEntries(responseHeaders(upstream.headers)),
        encoding:
          safeString(upstream.headers['content-type']) ?? 'application/json',
      })

      return stream
    }).catch(reject)
  })
}

async function pipethroughInternal(
  ctx: AppContext,
  options: Dispatcher.RequestOptions,
  successStreamFactory: Dispatcher.StreamFactory,
): Promise<void> {
  await ctx.safeAgent
    .stream(options, (data) => {
      try {
        if (data.statusCode === ResponseType.Success) {
          return successStreamFactory(data)
        }

        // Upstream resulted in an error, create a writable stream for undici
        // that will decode & parse the error message and construct an XRPCError
        return Duplex.from(async function (
          res: AsyncGenerator<Buffer, void, unknown>,
        ): Promise<void> {
          const buffer = await bufferUpstreamResponse(
            res,
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
          )
        })
      } catch (err) {
        if (err instanceof XRPCServerError) throw err
        if (err instanceof XRPCClientError) throw err

        // Assume any error thrown from successStreamFactory() is due to an
        // unsupported or invalid value in "data" (statusCode or headers).
        // This will allow to distinguish undici/network errors bellow.
        throw new XRPCServerError(
          ResponseType.UpstreamFailure,
          undefined,
          'unable to process upstream response',
          { cause: err },
        )
      }
    })
    .catch((err) => {
      if (err instanceof XRPCServerError) throw err
      if (err instanceof XRPCClientError) throw err

      // Any other error here was caused by undici, the network or the writable
      // stream returned by the function above (e.g. decoding error).
      httpLogger.warn({ err }, 'pipethrough network error')
      throw new XRPCServerError(
        ResponseType.UpstreamFailure,
        undefined,
        'pipethrough network error',
        { cause: err },
      )
    })
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
  if (proxyToHeader) {
    const proxyTo = await parseProxyHeader(ctx, proxyToHeader)
    const url = proxyTo.serviceUrl
    const did = proxyTo.did
    return { url, did }
  }

  const defaultProxy = defaultService(ctx, lxm)
  if (defaultProxy) {
    return defaultProxy
  }

  throw new InvalidRequestError(`No service configured for ${lxm}`)
}

export const parseProxyHeader = async (
  // Using subset of AppContext for testing purposes
  ctx: Pick<AppContext, 'idResolver'>,
  proxyTo: string,
): Promise<{ did: string; serviceUrl: string }> => {
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
  const serviceId = proxyTo.slice(hashIndex + 1)

  const didDoc = await ctx.idResolver.did.resolve(did)
  if (!didDoc) {
    throw new InvalidRequestError('could not resolve proxy did')
  }
  const serviceUrl = getServiceEndpoint(didDoc, { id: `#${serviceId}` })
  if (!serviceUrl) {
    throw new InvalidRequestError('could not resolve proxy did service url')
  }
  return { did, serviceUrl }
}

// Request parsing/forwarding
// -------------------

type Accept = [name: string, flags: { q: string }]

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
      'NotAcceptable',
      'this service does not support any of the requested encodings',
    )
  }

  return common
}

function formatAccepted(accept: readonly Accept[]): string {
  return accept.map(formatEncodingDev).join(', ')
}

function formatEncodingDev([enc, { q }]: Accept): string {
  return q != null ? `${enc};q=${q}` : enc
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
  if (parts[1]?.trim() === 'q=0') return undefined
  return parts[0].trim()
}

function isNonNullable<T>(val: T): val is NonNullable<T> {
  return val != null
}

export async function bufferUpstreamResponse(
  stream: Readable | AsyncIterable<Uint8Array>,
  contentEncoding?: string | string[],
) {
  // Needed for type-safety (should never happen irl)
  if (Array.isArray(contentEncoding)) {
    throw new XRPCServerError(
      ResponseType.UpstreamFailure,
      'upstream service returned multiple content-encoding headers',
    )
  }

  try {
    return streamToBytes(decodeStream(stream, contentEncoding))
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
