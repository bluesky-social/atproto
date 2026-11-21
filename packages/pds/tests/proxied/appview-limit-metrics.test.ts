import { once } from 'node:events'
import http from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { createNoopMeter, metrics } from '@opentelemetry/api'

// The PDS takes its meter when its modules load, so this provider has to be
// registered before @atproto/dev-env, and with it the PDS, is imported.
type Measurement = { name: string; value: number; attributes?: object }
const measurements: Measurement[] = []
const measure = (name: string) => (value: number, attributes?: object) => {
  measurements.push({ name, value, attributes })
}
const registered = metrics.setGlobalMeterProvider({
  getMeter: () =>
    Object.assign(Object.create(createNoopMeter()), {
      createHistogram: (name: string) => ({ record: measure(name) }),
      createCounter: (name: string) => ({ add: measure(name) }),
    }),
})

const { TestNetworkNoAppView } = await import('@atproto/dev-env')

describe('PDS metrics for its limit on requests to the AppView', () => {
  let appview: http.Server
  let network: InstanceType<typeof TestNetworkNoAppView>
  // Responses the fake AppView is holding open
  let held: http.ServerResponse[]
  let holding: boolean

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

  const named = (name: string) => measurements.filter((m) => m.name === name)

  beforeAll(async () => {
    held = []
    holding = false
    appview = http.createServer((_req, res) => {
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
        bskyAppViewMaxConcurrentRequests: 1,
        bskyAppViewMaxQueuedRequests: 0,
        bskyAppViewMaxQueueMs: 60_000,
      },
    })
  })

  afterAll(async () => {
    releaseAll()
    await network?.close()
    appview?.close()
  })

  beforeEach(() => {
    measurements.length = 0
  })

  it('registered the test meter provider', () => {
    expect(registered).toBe(true)
  })

  it('records the wait of a request sent to the AppView', async () => {
    const res = await getRemoteRecord()
    expect(res.status).toBe(200)
    await res.text()

    expect(named('appview.request.limit.wait')).toEqual([
      { name: 'appview.request.limit.wait', value: 0, attributes: undefined },
    ])
  })

  it('counts a request the limit turned away', async () => {
    holding = true
    const inFlight = getRemoteRecord()
    // The one slot is taken once the fake AppView holds the first request
    while (held.length === 0) await sleep(10)

    const rejected = await getRemoteRecord()
    expect(rejected.status).toBe(429)
    await rejected.text()

    expect(named('appview.request.limit.rejected')).toEqual([
      {
        name: 'appview.request.limit.rejected',
        value: 1,
        attributes: { reason: 'queue_full' },
      },
    ])

    releaseAll()
    await (await inFlight).text()
  })
})
