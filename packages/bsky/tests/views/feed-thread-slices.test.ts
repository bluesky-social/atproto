import { AtpAgent, AppBskyFeedDefs, AtUri } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'

describe('pds thread views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_feed_thread_slices',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol

    sc.follow(carol, alice)
    sc.follow(carol, bob)
  })

  afterAll(async () => {
    await network.close()
  })

  it(`[A] -> [B] -> [C], A blocks B, viewed as C`, async () => {
    const A = await sc.post(alice, `A`)
    await network.processAll()
    const B = await sc.reply(bob, A.ref, A.ref, `B`)
    await network.processAll()
    const C = await sc.reply(carol, A.ref, B.ref, `C`)
    const block = await pdsAgent.api.app.bsky.graph.block.create(
      { repo: alice },
      { createdAt: new Date().toISOString(), subject: bob },
      sc.getHeaders(alice),
    )

    await network.processAll()

    const timeline = await agent.api.app.bsky.feed.getTimeline(
      { limit: 3 },
      {
        headers: await network.serviceHeaders(carol),
      },
    )

    const sliceC = timeline.data.feed.find((f) => f.post.uri === C.ref.uriStr)

    expect(sliceC).toBeDefined()
    expect(sliceC?.reply).toBeDefined()

    if (!sliceC || !sliceC.reply) {
      throw new Error('sliceC is undefined')
    }

    expect(sliceC.reply.parent.uri).toEqual(B.ref.uriStr)
    expect(sliceC.reply.root.uri).toEqual(A.ref.uriStr)
    expect(AppBskyFeedDefs.isPostView(sliceC.reply.parent)).toBe(true)
    expect(AppBskyFeedDefs.isBlockedPost(sliceC.reply.root)).toBe(true)

    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: alice, rkey: new AtUri(block.uri).rkey },
      sc.getHeaders(alice),
    )
  })

  it(`[A] -> [B] -> [C], C blocks A, viewed as C`, async () => {
    const A = await sc.post(alice, `A`)
    await network.processAll()
    const B = await sc.reply(bob, A.ref, A.ref, `B`)
    await network.processAll()
    const C = await sc.reply(carol, A.ref, B.ref, `C`)
    const block = await pdsAgent.api.app.bsky.graph.block.create(
      { repo: carol },
      { createdAt: new Date().toISOString(), subject: alice },
      sc.getHeaders(carol),
    )

    await network.processAll()

    const timeline = await agent.api.app.bsky.feed.getTimeline(
      { limit: 3 },
      {
        headers: await network.serviceHeaders(carol),
      },
    )

    const sliceC = timeline.data.feed.find((f) => f.post.uri === C.ref.uriStr)

    expect(sliceC).toBeUndefined()

    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: carol, rkey: new AtUri(block.uri).rkey },
      sc.getHeaders(carol),
    )
  })

  it(`[A] -> [B] -> [C], C blocks B, viewed as C`, async () => {
    const A = await sc.post(alice, `A`)
    await network.processAll()
    const B = await sc.reply(bob, A.ref, A.ref, `B`)
    await network.processAll()
    const C = await sc.reply(carol, A.ref, B.ref, `C`)
    const block = await pdsAgent.api.app.bsky.graph.block.create(
      { repo: carol },
      { createdAt: new Date().toISOString(), subject: bob },
      sc.getHeaders(carol),
    )

    await network.processAll()

    const timeline = await agent.api.app.bsky.feed.getTimeline(
      { limit: 3 },
      {
        headers: await network.serviceHeaders(carol),
      },
    )

    const sliceC = timeline.data.feed.find((f) => f.post.uri === C.ref.uriStr)

    expect(sliceC).toBeUndefined()

    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: carol, rkey: new AtUri(block.uri).rkey },
      sc.getHeaders(carol),
    )
  })
})
