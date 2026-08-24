import { AtUri, type AtpAgent } from '@atproto/api'
import { type SeedClient, TestNetwork } from '@atproto/dev-env'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { forSnapshot } from '../_util.js'
import basicSeed from '../seeds/basic.js'
import { ProxyServer } from './proxy-server.js'

describe('feedgen proxy view', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let feedUri: AtUri
  let altAppView: ProxyServer

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_feedgen',
    })
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc, { addModLabels: network.bsky })

    feedUri = AtUri.make(sc.dids.alice, 'app.bsky.feed.generator', 'mutuals')

    const feedGen = await network.createFeedGen({
      [feedUri.toString()]: ({ params }) => {
        if (params.feed !== feedUri.toString()) {
          throw new InvalidRequestError('Unknown feed')
        }
        return {
          encoding: 'application/json',
          body: {
            feed: [
              { post: sc.posts[sc.dids.alice][0].ref.uriStr },
              { post: sc.posts[sc.dids.carol][0].ref.uriStr },
            ],
          },
        }
      },
    })

    // publish feed
    await agent.api.app.bsky.feed.generator.create(
      { repo: sc.dids.alice, rkey: feedUri.rkey },
      {
        did: feedGen.did,
        displayName: 'Test feed',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.alice),
    )
    await network.processAll()

    altAppView = await ProxyServer.create(
      network.pds.ctx.plcClient,
      network.pds.ctx.plcRotationKey,
      'bsky_appview',
      { upstream: network.bsky.url },
    )
  })

  afterAll(async () => {
    await altAppView?.close()
    await network?.close()
  })

  it('performs basic proxy of getFeed', async () => {
    const { data: feed } = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri.toString() },
      {
        headers: { ...sc.getHeaders(sc.dids.alice) },
      },
    )
    expect(forSnapshot(feed)).toMatchSnapshot()
  })

  it('resolves the feed generator through the app view named by the proxy header', async () => {
    const { data: expected } = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri.toString() },
      { headers: { ...sc.getHeaders(sc.dids.alice) } },
    )
    const { data: feed } = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri.toString() },
      {
        headers: {
          ...sc.getHeaders(sc.dids.alice),
          'atproto-proxy': `${altAppView.did}#bsky_appview`,
        },
      },
    )
    expect(feed).toEqual(expected)

    const paths = altAppView.requests.map((r) => r.url.split('?')[0])
    expect(paths).toEqual([
      '/xrpc/com.atproto.repo.getRecord',
      '/xrpc/app.bsky.feed.getFeed',
    ])
  })
})
