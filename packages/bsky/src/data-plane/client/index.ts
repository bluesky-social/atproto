import assert from 'node:assert'
import { randomInt } from 'node:crypto'
import {
  Code,
  ConnectError,
  PromiseClient,
  createPromiseClient,
  makeAnyClient,
} from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { Service } from '../../proto/bsky_connect'
import { HostList } from './hosts'

export * from './hosts'
export * from './util'

export type DataPlaneClient = PromiseClient<typeof Service>
type HttpVersion = '1.1' | '2'
const MAX_RETRIES = 3

export const createDataPlaneClient = (
  hostList: HostList,
  opts: { httpVersion?: HttpVersion; rejectUnauthorized?: boolean },
) => {
  const clients = new DataPlaneClients(hostList, opts)
  return makeAnyClient(Service, (method) => {
    return async (...args) => {
      let tries = 0
      let error: unknown
      let remainingClients = clients.get()
      while (tries < MAX_RETRIES) {
        const client = randomElement(remainingClients)
        assert(client, 'no clients available')
        try {
          return await client[method.localName](...args)
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

/**
 * Uses a reactive HostList in order to maintain a pool of DataPlaneClients.
 * Each DataPlaneClient is cached per host so that it maintains connections
 * and other internal state when the underlying HostList is updated.
 */
class DataPlaneClients {
  private clients: DataPlaneClient[] = []
  private clientsByHost = new Map<string, DataPlaneClient>()

  constructor(
    private hostList: HostList,
    private clientOpts: {
      httpVersion?: HttpVersion
      rejectUnauthorized?: boolean
    },
  ) {
    this.refresh()
    this.hostList.onUpdate(() => this.refresh())
  }

  get(): readonly DataPlaneClient[] {
    return this.clients
  }

  private refresh() {
    this.clients = []
    for (const host of this.hostList.get()) {
      let client = this.clientsByHost.get(host)
      if (!client) {
        client = this.createClient(host)
        this.clientsByHost.set(host, client)
      }
      this.clients.push(client)
    }
  }

  private createClient(host: string) {
    return createBaseClient(host, this.clientOpts)
  }
}

const createBaseClient = (
  baseUrl: string,
  opts: { httpVersion?: HttpVersion; rejectUnauthorized?: boolean },
): DataPlaneClient => {
  const { httpVersion = '2', rejectUnauthorized = true } = opts
  const transport = createGrpcTransport({
    baseUrl,
    httpVersion,
    acceptCompression: [],
    nodeOptions: { rejectUnauthorized },
  })
  return createPromiseClient(Service, transport)
}

const getRemainingClients = (
  clients: readonly DataPlaneClient[],
  lastClient: DataPlaneClient,
) => {
  if (clients.length < 2) return clients // no clients to choose from
  return clients.filter((c) => c !== lastClient)
}

const randomElement = <T>(arr: readonly T[]): T | undefined => {
  if (arr.length === 0) return
  return arr[randomInt(arr.length)]
}
