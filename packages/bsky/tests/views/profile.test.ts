import fs from 'fs/promises'
import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient } from '@atproto/dev-env'
import { forSnapshot, stripViewer } from '../_util'
import { ids } from '../../src/lexicon/lexicons'
import basicSeed from '../seeds/basic'

describe('pds profile views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_profile',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await network.close()
  })

  // @TODO(bsky) blocked by actor takedown via labels.

  it('fetches own profile', async () => {
    const aliceForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('reflects self-labels', async () => {
    const aliceForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: await network.serviceHeaders(bob) },
    )

    const labels = aliceForBob.data.labels
      ?.filter((label) => label.src === alice)
      .map((label) => label.val)
      .sort()

    expect(labels).toEqual(['self-label-a', 'self-label-b'])
  })

  it("fetches other's profile, with a follow", async () => {
    const aliceForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(forSnapshot(aliceForBob.data)).toMatchSnapshot()
  })

  it("fetches other's profile, without a follow", async () => {
    const danForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      { headers: await network.serviceHeaders(bob) },
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
      { headers: await network.serviceHeaders(bob) },
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
      'tests/sample-img/key-portrait-small.jpg',
    )
    const bannerImg = await fs.readFile(
      'tests/sample-img/key-landscape-small.jpg',
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
    await network.processAll()

    const aliceForAlice = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('fetches profile by handle', async () => {
    const byDid = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      {
        headers: await network.serviceHeaders(bob),
      },
    )

    const byHandle = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.accounts[alice].handle },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(byHandle.data).toEqual(byDid.data)
  })

  it('fetches profile unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: await network.serviceHeaders(bob) },
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
      { headers: await network.serviceHeaders(bob) },
    )
    const { data: unauthed } = await agent.api.app.bsky.actor.getProfiles({
      actors: [alice, 'bob.test', 'missing.test'],
    })
    expect(unauthed.profiles.length).toBeGreaterThan(0)
    expect(unauthed.profiles).toEqual(authed.profiles.map(stripViewer))
  })

  it('blocked by actor takedown', async () => {
    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        event: { $type: 'com.atproto.admin.defs#modEventTakedown' },
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: alice,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    const promise = agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: await network.serviceHeaders(bob) },
    )

    await expect(promise).rejects.toThrow('Account has been taken down')

    // Cleanup
    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        event: { $type: 'com.atproto.admin.defs#modEventReverseTakedown' },
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: alice,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
  })

  it('blocked by actor suspension', async () => {
    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        event: {
          $type: 'com.atproto.admin.defs#modEventTakedown',
          durationInHours: 1,
        },
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: alice,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    const promise = agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: await network.serviceHeaders(bob) },
    )

    await expect(promise).rejects.toThrow(
      'Account has been temporarily suspended',
    )

    // Cleanup
    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        event: { $type: 'com.atproto.admin.defs#modEventReverseTakedown' },
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: alice,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
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
