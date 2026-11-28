import {
  type Code,
  ConnectError,
  createPromiseClient,
  createRouterTransport,
} from '@connectrpc/connect'
import { assert, expect } from 'vitest'
import { type BsyncClient, authWithApiKey } from '../client.js'
import { envToCfg } from '../config.js'
import { AppContext } from '../context.js'
import type { DataplaneClient } from '../dataplane.js'
import type { Database } from '../db/index.js'
import { Service } from '../proto/bsync_connect.js'
import routes from './index.js'

export const API_KEY = 'key-1'

const noDatabase = new Proxy({} as Database, {
  get(_, key) {
    throw new Error(`unexpected database access: ${String(key)}`)
  },
})

/**
 * Serves the routes in-process, over a context without a database: only for
 * handlers that answer before any query.
 */
export function createTestClient({
  apiKey = API_KEY,
  dataplaneClients = [],
}: {
  /** `null` sends no credentials. */
  apiKey?: string | null
  dataplaneClients?: DataplaneClient[]
} = {}): BsyncClient {
  const ctx = new AppContext({
    db: noDatabase,
    cfg: envToCfg({ dbUrl: 'postgres://unused', apiKeys: [API_KEY] }),
    shutdown: new AbortController().signal,
    dataplaneClients,
  })
  const transport = createRouterTransport(routes(ctx), {
    transport: {
      interceptors: apiKey === null ? [] : [authWithApiKey(apiKey)],
    },
  })
  return createPromiseClient(Service, transport)
}

/**
 * Checks a {@link ConnectError} by code and message, for `rejects.toSatisfy()`.
 * `toEqual(new ConnectError(…))` would also compare the response headers the
 * client puts in `metadata`.
 */
export function isConnectError(message: string, code: Code) {
  return (err: unknown) => {
    assert(err instanceof ConnectError)
    expect(err.code).toBe(code)
    expect(err.rawMessage).toBe(message)
    return true
  }
}
