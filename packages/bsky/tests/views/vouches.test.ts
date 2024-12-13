import { AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed, RecordRef } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { forSnapshot } from '../_util'

describe('vouches', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_vouches',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    await network.processAll()
  })

  let vouch1: RecordRef

  beforeAll(async () => {
    vouch1 = await sc.vouch(bob, alice, 'verifiedBy')
    await sc.acceptVouch(alice, vouch1)
    const vouch2 = await sc.vouch(carol, alice, 'friendOf')
    await sc.acceptVouch(alice, vouch2)
    await sc.vouch(dan, alice, 'colleagueOf')

    await sc.vouch(carol, bob, 'verifiedBy')
    const vouch3 = await sc.vouch(carol, dan, 'friendOf')
    await sc.acceptVouch(dan, vouch3)

    await sc.vouch(dan, bob, 'friendOf')

    await sc.updateProfile(alice, {
      highlightedVouch: vouch1.uriStr,
    })

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches vouches for a user', async () => {
    const res = await agent.app.bsky.graph.getVouchesReceived({ actor: alice })
    expect(res.data.vouches.length).toBe(2)
    expect(forSnapshot(res.data.vouches)).toMatchSnapshot()

    // does not return unaccepted vouches
    expect(res.data.vouches.some((v) => v.creator.did === dan)).toBe(false)
  })

  it('fetches vouches given by a user', async () => {
    const res = await agent.app.bsky.graph.getVouchesGiven({ actor: carol })
    expect(res.data.vouches.length).toBe(2)
    expect(forSnapshot(res.data.vouches)).toMatchSnapshot()

    // does not return unaccepted vouches
    expect(res.data.vouches.some((v) => v.creator.did === bob)).toBe(false)
  })

  it('fetches vouches offered to a requesting user', async () => {
    const res = await agent.app.bsky.graph.getVouchesOffered(
      {},
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyGraphGetVouchesOffered,
        ),
      },
    )
    expect(res.data.vouches.length).toBe(2)
    expect(forSnapshot(res.data.vouches)).toMatchSnapshot()
  })

  it('highlights a vouch on profile', async () => {
    const profile = await agent.app.bsky.actor.getProfile({ actor: alice })
    expect(profile.data.highlightedVouch?.uri).toBe(vouch1.uriStr)

    expect(forSnapshot(profile.data.highlightedVouch)).toMatchSnapshot()
  })

  it('highlights a vouch on basic profile views', async () => {
    const res = await agent.app.bsky.feed.getPosts({
      uris: [sc.posts[alice][0].ref.uriStr],
    })
    expect(res.data.posts[0].author.highlightedVouch?.uri).toBe(vouch1.uriStr)

    expect(
      forSnapshot(res.data.posts[0].author.highlightedVouch),
    ).toMatchSnapshot()
  })
})
