import assert from 'node:assert'
import { randomInt } from 'node:crypto'
import { Service } from './gen/bsky_connect'
import {
  Code,
  ConnectError,
  PromiseClient,
  createPromiseClient,
  makeAnyClient,
} from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-node'

export type DataPlaneClient = PromiseClient<typeof Service>
type HttpVersion = '1.1' | '2'

export const createDataPlaneClient = (
  baseUrls: string[],
  opts: { httpVersion?: HttpVersion; rejectUnauthorized?: boolean },
) => {
  const clients = baseUrls.map((baseUrl) => createBaseClient(baseUrl, opts))
  assert(clients.length > 0, 'no clients available')
  return makeAnyClient(Service, (method) => {
    return async (...args) => {
      let client = randomElement(clients)
      assert(client, 'no clients available')
      try {
        return await client[method.localName](...args)
      } catch (err) {
        if (err instanceof ConnectError && err.code === Code.Unavailable) {
          // retry immediately on a different client if the first was unavailable
          const remainingClients = clients.filter((c) => c !== client)
          client = randomElement(remainingClients)
          if (client) {
            return await client[method.localName](...args)
          }
        }
        throw err
      }
    }
  }) as DataPlaneClient
}

const createBaseClient = (
  baseUrl: string,
  opts: { httpVersion?: HttpVersion; rejectUnauthorized?: boolean },
): DataPlaneClient => {
  const { httpVersion = '2', rejectUnauthorized = true } = opts
  const transport = createConnectTransport({
    baseUrl,
    httpVersion,
    nodeOptions: { rejectUnauthorized },
  })
  return createPromiseClient(Service, transport)
}

const randomElement = <T>(arr: T[]): T | undefined => {
  if (arr.length === 0) return
  return arr[randomInt(arr.length)]
}
