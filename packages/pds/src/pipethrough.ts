import { getServiceEndpoint } from '@atproto/common'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import {
  CatchallHandler,
  HandlerPipeThroughStream,
  InvalidRequestError,
  parseReqNsid,
  UpstreamFailureError,
} from '@atproto/xrpc-server'
import express from 'express'
import { IncomingHttpHeaders } from 'node:http'
import {
  // @ts-expect-error compose was added in Node v16.9.0
  compose,
  Duplex,
  PassThrough,
  pipeline,
} from 'node:stream'
import * as zlib from 'node:zlib'
import { Dispatcher } from 'undici'

import AppContext from './context'
import { ids } from './lexicon/lexicons'
import { httpLogger } from './logger'

export const proxyHandler = (ctx: AppContext): CatchallHandler => {
  const accessStandard = ctx.authVerifier.accessStandard()
  return async (req, res, next) => {
    try {
      const nsid = parseReqNsid(req)
      if (PROTECTED_METHODS.has(nsid)) {
        throw new InvalidRequestError('Bad token method', 'InvalidToken')
      }

      const auth = await accessStandard({ req, res })
      if (!auth.credentials.isPrivileged && PRIVILEGED_METHODS.has(nsid)) {
        throw new InvalidRequestError('Bad token method', 'InvalidToken')
      }

      await pipethroughResponse(ctx, req, res, {
        iss: auth.credentials.did,
      })
    } catch (err) {
      next(err)
    }
  }
}

export async function pipethrough(
  ctx: AppContext,
  req: express.Request,
  options?: Partial<PipethroughRequestOptions>,
): Promise<HandlerPipeThroughStream> {
  return new Promise<HandlerPipeThroughStream>((resolve, reject) => {
    void pipethroughStream(ctx, req, options, (upstream) => {
      // Because the HandlerPipeThroughStream type does not permit to
      // reflect the content-encoding, we need to decode the stream and
      // return the decoded stream in the response. Reflecting the
      // content-encoding in HandlerPipeThroughStream would require
      // consumers to handle the decoding themselves, which is cumbersome.
      const decoders = createDecoders(upstream.headers['content-encoding'])

      const writable = decoders[0] ?? new PassThrough()
      const readable =
        decoders.length > 1
          ? // pipeline returns the last stream in the chain
            (pipeline(decoders, () => {}) as Duplex)
          : writable

      // This will resolve the promise before the stream starts flowing. If an
      // error occurs after that, pipethroughInternal() will reject causing the
      // `.catch` callback below to be triggered. Since the promise will have
      // already resolved, this will have no effect. Once the promise is
      // resolved, any error must be handled through the returned stream.
      resolve({
        stream: readable,
        headers: Object.fromEntries(responseHeaders(upstream.headers)),
        encoding:
          safeString(upstream.headers['content-type']) ?? 'application/json',
      })

      return writable
    }).catch(reject)
  })
}

async function pipethroughResponse(
  ctx: AppContext,
  req: express.Request,
  res: express.Response,
  options?: Partial<PipethroughRequestOptions>,
): Promise<void> {
  await pipethroughStream(ctx, req, options, (upstream) => {
    // Forward status code
    res.status(upstream.statusCode)

    // Forward headers
    for (const [name, val] of responseHeaders(upstream.headers)) {
      res.setHeader(name, val)
    }

    const length = upstream.headers['content-length']
    const codings = parseContentEncoding(upstream.headers['content-encoding'])
    if (length && !codings.length) {
      res.setHeader('content-length', length)
    } else {
      res.setHeader('content-encoding', codings.join(', '))
      res.setHeader('transfer-encoding', 'chunked')
    }

    // Forward body
    return res
  })
}

async function pipethroughStream(
  ctx: AppContext,
  req: express.Request,
  options: Partial<PipethroughRequestOptions> = {},
  successStreamFactory: Dispatcher.StreamFactory,
): Promise<void> {
  assertXrpcHttpMethod(req.method)

  const lxm = parseReqNsid(req)

  const { origin, aud } = await formatUrlAndAud(ctx, req, lxm)

  const headers = await requestHeaders(ctx, req, {
    aud: options.aud ?? aud,
    lxm: options.lxm ?? lxm,
    iss: options.iss,
  })

  await ctx.safeAgent
    .stream(
      {
        origin,
        method: req.method,
        path: req.originalUrl,
        body: req.method === 'POST' ? req : undefined,
        headers,
      },
      (data) => {
        if (data.statusCode === ResponseType.Success) {
          return successStreamFactory(data)
        }

        // Upstream resulted in an error, create a writable stream for undici
        // that will decode & parse the error message and construct an XRPCError
        return compose(
          ...createDecoders(data.headers?.['content-encoding']),
          async function (res) {
            const buffer = Buffer.concat(await res.toArray())
            const errInfo = safeParseJson(buffer.toString('utf8'))

            // Throwing here will cause the promise returned by stream() to
            // reject. This will cause the `.catch` block below to be triggered.
            throw new XRPCError(
              data.statusCode,
              safeString(errInfo?.['error']),
              safeString(errInfo?.['message']),
              Object.fromEntries(responseHeaders(data.headers)),
            )
          },
        )
      },
    )
    .catch((err) => {
      if (err instanceof XRPCError) {
        // Upstream XRPCError
        throw err
      } else {
        // Could also be an error from the stream returned by
        // successStreamFactory()
        httpLogger.warn({ err }, 'pipethrough network error')
        throw new XRPCError(ResponseType.UpstreamFailure)
      }
    })
}

