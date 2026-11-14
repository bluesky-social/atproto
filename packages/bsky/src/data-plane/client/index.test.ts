import { once } from 'node:events'
import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  Code,
  ConnectError,
  type ConnectRouter,
  type ServiceImpl,
} from '@connectrpc/connect'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import express from 'express'
import { afterAll, describe, expect, it } from 'vitest'
import { Service } from '../../proto/bsky_connect.js'
import { SearchActorsTypeaheadResponse } from '../../proto/bsky_pb.js'
import { realIpStore } from '../../real-ip.js'
import { BasicHostList } from './hosts.js'
import { createDataPlaneClient } from './index.js'

describe('createDataPlaneClient', () => {
  const servers: http.Server[] = []
  afterAll(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    )
  })

  // Runs a Connect server that records the x-real-ip header seen by each
  // attempt, optionally failing the first attempt to force a retry.
  const startServer = async (opts?: { failFirstAttempt?: boolean }) => {
    const attempts: (string | undefined)[] = []
    const app = express()
    app.use(
      expressConnectMiddleware({
        routes: (router: ConnectRouter) =>
          router.service(Service, {
            searchActorsTypeahead: async (_req, ctx) => {
              attempts.push(ctx.requestHeader.get('x-real-ip') ?? undefined)
              if (opts?.failFirstAttempt && attempts.length < 2) {
                throw new ConnectError('retryable', Code.Unavailable)
              }
              return new SearchActorsTypeaheadResponse()
            },
          } satisfies Partial<ServiceImpl<typeof Service>>),
      }),
    )
    const server = app.listen(0)
    servers.push(server)
    await once(server, 'listening')
    const { port } = server.address() as AddressInfo
    const client = createDataPlaneClient(
      new BasicHostList([`http://127.0.0.1:${port}`]),
      { httpVersion: '1.1' },
    )
    return { client, attempts }
  }

  it('forwards the request-scoped address across retries', async () => {
    const { client, attempts } = await startServer({ failFirstAttempt: true })
    const res = await realIpStore.run({ ip: '203.0.113.7' }, () =>
      client.searchActorsTypeahead({ params: { query: 'car', limit: 10 } }),
    )
    expect(res.actors).toEqual([])
    // The retry reused the request-scoped address.
    expect(attempts).toEqual(['203.0.113.7', '203.0.113.7'])
  })

  it('omits the header for authenticated requests', async () => {
    const { client, attempts } = await startServer()
    const res = await realIpStore.run(
      { ip: '203.0.113.7', authenticated: true },
      () =>
        client.searchActorsTypeahead({
          params: { query: 'car', limit: 10 },
        }),
    )
    expect(res.actors).toEqual([])
    expect(attempts).toEqual([undefined])
  })
})
