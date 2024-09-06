import express from 'express'
import * as ui8 from 'uint8arrays'
import net from 'node:net'
import stream from 'node:stream'
import webStream from 'node:stream/web'
import { LexValue, jsonToLex, stringifyLex } from '@atproto/lexicon'
import {
  CatchallHandler,
  HandlerPipeThrough,
  InvalidRequestError,
  parseReqNsid,
} from '@atproto/xrpc-server'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import { getServiceEndpoint, noUndefinedVals } from '@atproto/common'
import { ids, lexicons } from './lexicon/lexicons'
import { httpLogger } from './logger'
import AppContext from './context'

export const proxyHandler = (ctx: AppContext): CatchallHandler => {
  const accessStandard = ctx.authVerifier.accessStandard()
  return async (req, res, next) => {
    try {
      const { url, aud, nsid } = await formatUrlAndAud(ctx, req)
      const auth = await accessStandard({ req, res })
      if (
        PROTECTED_METHODS.has(nsid) ||
        (!auth.credentials.isPrivileged && PRIVILEGED_METHODS.has(nsid))
      ) {
        throw new InvalidRequestError('Bad token method', 'InvalidToken')
      }
      const headers = await formatHeaders(ctx, req, {
        aud,
        lxm: nsid,
        requester: auth.credentials.did,
      })
      const body: webStream.ReadableStream<Uint8Array> =
        stream.Readable.toWeb(req)
      const reqInit = formatReqInit(req, headers, body)
      const proxyRes = await makeRequest(url, reqInit)
      await pipeProxyRes(proxyRes, res)
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
): Promise<HandlerPipeThrough> => {
  const { url, aud, nsid } = await formatUrlAndAud(ctx, req, override.aud)
  const lxm = override.lxm ?? nsid
  const headers = await formatHeaders(ctx, req, { aud, lxm, requester })
  const reqInit = formatReqInit(req, headers)
  const res = await makeRequest(url, reqInit)
  return parseProxyRes(res)
}

export const pipethroughProcedure = async (
  ctx: AppContext,
  req: express.Request,
  requester: string | null,
  body?: LexValue,
): Promise<HandlerPipeThrough> => {
  const { url, aud, nsid: lxm } = await formatUrlAndAud(ctx, req)
  const headers = await formatHeaders(ctx, req, { aud, lxm, requester })
  const encodedBody = body
    ? new TextEncoder().encode(stringifyLex(body))
    : undefined
  const reqInit = formatReqInit(req, headers, encodedBody)
  const res = await makeRequest(url, reqInit)
  return parseProxyRes(res)
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
  if (!ctx.cfg.service.devMode && !isSafeUrl(url)) {
    throw new InvalidRequestError(`Invalid service url: ${url.toString()}`)
  }
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

const formatReqInit = (
  req: express.Request,
  headers: Record<string, string>,
  body?: Uint8Array | webStream.ReadableStream<Uint8Array>,
): RequestInit => {
  if (req.method === 'GET') {
    return {
      method: 'get',
      headers,
    }
  } else if (req.method === 'HEAD') {
    return {
      method: 'head',
      headers,
    }
  } else if (req.method === 'POST') {
    return {
      method: 'post',
      headers,
      body,
      duplex: 'half',
    } as RequestInit
  } else {
    throw new InvalidRequestError('Method not found')
  }
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

export const makeRequest = async (
  url: URL,
  reqInit: RequestInit,
): Promise<Response> => {
  let res: Response
  try {
    res = await fetch(url, reqInit)
  } catch (err) {
    httpLogger.warn({ err }, 'pipethrough network error')
    throw new XRPCError(ResponseType.UpstreamFailure)
  }
  if (res.status !== ResponseType.Success) {
    const arrBuffer = await readArrayBufferRes(res)
    const ui8Buffer = new Uint8Array(arrBuffer)
    const errInfo = safeParseJson(ui8.toString(ui8Buffer, 'utf8'))
    throw new XRPCError(
      res.status,
      safeString(errInfo?.['error']),
      safeString(errInfo?.['message']),
      simpleHeaders(res.headers),
    )
  }
  return res
}

// Response parsing/forwarding
// -------------------

const RES_HEADERS_TO_FORWARD = [
  'content-type',
  'content-language',
  'atproto-repo-rev',
  'atproto-content-labelers',
]

export const pipeProxyRes = async (
  upstreamRes: Response,
  ownRes: express.Response,
) => {
  for (const headerName of RES_HEADERS_TO_FORWARD) {
    const headerVal = upstreamRes.headers.get(headerName)
    if (headerVal) {
      ownRes.setHeader(headerName, headerVal)
    }
  }
  if (upstreamRes.body) {
    const contentLength = upstreamRes.headers.get('content-length')
    const contentEncoding = upstreamRes.headers.get('content-encoding')
    if (contentLength && (!contentEncoding || contentEncoding === 'identity')) {
      ownRes.setHeader('content-length', contentLength)
    } else {
      ownRes.setHeader('transfer-encoding', 'chunked')
    }
    ownRes.status(200)
    const resStream = stream.Readable.fromWeb(
      upstreamRes.body as webStream.ReadableStream<Uint8Array>,
    )
    await stream.promises.pipeline(resStream, ownRes)
  } else {
    ownRes.status(200).end()
  }
}

export const parseProxyRes = async (res: Response) => {
  const buffer = await readArrayBufferRes(res)
  const encoding = res.headers.get('content-type') ?? 'application/json'
  const resHeaders = RES_HEADERS_TO_FORWARD.reduce(
    (acc, cur) => {
      acc[cur] = res.headers.get(cur) ?? undefined
      return acc
    },
    {} as Record<string, string | undefined>,
  )
  return { encoding, buffer, headers: noUndefinedVals(resHeaders) }
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

export const parseRes = <T>(nsid: string, res: HandlerPipeThrough): T => {
  const buffer = new Uint8Array(res.buffer)
  const json = safeParseJson(ui8.toString(buffer, 'utf8'))
  const lex = json && jsonToLex(json)
  return lexicons.assertValidXrpcOutput(nsid, lex) as T
}

const readArrayBufferRes = async (res: Response): Promise<ArrayBuffer> => {
  try {
    return await res.arrayBuffer()
  } catch (err) {
    httpLogger.warn({ err }, 'pipethrough network error')
    throw new XRPCError(ResponseType.UpstreamFailure)
  }
}

// @TODO: improve SSRF protection (use safeFetch instead of relying on this)
const isSafeUrl = (url: URL) => {
  if (url.protocol !== 'https:') return false
  if (!url.hostname || url.hostname === 'localhost') return false
  // IPv6 hostnames are surrounded by brackets
  if (url.hostname.startsWith('[') && url.hostname.endsWith(']')) return false
  // IPv4
  if (net.isIP(url.hostname) !== 0) return false
  return true
}

const safeString = (str: string): string | undefined => {
  return typeof str === 'string' ? str : undefined
}

const safeParseJson = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

const simpleHeaders = (headers: Headers): Record<string, string> => {
  const result = {}
  for (const [key, val] of headers) {
    result[key] = val
  }
  return result
}
