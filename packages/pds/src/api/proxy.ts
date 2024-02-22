import { Headers } from '@atproto/xrpc'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { IncomingMessage } from 'node:http'

export const resultPassthru = <T>(result: { headers: Headers; data: T }) => {
  // @TODO pass through any headers that we always want to forward along
  return {
    encoding: 'application/json' as const,
    body: result.data,
  }
}

// Output designed to passed as second arg to AtpAgent methods.
// The encoding field here is a quirk of the AtpAgent.
export function authPassthru(
  req: IncomingMessage,
  withEncoding?: false,
): { headers: { authorization: string }; encoding: undefined } | undefined

export function authPassthru(
  req: IncomingMessage,
  withEncoding: true,
):
  | { headers: { authorization: string }; encoding: 'application/json' }
  | undefined

export function authPassthru(req: IncomingMessage, withEncoding?: boolean) {
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
    if (authorization.startsWith('DPoP ') || req.headers['dpop']) {
      throw new InvalidRequestError('DPoP requests cannot be proxied')
    }

    return {
      headers: { authorization },
      encoding: withEncoding ? 'application/json' : undefined,
    }
  }
}
