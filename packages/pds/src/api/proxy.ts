import { IncomingMessage } from 'node:http'
import express from 'express'
import { Headers } from '@atproto/xrpc'
import { InvalidRequestError } from '@atproto/xrpc-server'

export const resultPassthru = <T>(result: { headers: Headers; data: T }) => {
  // @TODO pass through any headers that we always want to forward along
  return {
    encoding: 'application/json' as const,
    body: result.data,
  }
}

export function authPassthru(req: IncomingMessage) {
  const { authorization } = req.headers

  if (authorization) {
    // DPoP requests are bound to the endpoint being called. Allowing them to be
    // proxied would require that the receiving end allows DPoP proof not
    // created for him. Since proxying is mainly there to support legacy
    // clients, and DPoP is a new feature, we don't support DPoP requests
    // through the proxy.

    // This is fine since app views are usually called using the requester's
    // credentials when "auth.credentials.type === 'access'", which is the only
    // case were DPoP is used.
    const [type] = authorization.split(' ', 1)
    if (!type) {
      throw new InvalidRequestError('Invalid authorization header')
    }
    if (type.toLowerCase() === 'dpop' || req.headers['dpop']) {
      throw new InvalidRequestError('DPoP requests cannot be proxied')
    }

    return { headers: { authorization } }
  }
}

// @NOTE this function may mutate its params input
// future improvement here would be to forward along all untrusted ips rather than just the first (req.ip)
export const forwardedFor = (
  req: express.Request,
  params: HeadersParam | undefined,
) => {
  const result: HeadersParam = params ?? { headers: {} }
  const ip = req.ip
  if (ip) {
    result.headers['x-forwarded-for'] = ip
  }
  return result
}

type HeadersParam = { headers: Record<string, string> }
