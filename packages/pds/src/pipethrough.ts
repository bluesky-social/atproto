import { HandlerPipeThrough } from '@atproto/xrpc-server'
import { CallOptions } from '@atproto/xrpc'

export const pipethrough = async (
  serviceUrl: string,
  nsid: string,
  params: Record<string, any>,
  opts?: CallOptions,
): Promise<HandlerPipeThrough> => {
  const url = constructUrl(serviceUrl, nsid, params)
  const res = await fetch(url, opts)
  const encoding = res.headers.get('content-type') ?? 'application/json'
  const buffer = await res.arrayBuffer()
  return {
    encoding,
    buffer,
  }
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
        uri.searchParams.set(key, String(item))
      }
    } else {
      uri.searchParams.set(key, String(value))
    }
  }

  return uri.toString()
}

export const parseRes = <T>(nsid: string, res: HandlerPipeThrough): T => {
  return {} as any
}
