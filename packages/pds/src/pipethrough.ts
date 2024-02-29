import express from 'express'
import * as ui8 from 'uint8arrays'
import net from 'node:net'
import { jsonToLex } from '@atproto/lexicon'
import { HandlerPipeThrough, InvalidRequestError } from '@atproto/xrpc-server'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import { lexicons } from './lexicon/lexicons'
import { httpLogger } from './logger'
import { getServiceEndpoint, noUndefinedVals } from '@atproto/common'
import AppContext from './context'

export const pipethrough = async (
  ctx: AppContext,
  req: express.Request,
  requester?: string,
  audOverride?: string,
): Promise<HandlerPipeThrough> => {
  const proxyTo = await parseProxyHeader(ctx, req)
  const serviceUrl = proxyTo?.serviceUrl ?? ctx.cfg.bskyAppView?.url
  const aud = audOverride ?? proxyTo?.did ?? ctx.cfg.bskyAppView?.did
  if (!serviceUrl || !aud) {
    throw new InvalidRequestError(`No service configured for ${req.path}`)
  }
  const url = new URL(req.originalUrl, serviceUrl)
  if (!ctx.cfg.service.devMode && !isSafeUrl(url)) {
    throw new InvalidRequestError(`Invalid service url: ${url.toString()}`)
  }
  const reqHeaders = requester
    ? await ctx.serviceAuthHeaders(requester, aud)
    : { headers: {} }
  // forward accept-language header to upstream services
  reqHeaders.headers['accept-language'] = req.headers['accept-language']
  let res: Response
  let buffer: ArrayBuffer
  try {
    res = await fetch(url, reqHeaders)
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
  const repoRevHeader = res.headers.get('atproto-repo-rev')
  const contentLanguage = res.headers.get('content-language')
  const resHeaders = noUndefinedVals({
    ['atproto-repo-rev']: repoRevHeader ?? undefined,
    ['content-language']: contentLanguage ?? undefined,
  })
  return { encoding, buffer, headers: resHeaders }
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

export const constructUrl = (
  serviceUrl: string,
  nsid: string,
  params?: Record<string, any>,
): string => {
  const uri = new URL(serviceUrl)
  uri.pathname = `/xrpc/${nsid}`

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) {
      continue
    } else if (Array.isArray(value)) {
      for (const item of value) {
        uri.searchParams.append(key, String(item))
      }
    } else {
      uri.searchParams.set(key, String(value))
    }
  }

  return uri.toString()
}

const isSafeUrl = (url: URL) => {
  if (url.protocol !== 'https:') return false
  if (!url.hostname || url.hostname === 'localhost') return false
  if (net.isIP(url.hostname) === 0) return false
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
