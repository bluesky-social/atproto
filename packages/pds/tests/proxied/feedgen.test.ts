import { makeAlgos } from '@atproto/bsky'
import AtpAgent, { AtUri, FeedNS } from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { forSnapshot } from '../_util'

describe('feedgen proxy view', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const origGetFeedGenerator = FeedNS.prototype.getFeedGenerator
  const feedUri = AtUri.make(
    'did:example:feed-publisher',
    'app.bsky.feed.generator',
    'mutuals',
  )

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_feedgen',
      bsky: { algos: makeAlgos(feedUri.host) },
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    // publish feed
    const feed = await agent.api.app.bsky.feed.generator.create(
      { repo: sc.dids.alice, rkey: feedUri.rkey },
      {
        did: network.bsky.ctx.cfg.feedGenDid ?? '',
        displayName: 'Mutuals',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.alice),
    )
    await network.processAll()
    await network.bsky.ctx.backgroundQueue.processAll()
    // mock getFeedGenerator() for use by pds's getFeed since we don't have a proper feedGenDid or feed publisher
    FeedNS.prototype.getFeedGenerator = async function (params, opts) {
      if (params?.feed === feedUri.toString()) {
        return {
          success: true,
          data: {
            isOnline: true,
            isValid: true,
            view: {
              cid: feed.cid,
              uri: feed.uri,
              did: network.bsky.ctx.cfg.feedGenDid ?? '',
              creator: { did: sc.dids.alice, handle: 'alice.test' },
              displayName: 'Mutuals',
              indexedAt: new Date().toISOString(),
            },
          },
          headers: {},
        }
      }
      return origGetFeedGenerator.call(this, params, opts)
    }
  })

  afterAll(async () => {
    FeedNS.prototype.getFeedGenerator = origGetFeedGenerator
    await network.close()
  })

  it('performs basic proxy of getFeed', async () => {
    const { data: feed } = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri.toString() },
      {
        headers: { ...sc.getHeaders(sc.dids.alice), 'x-appview-proxy': 'true' },
      },
    )
    expect(forSnapshot(feed)).toMatchSnapshot()
  })
})
