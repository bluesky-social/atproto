import fs from 'fs/promises'
import AtpAgent from '@atproto/api'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  processAll,
  TestServerInfo,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds profile views', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let dan: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_profile',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    pdsAgent = new AtpAgent({ service: server.pdsUrl })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await processAll(server)
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
          'did:missing',
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
    const avatarRes = await pdsAgent.api.com.atproto.blob.upload(avatarImg, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })
    const bannerRes = await pdsAgent.api.com.atproto.blob.upload(bannerImg, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })

    await pdsAgent.api.app.bsky.actor.updateProfile(
      {
        avatar: { cid: avatarRes.data.cid, mimeType: 'image/jpeg' },
        banner: { cid: bannerRes.data.cid, mimeType: 'image/jpeg' },
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await processAll(server)

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
})
