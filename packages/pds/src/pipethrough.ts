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
import { Duplex, PassThrough, pipeline, Writable } from 'node:stream'
import * as zlib from 'node:zlib'
import { Dispatcher } from 'undici'

import AppContext from './context'
import { ids } from './lexicon/lexicons'
import { httpLogger } from './logger'

export const proxyHandler = (ctx: AppContext): CatchallHandler => {
  const accessStandard = ctx.authVerifier.accessStandard()
  return async (req, res, next) => {
    try {
      assertXrpcHttpMethod(req.method)

      const { url, aud, nsid } = await formatUrlAndAud(ctx, req)
      const auth = await accessStandard({ req, res })
      if (
        PROTECTED_METHODS.has(nsid) ||
        (!auth.credentials.isPrivileged && PRIVILEGED_METHODS.has(nsid))
      ) {
        throw new InvalidRequestError('Bad token method', 'InvalidToken')
      }
      const reqHeaders = await formatHeaders(ctx, req, {
        aud,
        lxm: nsid,
        requester: auth.credentials.did,
      })

      try {
        await ctx.safeAgent.stream(
          {
            method: req.method,
            origin: url.origin,
            path: url.pathname + url.search,
            headers: reqHeaders,
            body: req.method === 'POST' ? req : undefined,
          },
          (data) => {
            if (data.statusCode !== ResponseType.Success) {
              // The xrpcErrorWriter function will trigger a stream error
              // containing the error information from the upstream service.
              // This error will cause the safeAgent.stream() to reject with
              // the error, which will be caught by the catch block below.
              return xrpcErrorWriter(data)
            }

            // Forward status code
            res.status(data.statusCode)

            // Forward headers
            for (const [name, val] of buildHeadersToForward(data.headers)) {
              res.setHeader(name, val)
            }

            const length = data.headers['content-length']
            const encodings = parseContentEncoding(
              data.headers['content-encoding'],
            )
            if (length && !encodings?.length) {
              res.setHeader('content-length', length)
            } else {
              res.setHeader('content-encoding', encodings.join(', '))
              res.setHeader('transfer-encoding', 'chunked')
            }

            // Forward payload
            return res
          },
        )
      } catch (err) {
        if (err instanceof XRPCError) {
          // Response XRPCError (created through xrpcErrorWriter())
          throw err
        } else {
          // Request error
          httpLogger.warn({ err }, 'pipethrough network error')
          throw new XRPCError(ResponseType.UpstreamFailure)
        }
      }
    } catch (err) {
      next(err)
    }
  }
}

export async function pipethrough(
  ctx: AppContext,
  req: express.Request,
  requester: string | null,
  override: {
    aud?: string
    lxm?: string
  } = {},
): Promise<HandlerPipeThroughStream> {
  const { method } = req
  assertXrpcHttpMethod(method)

  const { url, aud, nsid } = await formatUrlAndAud(ctx, req, override.aud)
  const lxm = override.lxm ?? nsid
  const reqHeaders = await formatHeaders(ctx, req, { aud, lxm, requester })

  return new Promise((resolve, reject) => {
    void ctx.safeAgent
      .stream(
        {
          method,
          origin: url.origin,
          path: url.pathname + url.search,
          headers: reqHeaders,
        },
        (data) => {
          if (data.statusCode !== ResponseType.Success) {
            return xrpcErrorWriter(data)
          }

          // Because the HandlerPipeThroughStream type does not permit to
          // reflect the content-encoding, we need to decode the stream and
          // return the decoded stream in the response. Reflecting the
          // content-encoding in HandlerPipeThroughStream would require
          // consumers to handle the decoding themselves, which is cumbersome.
          const decoders = createDecoders(data.headers['content-encoding'])

          const writable = decoders[0] ?? new PassThrough()
          const readable =
            decoders.length > 1
              ? // pipeline returns the last stream in the chain
                (pipeline(decoders, () => {}) as Duplex)
              : writable

          resolve({
            stream: readable,
            headers: Object.fromEntries(buildHeadersToForward(data.headers)),
            encoding:
              safeString(data.headers['content-type']) ?? 'application/json',
          })

          return writable
        },
      )
      .catch(reject)
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

export const formatUrlAndAud = async (
  ctx: AppContext,
  req: express.Request,
  audOverride?: string,
): Promise<{ url: URL; aud: string; nsid: string }> => {
  // /!\ Hot path

  const nsid = parseReqNsid(req)

  const proxyToHeader = req.header('atproto-proxy')
  if (proxyToHeader) {
    const proxyTo = await parseProxyHeader(ctx, proxyToHeader)
    const serviceUrl = proxyTo.serviceUrl
    const aud = audOverride ?? proxyTo.did
    return { url: new URL(req.originalUrl, serviceUrl), aud, nsid }
  }

  const defaultProxy = defaultService(ctx, nsid)
  if (defaultProxy) {
    const serviceUrl = defaultProxy.url
    const aud = audOverride ?? defaultProxy.did
    return { url: new URL(req.originalUrl, serviceUrl), aud, nsid }
  }

  throw new InvalidRequestError(`No service configured for ${req.path}`)
}

export const formatHeaders = async (
  ctx: AppContext,
  req: express.Request,
  opts: {
    aud: string
    lxm: string
    requester: string | null
  },
): Promise<{ authorization?: string }> => {
  const { aud, lxm, requester } = opts
  const headers = requester
    ? (await ctx.serviceAuthHeaders(requester, aud, lxm)).headers
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

function xrpcErrorWriter({
  statusCode,
  headers,
}: Dispatcher.StreamFactoryData): Writable {
  const chunks: Buffer[] = []
  const writable = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk)
      callback()
    },
    final(callback) {
      const buffer = Buffer.concat(chunks.splice(0, chunks.length))
      const errInfo = safeParseJson(buffer.toString('utf8'))
      const error = new XRPCError(
        statusCode,
        safeString(errInfo?.['error']),
        safeString(errInfo?.['message']),
        Object.fromEntries(buildHeadersToForward(headers)),
      )

      callback(error)
    },
  })

  const decoders = createDecoders(headers?.['content-encoding'])
  if (decoders.length) {
    // @ts-expect-error
    pipeline(decoders.concat(writable), () => {
      // the writable is meant to be used as writer for undici.stream()
      // meaning that any error will be propagated to the stream
    })
    return decoders[0]
  } else {
    return writable
  }
}

const RES_HEADERS_TO_FORWARD = [
  'content-type',
  'content-language',
  'atproto-repo-rev',
  'atproto-content-labelers',
]

function* buildHeadersToForward(
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
