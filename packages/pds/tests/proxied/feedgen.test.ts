import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { app } from '../../src'
import { forSnapshot } from '../_util'
import basicSeed from '../seeds/basic'

describe('feedgen proxy view', () => {
  let network: TestNetwork
  let client: Client
  let sc: SeedClient
  let feedUri: AtUri

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_feedgen',
    })
    client = network.pds.getClient()
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
    await client.create(
      app.bsky.feed.generator,
      {
        did: feedGen.did,
        displayName: 'Test feed',
        createdAt: new Date().toISOString(),
      },
      {
        repo: sc.dids.alice,
        rkey: feedUri.rkey,
        headers: sc.getHeaders(sc.dids.alice),
      },
    )
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('performs basic proxy of getFeed', async () => {
    const feed = await client.call(
      app.bsky.feed.getFeed,
      { feed: feedUri.toString() },
      { headers: { ...sc.getHeaders(sc.dids.alice) } },
    )
    expect(forSnapshot(feed)).toMatchSnapshot()
  })
})
