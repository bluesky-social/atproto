import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { stripViewer } from '../_util.js'

describe('pds user search views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_suggestions',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)

    await network.bsky.db.db
      .insertInto('suggested_follow')
      .values([
        { did: sc.dids.alice, order: 1 },
        { did: sc.dids.bob, order: 2 },
        { did: sc.dids.carol, order: 3 },
        { did: sc.dids.dan, order: 4 },
      ])
      .execute()
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  it('actor suggestion gives users', async () => {
    const result = await agent.api.app.bsky.actor.getSuggestions(
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyActorGetSuggestions,
        ),
      },
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
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyActorGetSuggestions,
        ),
      },
    )

    // alice follows everyone
    expect(result.data.actors.length).toBe(0)
  })

  it('paginates and refills after filtering followed and requesting actors', async () => {
    const result1 = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 2 },
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyActorGetSuggestions,
        ),
      },
    )
    expect(result1.data.actors.length).toBe(2)
    expect(result1.data.actors[0].handle).toEqual('bob.test')
    expect(result1.data.actors[1].handle).toEqual('dan.test')
    expect(result1.data.cursor).toBeDefined()

    const terminal = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 3 },
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyActorGetSuggestions,
        ),
      },
    )
    expect(terminal.data.actors).toHaveLength(2)
    expect(terminal.data.cursor).toBeUndefined()

    const empty = await agent.api.app.bsky.actor.getSuggestions(
      { limit: 1 },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyActorGetSuggestions,
        ),
      },
    )
    expect(empty.data.actors).toEqual([])
    expect(empty.data.cursor).toBeUndefined()
  })

  it('fetches suggestions unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.actor.getSuggestions(
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.carol,
          ids.AppBskyActorGetSuggestions,
        ),
      },
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

  it('returns tagged suggestions', async () => {
    const suggestions = [
      {
        tag: 'test',
        subject: 'did:example:test',
        subjectType: 'actor',
      },
      {
        tag: 'another',
        subject: 'at://did:example:another/app.bsky.feed.generator/my-feed',
        subjectType: 'feed',
      },
    ]
    await network.bsky.db.db
      .insertInto('tagged_suggestion')
      .values(suggestions)
      .execute()
    const res = await agent.api.app.bsky.unspecced.getTaggedSuggestions()
    expect(res.data.suggestions).toEqual(suggestions)
  })
})
