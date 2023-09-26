import AtpAgent, { AtUri } from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import likesSeed from '../seeds/likes'

describe('suggested follows', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_suggested_follows',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await likesSeed(sc)
    await network.processAll()
    await network.bsky.processAll()

    const suggestions = [
      { did: sc.dids.alice, order: 1 },
      { did: sc.dids.bob, order: 2 },
      { did: sc.dids.carol, order: 3 },
      { did: sc.dids.dan, order: 4 },
      { did: sc.dids.fred, order: 5 },
      { did: sc.dids.gina, order: 6 },
    ]
    await network.bsky.ctx.db
      .getPrimary()
      .db.insertInto('suggested_follow')
      .values(suggestions)
      .execute()
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns sorted suggested follows for carol', async () => {
    const result = await agent.api.app.bsky.graph.getSuggestedFollowsByActor(
      {
        actor: sc.dids.alice,
      },
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )

    expect(result.data.suggestions.length).toBe(4) // backfilled with 2 NPCs
    expect(
      result.data.suggestions.find((sug) => {
        return [sc.dids.alice, sc.dids.carol].includes(sug.did)
      }),
    ).toBeFalsy() // not actor or viewer
  })

  it('returns sorted suggested follows for fred', async () => {
    const result = await agent.api.app.bsky.graph.getSuggestedFollowsByActor(
      {
        actor: sc.dids.alice,
      },
      { headers: await network.serviceHeaders(sc.dids.fred) },
    )

    expect(result.data.suggestions.length).toBe(4) // backfilled with 2 NPCs
    expect(
      result.data.suggestions.find((sug) => {
        return [sc.dids.fred, sc.dids.alice].includes(sug.did)
      }),
    ).toBeFalsy() // not actor or viewer or followed
  })

  it('exludes users muted by viewer', async () => {
    await pdsAgent.api.app.bsky.graph.muteActor(
      { actor: sc.dids.bob },
      { headers: sc.getHeaders(sc.dids.carol), encoding: 'application/json' },
    )
    const result = await agent.api.app.bsky.graph.getSuggestedFollowsByActor(
      {
        actor: sc.dids.alice,
      },
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )

    expect(
      result.data.suggestions.find((sug) => {
        return [sc.dids.alice, sc.dids.carol, sc.dids.bob].includes(sug.did)
      }),
    ).toBeFalsy() // not actor or viewer or muted

    await pdsAgent.api.app.bsky.graph.muteActor(
      { actor: sc.dids.bob },
      { headers: sc.getHeaders(sc.dids.carol), encoding: 'application/json' },
    )
  })

  it('exludes users blocked by viewer', async () => {
    const carolBlocksBob = await pdsAgent.api.app.bsky.graph.block.create(
      { repo: sc.dids.carol },
      { createdAt: new Date().toISOString(), subject: sc.dids.bob },
      sc.getHeaders(sc.dids.carol),
    )
    const result = await agent.api.app.bsky.graph.getSuggestedFollowsByActor(
      {
        actor: sc.dids.alice,
      },
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )

    expect(
      result.data.suggestions.find((sug) => {
        return [sc.dids.alice, sc.dids.carol, sc.dids.bob].includes(sug.did)
      }),
    ).toBeFalsy() // not actor or viewer or muted

    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: sc.dids.carol, rkey: new AtUri(carolBlocksBob.uri).rkey },
      sc.getHeaders(sc.dids.carol),
    )
  })

  it('exludes users blocking viewer', async () => {
    const bobBlocksCarol = await pdsAgent.api.app.bsky.graph.block.create(
      { repo: sc.dids.bob },
      { createdAt: new Date().toISOString(), subject: sc.dids.carol },
      sc.getHeaders(sc.dids.bob),
    )
    const result = await agent.api.app.bsky.graph.getSuggestedFollowsByActor(
      {
        actor: sc.dids.alice,
      },
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )

    expect(
      result.data.suggestions.find((sug) => {
        return [sc.dids.alice, sc.dids.carol, sc.dids.bob].includes(sug.did)
      }),
    ).toBeFalsy() // not actor or viewer or muted

    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: sc.dids.bob, rkey: new AtUri(bobBlocksCarol.uri).rkey },
      sc.getHeaders(sc.dids.bob),
    )
  })
})
