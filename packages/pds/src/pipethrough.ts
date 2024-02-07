import * as ui8 from 'uint8arrays'
import { jsonToLex } from '@atproto/lexicon'
import { HandlerPipeThrough } from '@atproto/xrpc-server'
import { CallOptions, ResponseType, XRPCError } from '@atproto/xrpc'
import { lexicons } from './lexicon/lexicons'
import { httpLogger } from './logger'
import { noUndefinedVals } from '@atproto/common'

export const pipethrough = async (
  serviceUrl: string,
  nsid: string,
  params: Record<string, any>,
  opts?: CallOptions,
): Promise<HandlerPipeThrough> => {
  const url = constructUrl(serviceUrl, nsid, params)
  let res: Response
  let buffer: ArrayBuffer
  try {
    res = await fetch(url, opts)
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
  const headers = noUndefinedVals({
    ['atproto-repo-rev']: repoRevHeader ?? undefined,
    ['content-language']: contentLanguage ?? undefined,
  })
  return { encoding, buffer, headers }
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
