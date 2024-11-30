import assert from 'node:assert'
import { randomInt } from 'node:crypto'
import * as ui8 from 'uint8arrays'
import {
  Code,
  ConnectError,
  PromiseClient,
  createPromiseClient,
  makeAnyClient,
} from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { getDidKeyFromMultibase } from '@atproto/identity'
import { Service } from '../proto/bsky_connect'

export type DataPlaneClient = PromiseClient<typeof Service>
type BaseClient = { lib: DataPlaneClient; url: URL }
type HttpVersion = '1.1' | '2'
const MAX_RETRIES = 3

export const createDataPlaneClient = (
  baseUrls: string[],
  opts: { httpVersion?: HttpVersion; rejectUnauthorized?: boolean },
) => {
  const clients = baseUrls.map((baseUrl) => createBaseClient(baseUrl, opts))
  assert(clients.length > 0, 'no clients available')
  return makeAnyClient(Service, (method) => {
    return async (...args) => {
      let tries = 0
      let error: unknown
      let remainingClients = clients
      while (tries < MAX_RETRIES) {
        const client = randomElement(remainingClients)
        assert(client, 'no clients available')
        try {
          return await client.lib[method.localName](...args)
        } catch (err) {
          if (
            err instanceof ConnectError &&
            (err.code === Code.Unavailable || err.code === Code.Aborted)
          ) {
            tries++
            error = err
            remainingClients = getRemainingClients(remainingClients, client)
          } else {
            throw err
          }
        }
      }
      assert(error)
      throw error
    }
  }) as DataPlaneClient
}

export { Code }

export const isDataplaneError = (
  err: unknown,
  code?: Code,
): err is ConnectError => {
  if (err instanceof ConnectError) {
    return !code || err.code === code
  }
  return false
}

const createBaseClient = (
  baseUrl: string,
  opts: { httpVersion?: HttpVersion; rejectUnauthorized?: boolean },
): BaseClient => {
  const { httpVersion = '2', rejectUnauthorized = true } = opts
  const transport = createGrpcTransport({
    baseUrl,
    httpVersion,
    acceptCompression: [],
    nodeOptions: { rejectUnauthorized },
  })
  return {
    lib: createPromiseClient(Service, transport),
    url: new URL(baseUrl),
  }
}

const getRemainingClients = (clients: BaseClient[], lastClient: BaseClient) => {
  if (clients.length < 2) return clients // no clients to choose from
  if (lastClient.url.port) {
    // if the last client had a port, we attempt to exclude its whole host.
    const maybeRemaining = clients.filter(
      (c) => c.url.hostname !== lastClient.url.hostname,
    )
    if (maybeRemaining.length) {
      return maybeRemaining
    }
  }
  return clients.filter((c) => c !== lastClient)
}

const randomElement = <T>(arr: T[]): T | undefined => {
  if (arr.length === 0) return
  return arr[randomInt(arr.length)]
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
