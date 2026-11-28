import { once } from 'node:events'
import http from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  type MockInstance,
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { events } from '../../dist/events.js'

// @NOTE The PDS runs from dist, so these spy on the events instance it reports
// to. How each event reaches its OTEL instrument is unit tested in
// src/events.test.ts.
describe.each([false, true])(
  'PDS AppView request limit metrics (enabled: %s)',
  (enabled) => {
    let appview: http.Server
    let network: TestNetworkNoAppView
    let grantedEvents: MockInstance<typeof events.appViewRequestGranted>
    let rejectedEvents: MockInstance<typeof events.appViewRequestRejected>
    // Responses the fake AppView is holding open
    let held: http.ServerResponse[]
    let holding: boolean
    let arrivals: number

    const answer = (res: http.ServerResponse) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    }
    const releaseAll = () => {
      holding = false
      for (const res of held.splice(0)) answer(res)
    }

    // Needs no account: the PDS forwards it to the AppView for a repo it does
    // not host.
    const getRemoteRecord = () => {
      const url = new URL('/xrpc/com.atproto.repo.getRecord', network.pds.url)
      url.searchParams.set('repo', 'did:plc:notonthispds')
      url.searchParams.set('collection', 'app.bsky.feed.post')
      url.searchParams.set('rkey', 'abc')
      return fetch(url)
    }

    beforeAll(async () => {
      grantedEvents = vi.spyOn(events, 'appViewRequestGranted')
      rejectedEvents = vi.spyOn(events, 'appViewRequestRejected')
      held = []
      holding = false
      appview = http.createServer((_req, res) => {
        arrivals++
        if (holding) held.push(res)
        else answer(res)
      })
      appview.listen(0, '127.0.0.1')
      await once(appview, 'listening')
      const address = appview.address()
      if (address === null || typeof address === 'string') {
        throw new Error('expected a TCP address')
      }

      network = await TestNetworkNoAppView.create({
        pds: {
          bskyAppViewUrl: `http://127.0.0.1:${address.port}`,
          bskyAppViewDid: 'did:example:fakeappview',
          bskyAppViewMaxRequestsPerSecond: 0,
          bskyAppViewMaxConcurrentRequests: enabled ? 1 : 0,
          bskyAppViewMaxQueuedRequests: 0,
          bskyAppViewMaxQueueMs: 60_000,
        },
      })
    })

    afterAll(async () => {
      releaseAll()
      await network?.close()
      appview?.close()
      grantedEvents?.mockRestore()
      rejectedEvents?.mockRestore()
    })

    beforeEach(() => {
      grantedEvents.mockClear()
      rejectedEvents.mockClear()
      arrivals = 0
    })

    it('records the wait of a request sent to the AppView', async () => {
      const res = await getRemoteRecord()
      expect(res.status).toBe(200)
      await res.text()

      expect(arrivals).toBe(1)
      expect(grantedEvents.mock.calls).toEqual(enabled ? [[{ waitMs: 0 }]] : [])
    })

    // resolveHandle asks the AppView with ctx.bskyAppView.client, not through
    // the proxy agent, for a handle this PDS does not host.
    it("records the wait of a handler's own request to the AppView", async () => {
      const url = new URL(
        '/xrpc/com.atproto.identity.resolveHandle',
        network.pds.url,
      )
      url.searchParams.set('handle', 'bob.example.com')
      await (await fetch(url)).text()

      expect(arrivals).toBe(1)
      expect(grantedEvents.mock.calls).toEqual(enabled ? [[{ waitMs: 0 }]] : [])
    })

    if (enabled) {
      it('counts a request the limit turned away', async () => {
        holding = true
        const inFlight = getRemoteRecord()
        // The one slot is taken once the fake AppView holds the first request
        const deadline = Date.now() + 10_000
        while (held.length === 0) {
          if (Date.now() > deadline) throw new Error('AppView got no request')
          await sleep(10)
        }

        const rejected = await getRemoteRecord()
        expect(rejected.status).toBe(429)
        await rejected.text()

        expect(rejectedEvents.mock.calls).toEqual([[{ reason: 'queue_full' }]])

        releaseAll()
        await (await inFlight).text()
      })
    }
  },
)
