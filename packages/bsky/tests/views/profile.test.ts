import assert from 'node:assert'
import fs from 'node:fs/promises'
import { AppBskyEmbedExternal, AtpAgent } from '@atproto/api'
import { HOUR, MINUTE } from '@atproto/common'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { forSnapshot, stripViewer } from '../_util'

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
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyActorGetProfile,
        ),
      },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('reflects self-labels', async () => {
    const aliceForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyActorGetProfile),
      },
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
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyActorGetProfile),
      },
    )

    expect(forSnapshot(aliceForBob.data)).toMatchSnapshot()
  })

  it("fetches other's profile, without a follow", async () => {
    const danForBob = await agent.api.app.bsky.actor.getProfile(
      { actor: dan },
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyActorGetProfile),
      },
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
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyActorGetProfiles),
      },
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
      '../dev-env/assets/key-portrait-small.jpg',
    )
    const bannerImg = await fs.readFile(
      '../dev-env/assets/key-landscape-small.jpg',
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
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyActorGetProfile,
        ),
      },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('fetches profile by handle', async () => {
    const byDid = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyActorGetProfile),
      },
    )

    const byHandle = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.accounts[alice].handle },
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyActorGetProfile),
      },
    )

    expect(byHandle.data).toEqual(byDid.data)
  })

  it('fetches profile unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyActorGetProfile),
      },
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
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyActorGetProfiles),
      },
    )
    const { data: unauthed } = await agent.api.app.bsky.actor.getProfiles({
      actors: [alice, 'bob.test', 'missing.test'],
    })
    expect(unauthed.profiles.length).toBeGreaterThan(0)
    expect(unauthed.profiles).toEqual(authed.profiles.map(stripViewer))
  })

  it('blocked by actor takedown', async () => {
    await network.bsky.ctx.dataplane.takedownActor({
      did: alice,
    })
    const promise = agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyActorGetProfile),
      },
    )

    await expect(promise).rejects.toThrow('Account has been suspended')

    // Cleanup
    await network.bsky.ctx.dataplane.untakedownActor({
      did: alice,
    })
  })

  describe('status', () => {
    const embed: AppBskyEmbedExternal.Main = {
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://example.com',
        title: 'TestImage',
        description: 'testLink',
      },
    }

    it(`omits status if doesn't exist`, async () => {
      const { data } = await agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      expect(data.status).toBeUndefined()
    })

    it('returns active status when within the duration', async () => {
      await sc.agent.com.atproto.repo.createRecord(
        {
          repo: alice,
          collection: ids.AppBskyActorStatus,
          rkey: 'self',
          record: {
            status: 'app.bsky.actor.status#live',
            embed,
            durationMinutes: 10,
            createdAt: new Date().toISOString(),
          },
        },
        {
          headers: sc.getHeaders(alice),
          encoding: 'application/json',
        },
      )
      await network.processAll()

      const { data } = await agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )
      expect(forSnapshot(data.status)).toMatchSnapshot()
    })

    it('limits the minimum duration', async () => {
      await sc.agent.com.atproto.repo.putRecord(
        {
          repo: alice,
          collection: ids.AppBskyActorStatus,
          rkey: 'self',
          record: {
            status: 'app.bsky.actor.status#live',
            embed,
            durationMinutes: 1,
            createdAt: new Date().toISOString(),
          },
        },
        {
          headers: sc.getHeaders(alice),
          encoding: 'application/json',
        },
      )
      await network.processAll()

      const { data } = await agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )

      assert(data.status)
      const createdAt = new Date(data.status.record.createdAt as string)
      const expiresAt = new Date(data.status.expiresAt as string)
      expect(expiresAt.getTime() - createdAt.getTime()).toBe(5 * MINUTE)
    })

    it('limits the maximum duration', async () => {
      await sc.agent.com.atproto.repo.putRecord(
        {
          repo: alice,
          collection: ids.AppBskyActorStatus,
          rkey: 'self',
          record: {
            status: 'app.bsky.actor.status#live',
            embed,
            durationMinutes: 1_440, // 1 day in minutes
            createdAt: new Date().toISOString(),
          },
        },
        {
          headers: sc.getHeaders(alice),
          encoding: 'application/json',
        },
      )
      await network.processAll()

      const { data } = await agent.api.app.bsky.actor.getProfile(
        { actor: alice },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyActorGetProfile,
          ),
        },
      )

      assert(data.status)
      const createdAt = new Date(data.status.record.createdAt as string)
      const expiresAt = new Date(data.status.expiresAt as string)
      expect(expiresAt.getTime() - createdAt.getTime()).toBe(4 * HOUR)
    })

    describe('when outside the duration', () => {
      const now = '2021-01-01T01:00:00.000Z'
      const nowPlus15M = '2021-01-01T01:15:00.000Z'

      beforeAll(() => {
        jest.useFakeTimers({
          doNotFake: [
            'nextTick',
            'performance',
            'setImmediate',
            'setInterval',
            'setTimeout',
          ],
        })
        jest.setSystemTime(new Date(now))
      })

      afterAll(async () => {
        jest.useRealTimers()
      })

      it('returns inactive status', async () => {
        await sc.agent.com.atproto.repo.putRecord(
          {
            repo: alice,
            collection: ids.AppBskyActorStatus,
            rkey: 'self',
            record: {
              status: 'app.bsky.actor.status#live',
              embed,
              durationMinutes: 10,
              createdAt: new Date().toISOString(),
            },
          },
          {
            headers: sc.getHeaders(alice),
            encoding: 'application/json',
          },
        )
        await network.processAll()

        jest.setSystemTime(new Date(nowPlus15M))

        const { data } = await agent.api.app.bsky.actor.getProfile(
          { actor: alice },
          {
            headers: await network.serviceHeaders(
              alice,
              ids.AppBskyActorGetProfile,
            ),
          },
        )

        // Doesn't need `forSnapshot` because the dates are already mocked.
        expect(data.status).toMatchSnapshot()
      })
    })
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
