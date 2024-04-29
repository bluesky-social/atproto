import express from 'express'
import * as ui8 from 'uint8arrays'
import net from 'node:net'
import { LexValue, jsonToLex, stringifyLex } from '@atproto/lexicon'
import { HandlerPipeThrough, InvalidRequestError } from '@atproto/xrpc-server'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import { ids, lexicons } from './lexicon/lexicons'
import { httpLogger } from './logger'
import { getServiceEndpoint, noUndefinedVals } from '@atproto/common'
import AppContext from './context'

type PipethroughOptions = {
  /**
   * Request headers to pass-through, in addition to those defined in
   * {@link REQ_HEADERS_TO_FORWARD}
   */
  reqHeadersToForward?: string[]
}

const defaultService = (
  ctx: AppContext,
  path: string,
): { url: string; did: string } | null => {
  const nsid = path.replace('/xrpc/', '')
  switch (nsid) {
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

export const pipethrough = async (
  ctx: AppContext,
  req: express.Request,
  requester?: string,
  audOverride?: string,
  options?: PipethroughOptions,
): Promise<HandlerPipeThrough> => {
  const { url, headers } = await createUrlAndHeaders(
    ctx,
    req,
    requester,
    audOverride,
    options,
  )
  const reqInit: RequestInit = {
    headers,
  }
  return doProxy(url, reqInit)
}

export const pipethroughProcedure = async (
  ctx: AppContext,
  req: express.Request,
  body: LexValue,
  requester?: string,
  audOverride?: string,
) => {
  const { url, headers } = await createUrlAndHeaders(
    ctx,
    req,
    requester,
    audOverride,
  )
  const reqInit: RequestInit & { duplex: string } = {
    method: 'post',
    headers,
    body: new TextEncoder().encode(stringifyLex(body)),
    duplex: 'half',
  }
  return doProxy(url, reqInit)
}

export const parseProxyHeader = async (
  ctx: AppContext,
  req: express.Request,
): Promise<{ did: string; serviceUrl: string } | undefined> => {
  const proxyTo = req.header('atproto-proxy')
  if (!proxyTo) return
  const [did, serviceId] = proxyTo.split('#')
  if (!serviceId) {
    throw new InvalidRequestError('no service id specified')
  }
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

const REQ_HEADERS_TO_FORWARD = [
  'accept-language',
  'content-type',
  'atproto-accept-labelers',
]

export const createUrlAndHeaders = async (
  ctx: AppContext,
  req: express.Request,
  requester?: string,
  audOverride?: string,
  options?: PipethroughOptions,
): Promise<{ url: URL; headers: { authorization?: string } }> => {
  const proxyTo = await parseProxyHeader(ctx, req)
  const defaultProxy = defaultService(ctx, req.path)
  const serviceUrl = proxyTo?.serviceUrl ?? defaultProxy?.url
  const aud = audOverride ?? proxyTo?.did ?? defaultProxy?.did
  if (!serviceUrl || !aud) {
    throw new InvalidRequestError(`No service configured for ${req.path}`)
  }
  const url = new URL(req.originalUrl, serviceUrl)
  if (!ctx.cfg.service.devMode && !isSafeUrl(url)) {
    throw new InvalidRequestError(`Invalid service url: ${url.toString()}`)
  }
  const headers = requester
    ? (await ctx.serviceAuthHeaders(requester, aud)).headers
    : {}
  const allowedHeaders = REQ_HEADERS_TO_FORWARD.concat(
    options?.reqHeadersToForward ?? [],
  )
  // forward select headers to upstream services
  for (const header of allowedHeaders) {
    const val = req.headers[header]
    if (val) {
      headers[header] = val
    }
  }
  return { url, headers }
}

export const doProxy = async (url: URL, reqInit: RequestInit) => {
  let res: Response
  let buffer: ArrayBuffer
  try {
    res = await fetch(url, reqInit)
    buffer = await res.arrayBuffer()
  } catch (err) {
    httpLogger.warn({ err }, 'pipethrough network error')
    throw new XRPCError(ResponseType.UpstreamFailure)
  }
  if (res.status !== ResponseType.Success) {
    const ui8Buffer = new Uint8Array(buffer)
    const errInfo = safeParseJson(ui8.toString(ui8Buffer, 'utf8'))
    throw new XRPCError(
      res.status,
      safeString(errInfo?.['error']),
      safeString(errInfo?.['message']),
      simpleHeaders(res.headers),
    )
  }
  const encoding = res.headers.get('content-type') ?? 'application/json'
  const resHeaders = makeResHeaders(res)
  return { encoding, buffer, headers: resHeaders }
}

const RES_HEADERS_TO_FORWARD = [
  'atproto-repo-rev',
  'content-language',
  'atproto-content-labelers',
]

const makeResHeaders = (res: Response): Record<string, string> => {
  const headers = RES_HEADERS_TO_FORWARD.reduce(
    (acc, cur) => {
      acc[cur] = res.headers.get(cur) ?? undefined
      return acc
    },
    {} as Record<string, string | undefined>,
  )
  return noUndefinedVals(headers)
}

const isSafeUrl = (url: URL) => {
  if (url.protocol !== 'https:') return false
  if (!url.hostname || url.hostname === 'localhost') return false
  if (net.isIP(url.hostname) !== 0) return false
  return true
}

export const parseRes = <T>(nsid: string, res: HandlerPipeThrough): T => {
  const buffer = new Uint8Array(res.buffer)
  const json = safeParseJson(ui8.toString(buffer, 'utf8'))
  const lex = json && jsonToLex(json)
  return lexicons.assertValidXrpcOutput(nsid, lex) as T
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
