import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot, stripViewerFromPost } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds posts views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_posts',
    })
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    await network.bsky.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches posts', async () => {
    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][1].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      sc.posts[sc.dids.carol][0].ref.uriStr,
      sc.posts[sc.dids.dan][1].ref.uriStr,
      sc.replies[sc.dids.alice][0].ref.uriStr,
    ]
    const posts = await agent.api.app.bsky.feed.getPosts(
      { uris },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )

    expect(posts.data.posts.length).toBe(uris.length)
    expect(forSnapshot(posts.data.posts)).toMatchSnapshot()
  })

  it('fetches posts unauthed', async () => {
    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][1].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      sc.posts[sc.dids.carol][0].ref.uriStr,
      sc.posts[sc.dids.dan][1].ref.uriStr,
      sc.replies[sc.dids.alice][0].ref.uriStr,
    ]

    const authed = await agent.api.app.bsky.feed.getPosts(
      { uris },
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )
    const unauthed = await agent.api.app.bsky.feed.getPosts({
      uris,
    })
    const stripped = authed.data.posts.map((p) => stripViewerFromPost(p))
    expect(unauthed.data.posts).toEqual(stripped)
  })

  it('handles repeat uris', async () => {
    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
    ]

    const posts = await agent.api.app.bsky.feed.getPosts({ uris })

    expect(posts.data.posts.length).toBe(2)
    const receivedUris = posts.data.posts.map((p) => p.uri).sort()
    const expected = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
    ].sort()
    expect(receivedUris).toEqual(expected)
  })
})
