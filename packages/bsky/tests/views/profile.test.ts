import fs from 'fs/promises'
import AtpAgent from '@atproto/api'
import { CloseFn, runTestEnv, TestEnvInfo } from '@atproto/dev-env'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { adminAuth, forSnapshot, processAll, stripViewer } from '../_util'
import { ids } from '../../src/lexicon/lexicons'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds profile views', () => {
  let testEnv: TestEnvInfo
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let dan: string

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'views_profile',
    })
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.bsky.url })
    pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await processAll(testEnv)
    alice = sc.dids.alice
    bob = sc.dids.bob
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await close()
  })

  // @TODO(bsky) blocked by actor takedown via labels.

  it('fetches own profile', async () => {
    const aliceForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it("fetches other's profile, with a follow", async () => {
    const aliceForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob, true) },
    )

    expect(forSnapshot(aliceForBob.data)).toMatchSnapshot()
  })

  it("fetches other's profile, without a follow", async () => {
    const danForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      { headers: sc.getHeaders(bob, true) },
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
      { headers: sc.getHeaders(bob, true) },
    )

    expect(profiles.map((p) => p.handle)).toEqual([
      'alice.test',
      'bob.test',
      'carol.test',
      'dan.test',
    ])

    expect(forSnapshot(profiles)).toMatchSnapshot()
  })

  it('presents avatars & banners', async () => {
    const avatarImg = await fs.readFile(
      'tests/image/fixtures/key-portrait-small.jpg',
    )
    const bannerImg = await fs.readFile(
      'tests/image/fixtures/key-landscape-small.jpg',
    )
    const avatarRes = await pdsAgent.api.com.atproto.repo.uploadBlob(
      avatarImg,
      {
        headers: sc.getHeaders(alice),
        encoding: 'image/jpeg',
      },
    )
    const bannerRes = await pdsAgent.api.com.atproto.repo.uploadBlob(
      bannerImg,
      {
        headers: sc.getHeaders(alice),
        encoding: 'image/jpeg',
      },
    )

    await updateProfile(alice, {
      displayName: 'ali',
      description: 'new descript',
      avatar: avatarRes.data.blob,
      banner: bannerRes.data.blob,
    })
    await processAll(testEnv)

    const aliceForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('fetches profile by handle', async () => {
    const byDid = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      {
        headers: sc.getHeaders(bob, true),
      },
    )

    const byHandle = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(bob, true) },
    )

    expect(byHandle.data).toEqual(byDid.data)
  })

  it('fetches profile unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob, true) },
    )
    const { data: unauthed } = await agent.api.app.bsky.actor.getProfile({
      actor: alice,
    })
    expect(unauthed).toEqual(stripViewer(authed))
  })

  it('fetches multiple profiles unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.actor.getProfiles(
      {
        actors: [alice, 'bob.test', 'missing.test'],
      },
      { headers: sc.getHeaders(bob, true) },
    )
    const { data: unauthed } = await agent.api.app.bsky.actor.getProfiles({
      actors: [alice, 'bob.test', 'missing.test'],
    })
    expect(unauthed.profiles.length).toBeGreaterThan(0)
    expect(unauthed.profiles).toEqual(authed.profiles.map(stripViewer))
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
      { headers: sc.getHeaders(bob, true) },
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

  async function updateProfile(did: string, record: Record<string, unknown>) {
    return await pdsAgent.api.com.atproto.repo.putRecord(
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
