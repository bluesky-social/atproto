import { HandlerPipeThrough } from '@atproto/xrpc-server'
import AppContext from './context'

export const pipethrough = async (
  ctx: AppContext,
  nsid: string,
  requester: string,
  params?: Record<string, any>,
): Promise<HandlerPipeThrough> => {
  const url = constructUrl(ctx.cfg.bskyAppView.url, nsid, params)
  const headers = await ctx.appviewAuthHeaders(requester)
  const res = await fetch(url, { ...headers })
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
