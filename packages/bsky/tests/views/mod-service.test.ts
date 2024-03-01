import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed, RecordRef } from '@atproto/dev-env'
import { forSnapshot, stripViewerFromModService } from '../_util'
import { ids } from '../../src/lexicon/lexicons'

describe('mod service views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  let aliceService: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_mod_service',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob

    const aliceRes = await pdsAgent.api.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: ids.AppBskyModerationService,
        rkey: 'self',
        record: {
          policies: {
            labelValues: ['spam', '!hide', 'scam', 'impersonation'],
          },
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await pdsAgent.api.com.atproto.repo.createRecord(
      {
        repo: bob,
        collection: ids.AppBskyModerationService,
        rkey: 'self',
        record: {
          policies: {
            labelValues: ['nudity', 'sexual', 'porn'],
          },
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )

    aliceService = new RecordRef(aliceRes.data.uri, aliceRes.data.cid)

    await sc.like(bob, aliceService)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches mod services', async () => {
    const view = await agent.api.app.bsky.moderation.getServices(
      { dids: [alice, bob, 'did:example:missing'] },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(forSnapshot(view.data)).toMatchSnapshot()
  })

  it('fetches mod services detailed', async () => {
    const view = await agent.api.app.bsky.moderation.getServices(
      { dids: [alice, bob, 'did:example:missing'], detailed: true },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(forSnapshot(view.data)).toMatchSnapshot()
  })

  it('fetches mod services unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.moderation.getServices(
      { dids: [alice] },
      { headers: await network.serviceHeaders(bob) },
    )
    const { data: unauthed } = await agent.api.app.bsky.moderation.getServices({
      dids: [alice],
    })
    expect(unauthed.views).toEqual(authed.views.map(stripViewerFromModService))
  })

  it('fetches multiple mod services unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.moderation.getServices(
      {
        dids: [alice, bob, 'did:example:missing'],
      },
      { headers: await network.serviceHeaders(bob) },
    )
    const { data: unauthed } = await agent.api.app.bsky.moderation.getServices({
      dids: [alice, bob, 'did:example:missing'],
    })
    expect(unauthed.views.length).toBeGreaterThan(0)
    expect(unauthed.views).toEqual(authed.views.map(stripViewerFromModService))
  })

  it('renders a post embed of a mod service', async () => {
    const postRes = await pdsAgent.api.app.bsky.feed.post.create(
      { repo: sc.dids.bob },
      {
        text: 'check out this mod service',
        embed: {
          $type: 'app.bsky.embed.record',
          record: aliceService.raw,
        },
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.bob),
    )

    await network.processAll()

    const postViews = await agent.api.app.bsky.feed.getPosts({
      uris: [postRes.uri],
    })
    const serviceViews = await agent.api.app.bsky.moderation.getServices({
      dids: [alice],
    })
    expect(postViews.data.posts[0].embed?.record).toMatchObject(
      serviceViews.data.views[0],
    )
  })

  it('blocked by mod service takedown', async () => {
    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: aliceService.uriStr,
    })

    const res = await agent.api.app.bsky.moderation.getServices(
      { dids: [alice, bob] },
      { headers: await network.serviceHeaders(bob) },
    )
    expect(res.data.views.length).toBe(1)
    // @ts-ignore
    expect(res.data.views[0].creator.did).toEqual(bob)

    // Cleanup
    await network.bsky.ctx.dataplane.untakedownRecord({
      recordUri: aliceService.uriStr,
    })
  })
})
