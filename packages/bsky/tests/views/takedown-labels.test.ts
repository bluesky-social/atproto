import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'

describe('bsky takedown labels', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_takedown_labels',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const addTakedownLabels = async (subjects: string[]) => {
    if (subjects.length === 0) return
    const src = network.ozone.ctx.cfg.service.did
    const cts = new Date().toISOString()
    const labels = subjects.map((uri) => ({
      src,
      uri,
      cid: '',
      val: '!takedown',
      neg: false,
      cts,
    }))

    await network.bsky.db.db.insertInto('label').values(labels).execute()
  }
  const clearTakedownLabels = async () => {
    await network.bsky.db.db
      .deleteFrom('label')
      .where('val', '=', '!takedown')
      .execute()
  }

  it('takesdown posts', async () => {
    await addTakedownLabels([
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.dids.carol,
    ])
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

    expect(posts.data.posts.length).toBe(4)
    expect(posts.data.posts.some((p) => p.author.did === sc.dids.carol)).toBe(
      false,
    )
    expect(
      posts.data.posts.some(
        (p) => p.uri === sc.posts[sc.dids.alice][0].ref.uriStr,
      ),
    ).toBe(false)

    await clearTakedownLabels()
  })
})
