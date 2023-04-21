import fs from 'fs/promises'
import AtpAgent from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { ids } from '../../src/lexicon/lexicons'
import { runTestServer, forSnapshot, CloseFn, adminAuth } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds profile views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let dan: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_profile',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    dan = sc.dids.dan
    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('fetches own profile', async () => {
    const aliceForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it("fetches other's profile, with a follow", async () => {
    const aliceForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(aliceForBob.data)).toMatchSnapshot()
  })

  it("fetches other's profile, without a follow", async () => {
    const danForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(danForBob.data)).toMatchSnapshot()
  })

  it('fetches multiple profiles', async () => {
    const {
      data: { profiles },
    } = await agent.api.app.bsky.actor.getProfiles(
      {
        actors: [
          alice,
          'bob.test',
          'did:example:missing',
          'carol.test',
          dan,
          'missing.test',
        ],
      },
      { headers: sc.getHeaders(bob) },
    )

    expect(profiles.map((p) => p.handle)).toEqual([
      'alice.test',
      'bob.test',
      'carol.test',
      'dan.test',
    ])

    expect(forSnapshot(profiles)).toMatchSnapshot()
  })

  it('updates profile', async () => {
    await updateProfile(agent, alice, {
      displayName: 'ali',
      description: 'new descript',
      avatar: sc.profiles[alice].avatar,
    })

    const aliceForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('handles avatars & banners', async () => {
    const avatarImg = await fs.readFile(
      'tests/image/fixtures/key-portrait-small.jpg',
    )
    const bannerImg = await fs.readFile(
      'tests/image/fixtures/key-landscape-small.jpg',
    )
    const avatarRes = await agent.api.com.atproto.repo.uploadBlob(avatarImg, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })
    const bannerRes = await agent.api.com.atproto.repo.uploadBlob(bannerImg, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })

    await updateProfile(agent, alice, {
      displayName: 'ali',
      description: 'new descript',
      avatar: avatarRes.data.blob,
      banner: bannerRes.data.blob,
    })

    const aliceForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('handles unsetting profile fields', async () => {
    await updateProfile(agent, alice, {})

    const aliceForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(aliceForAlice.data.displayName).toBeUndefined()
    expect(aliceForAlice.data.description).toBeUndefined()
    expect(aliceForAlice.data.avatar).toBeUndefined()
    expect(aliceForAlice.data.banner).toBeUndefined()
    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('creates new profile', async () => {
    await updateProfile(agent, dan, { displayName: 'danny boy' })

    const danForDan = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      { headers: sc.getHeaders(dan) },
    )

    expect(forSnapshot(danForDan.data)).toMatchSnapshot()
  })

  it('fetches profile by handle', async () => {
    const byDid = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      {
        headers: sc.getHeaders(bob),
      },
    )

    const byHandle = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(bob) },
    )

    expect(byHandle.data).toEqual(byDid.data)
  })

  it('blocked by actor takedown', async () => {
    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: alice,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    const promise = agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )

    await expect(promise).rejects.toThrow('Account has been taken down')

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: action.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it('includes muted status.', async () => {
    const { data: initial } = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )

    expect(initial.viewer?.muted).toEqual(false)

    await agent.api.app.bsky.graph.muteActor(
      { actor: alice },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    const { data: muted } = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )

    expect(muted.viewer?.muted).toEqual(true)

    const { data: fromBobUnrelated } =
      await agent.api.app.bsky.actor.getProfile(
        { actor: dan },
        { headers: sc.getHeaders(bob) },
      )
    const { data: toAliceUnrelated } =
      await agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        { headers: sc.getHeaders(dan) },
      )

    expect(fromBobUnrelated.viewer?.muted).toEqual(false)
    expect(toAliceUnrelated.viewer?.muted).toEqual(false)

    await agent.api.app.bsky.graph.unmuteActor(
      { actor: alice },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
  })

  async function updateProfile(
    agent: AtpAgent,
    did: string,
    record: Record<string, unknown>,
  ) {
    return await agent.api.com.atproto.repo.putRecord(
      {
        repo: did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record,
      },
      { headers: sc.getHeaders(did), encoding: 'application/json' },
    )
  }
})