// Request setup/formatting
// -------------------

const REQ_HEADERS_TO_FORWARD = [
  'accept-language',
  'content-type',
  'atproto-accept-labelers',
  'x-bsky-topics',
]

async function formatUrlAndAud(
  ctx: AppContext,
  req: express.Request,
  nsid: string,
): Promise<{ origin: string; aud: string }> {
  // /!\ Hot path

  const proxyToHeader = req.header('atproto-proxy')
  if (proxyToHeader) {
    const proxyTo = await parseProxyHeader(ctx, proxyToHeader)
    const serviceUrl = proxyTo.serviceUrl
    const aud = proxyTo.did
    return { origin: serviceUrl, aud }
  }

  const defaultProxy = defaultService(ctx, nsid)
  if (defaultProxy) {
    const serviceUrl = defaultProxy.url
    const aud = defaultProxy.did
    return { origin: serviceUrl, aud }
  }

  throw new InvalidRequestError(`No service configured for ${nsid}`)
}

export type PipethroughRequestOptions = {
  aud: string
  lxm: string
  iss?: string
}

async function requestHeaders(
  ctx: AppContext,
  req: express.Request,
  { aud, lxm, iss }: PipethroughRequestOptions,
): Promise<{ authorization?: string }> {
  const headers = iss
    ? (await ctx.serviceAuthHeaders(iss, aud, lxm)).headers
    : {}
  // forward select headers to upstream services
  for (const header of REQ_HEADERS_TO_FORWARD) {
    const val = req.headers[header]
    if (val) {
      headers[header] = val
    }
  }
  return headers
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

// Sending request
// -------------------

function assertXrpcHttpMethod(
  method: string,
): asserts method is 'POST' | 'GET' | 'HEAD' {
  if (method !== 'POST' && method !== 'GET' && method !== 'HEAD') {
    throw new InvalidRequestError('Method not found')
  }
}

// Response parsing/forwarding
// -------------------

function parseContentEncoding(contentEncoding?: string | string[]): string[] {
  // undefined, empty string, and empty array
  if (!contentEncoding?.length) return []

  // Non empty string
  if (typeof contentEncoding === 'string') {
    return (
      contentEncoding
        .split(',')
        // https://www.rfc-editor.org/rfc/rfc7231#section-3.1.2.1
        // > All content-coding values are case-insensitive...
        .map((x) => x.toLowerCase().trim())
        .filter((x) => x && x !== 'identity')
    )
  }

  // Should never happen. Makes TS happy.
  throw new UpstreamFailureError('Multiple content-encoding headers')
}

function createDecoders(contentEncoding?: string | string[]): Duplex[] {
  return parseContentEncoding(contentEncoding).map(createDecoder)
}

function createDecoder(encoding: string): Duplex {
  switch (encoding) {
    // https://www.rfc-editor.org/rfc/rfc9112.html#section-7.2
    case 'gzip':
    case 'x-gzip':
      return zlib.createGunzip({
        // using Z_SYNC_FLUSH (cURL default) to be less strict when decoding
        flush: zlib.constants.Z_SYNC_FLUSH,
        finishFlush: zlib.constants.Z_SYNC_FLUSH,
      })
    case 'deflate':
      return zlib.createInflate()
    case 'br':
      return zlib.createBrotliDecompress()
    default:
      throw new UpstreamFailureError(
        `Unsupported upstream content-encoding: ${encoding}`,
      )
  }
}

const RES_HEADERS_TO_FORWARD = [
  'content-type',
  'content-language',
  'atproto-repo-rev',
  'atproto-content-labelers',
]

function* responseHeaders(
  headers: IncomingHttpHeaders,
): Generator<[string, string]> {
  for (let i = 0; i < RES_HEADERS_TO_FORWARD.length; i++) {
    const header = RES_HEADERS_TO_FORWARD[i]
    const val = headers[header]
    if (typeof val === 'string') yield [header, val]
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
