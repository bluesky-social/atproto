import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { forSnapshot } from '../_util'

describe('proxies timeline skeleton', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_timeline_skeleton',
      pds: {
        enableAppView: true,
      },
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  it('timeline skeleton construction', async () => {
    const res = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )

    expect(forSnapshot(res.data)).toMatchSnapshot()
    const pt1 = await agent.api.app.bsky.feed.getTimeline(
      {
        limit: 2,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    const pt2 = await agent.api.app.bsky.feed.getTimeline(
      {
        cursor: pt1.data.cursor,
      },
      {
        headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' },
      },
    )
    expect([...pt1.data.feed, ...pt2.data.feed]).toEqual(res.data.feed)
  })
})
