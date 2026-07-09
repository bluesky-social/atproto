import { Code, ConnectError, type Interceptor } from '@connectrpc/connect'
import * as ui8 from 'uint8arrays'
import { getDidKeyFromMultibase } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'

export const callerInterceptor =
  (caller: string): Interceptor =>
  (next) =>
  (req) => {
    req.header.set('x-atlantis-caller', caller)
    return next(req)
  }

export const isDataplaneError = (
  err: unknown,
  code?: Code,
): err is ConnectError => {
  if (err instanceof ConnectError) {
    return !code || err.code === code
  }
  return false
}

// Rethrows a dataplane InvalidArgument error as a client-facing 400, with an
// optional message. Use as a `.catch()` handler on a dataplane call whose args
// come from user input. Returns `never`, so the awaited result keeps its type.
// Any other error passes through unchanged.
export const asInvalidRequest =
  (message = 'Invalid request') =>
  (err: unknown): never => {
    if (isDataplaneError(err, Code.InvalidArgument)) {
      throw new InvalidRequestError(message)
    }
    throw err
  }

export const unpackIdentityServices = (servicesBytes: Uint8Array) => {
  const servicesStr = ui8.toString(servicesBytes, 'utf8')
  if (!servicesStr) return {}
  return JSON.parse(servicesStr) as UnpackedServices
}

export const unpackIdentityKeys = (keysBytes: Uint8Array) => {
  const keysStr = ui8.toString(keysBytes, 'utf8')
  if (!keysStr) return {}
  return JSON.parse(keysStr) as UnpackedKeys
}

export const getServiceEndpoint = (
  services: UnpackedServices,
  opts: { id: string; type: string },
) => {
  const endpoint =
    services[opts.id] &&
    services[opts.id].Type === opts.type &&
    validateUrl(services[opts.id].URL)
  return endpoint || undefined
}

export const getKeyAsDidKey = (keys: UnpackedKeys, opts: { id: string }) => {
  const key =
    keys[opts.id] &&
    getDidKeyFromMultibase({
      type: keys[opts.id].Type,
      publicKeyMultibase: keys[opts.id].PublicKeyMultibase,
    })
  return key || undefined
}

type UnpackedServices = Record<string, { Type: string; URL: string }>

type UnpackedKeys = Record<string, { Type: string; PublicKeyMultibase: string }>

const validateUrl = (urlStr: string): string | undefined => {
  let url
  try {
    url = new URL(urlStr)
  } catch {
    return undefined
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return undefined
  } else if (!url.hostname) {
    return undefined
  } else {
    return urlStr
  }
}
