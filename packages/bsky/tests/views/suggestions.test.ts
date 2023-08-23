import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { stripViewer } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds user search views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_suggestions',
    })
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    await network.bsky.processAll()

    const suggestions = [
      { did: sc.dids.bob, order: 1 },
      { did: sc.dids.carol, order: 2 },
      { did: sc.dids.dan, order: 3 },
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

  it('actor suggestion gives users', async () => {
    const result = await agent.api.app.bsky.actor.getSuggestions(
      {},
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )

    // does not include carol, because she is requesting
    expect(result.data.actors.length).toBe(2)
    expect(result.data.actors[0].handle).toEqual('bob.test')
    expect(result.data.actors[0].displayName).toEqual('bobby')
    expect(result.data.actors[1].handle).toEqual('dan.test')
    expect(result.data.actors[1].displayName).toBeUndefined()
  })

  it('does not suggest followed users', async () => {
    const result = await agent.api.app.bsky.actor.getSuggestions(
      {},
      { headers: await network.serviceHeaders(sc.dids.alice) },
    )

    // alice follows everyone
    expect(result.data.actors.length).toBe(0)
  })

  it('paginates', async () => {
    const result1 = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 1 },
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )
    const result2 = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 1, cursor: result1.data.cursor },
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )

    expect(result1.data.actors.length).toBe(1)
    expect(result1.data.actors[0].handle).toEqual('bob.test')

    expect(result2.data.actors.length).toBe(1)
    expect(result2.data.actors[0].handle).toEqual('dan.test')
  })

  it('fetches suggestions unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.actor.getSuggestions(
      {},
      { headers: await network.serviceHeaders(sc.dids.carol) },
    )
    const { data: unauthed } = await agent.api.app.bsky.actor.getSuggestions({})
    const omitViewerFollows = ({ did }) => {
      return did !== sc.dids.carol && !sc.follows[sc.dids.carol][did]
    }
    expect(unauthed.actors.length).toBeGreaterThan(0)
    expect(unauthed.actors.filter(omitViewerFollows)).toEqual(
      authed.actors.map(stripViewer),
    )
  })
})
