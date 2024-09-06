import { getServiceEndpoint } from '@atproto/common'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import {
  CatchallHandler,
  HandlerPipeThroughStream,
  InvalidRequestError,
  parseReqNsid,
} from '@atproto/xrpc-server'
import express from 'express'
import { IncomingHttpHeaders } from 'node:http'
import { Readable, Writable } from 'node:stream'

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
          ({ statusCode, headers }) => {
            // In case of error, collect all the data and propagate an error
            if (statusCode !== ResponseType.Success) {
              return new Collector((buffer, callback) => {
                const err = buildError(statusCode, headers, buffer)
                callback(err)
              })
            }

            // Forward status code
            res.status(statusCode)

            // Forward headers
            const length = headers?.['content-length']
            const encoding = headers?.['content-encoding'] ?? 'identity'
            if (length && encoding === 'identity') {
              res.setHeader('content-length', length)
            } else {
              res.setHeader('transfer-encoding', 'chunked')
            }
            for (const [name, val] of buildHeadersToForward(headers)) {
              res.setHeader(name, val)
            }

            // Forward body
            return res
          },
        )
      } catch (err) {
        if (err instanceof XRPCError) throw err
        else {
          httpLogger.warn({ err }, 'pipethrough network error')
          throw new XRPCError(ResponseType.UpstreamFailure)
        }
      }
    } catch (err) {
      next(err)
    }
  }
}

export const pipethrough = async (
  ctx: AppContext,
  req: express.Request,
  requester: string | null,
  override: {
    aud?: string
    lxm?: string
  } = {},
): Promise<HandlerPipeThroughStream> => {
  assertXrpcHttpMethod(req.method)

  const { url, aud, nsid } = await formatUrlAndAud(ctx, req, override.aud)
  const lxm = override.lxm ?? nsid
  const reqHeaders = await formatHeaders(ctx, req, { aud, lxm, requester })

  const response = await ctx.safeAgent.request({
    method: req.method,
    origin: url.origin,
    path: url.pathname + url.search,
    headers: reqHeaders,
  })

  if (response.statusCode !== ResponseType.Success) {
    const buffer = await collect(response.body)
    throw buildError(response.statusCode, response.headers, buffer)
  }

  try {
    const encoding = response.headers['content-type'] ?? 'application/json'

    if (typeof encoding !== 'string') {
      throw new InvalidRequestError('Invalid content type')
    }

    return {
      headers: Object.fromEntries(buildHeadersToForward(response.headers)),
      stream: response.body,
      encoding,
    }
  } catch (err) {
    response.body.destroy()
    throw err
  }
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
    return checkUrlAndAud(ctx, req, serviceUrl, aud, nsid)
  }

  const defaultProxy = defaultService(ctx, nsid)
  if (defaultProxy) {
    const serviceUrl = defaultProxy.url
    const aud = audOverride ?? defaultProxy.did
    return checkUrlAndAud(ctx, req, serviceUrl, aud, nsid)
  }

  throw new InvalidRequestError(`No service configured for ${req.path}`)
}

export const checkUrlAndAud = (
  ctx: AppContext,
  req: express.Request,
  serviceUrl: string,
  aud: string,
  nsid: string,
): { url: URL; aud: string; nsid: string } => {
  const url = new URL(req.originalUrl, serviceUrl)
  return { url, aud, nsid }
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

export async function collect(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

class Collector extends Writable {
  constructor(
    onFinal: (buffer: Buffer, callback: (err?: null | Error) => void) => void,
  ) {
    const chunks: Buffer[] = []
    super({
      write(chunk, _, callback) {
        chunks.push(chunk)
        callback()
      },
      final(callback) {
        onFinal(Buffer.concat(chunks), callback)
      },
    })
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

const safeString = (str: string): string | undefined => {
  return typeof str === 'string' ? str : undefined
}

export const safeParseJson = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function buildError(
  status: number,
  headers: IncomingHttpHeaders,
  body: Buffer,
): XRPCError {
  const errInfo = safeParseJson(body.toString('utf8'))
  return new XRPCError(
    status,
    safeString(errInfo?.['error']),
    safeString(errInfo?.['message']),
    Object.fromEntries(buildHeadersToForward(headers)),
  )
}
