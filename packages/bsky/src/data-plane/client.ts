import assert from 'node:assert'
import { randomInt } from 'node:crypto'
import { Service } from '../proto/bsky_connect'
import {
  Code,
  ConnectError,
  PromiseClient,
  createPromiseClient,
  makeAnyClient,
} from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-node'

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
          if (err instanceof ConnectError && err.code === Code.Unavailable) {
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
  const transport = createConnectTransport({
    baseUrl,
    httpVersion,
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
