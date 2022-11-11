import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { runTestServer, forSnapshot, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds profile views', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string
  let scene: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_profile',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    scene = sc.scenes['scene.test'].did
  })

  afterAll(async () => {
    await close()
  })

  it('fetches own profile', async () => {
    const aliceForAlice = await client.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it("fetches other's profile, with a follow", async () => {
    const aliceForBob = await client.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(aliceForBob.data)).toMatchSnapshot()
  })

  it("fetches other's profile, without a follow", async () => {
    const danForBob = await client.app.bsky.actor.getProfile(
      { actor: dan },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(danForBob.data)).toMatchSnapshot()
  })

  it("fetches scene's profile", async () => {
    const sceneForAlice = await client.app.bsky.actor.getProfile(
      { actor: scene },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(sceneForAlice.data)).toMatchSnapshot()
  })

  it('updates profile', async () => {
    await client.app.bsky.actor.updateProfile(
      { displayName: 'ali', description: 'new descript' },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const aliceForAlice = await client.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('handles partial updates', async () => {
    await client.app.bsky.actor.updateProfile(
      { description: 'blah blah' },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const aliceForAlice = await client.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('handles scene profile updates', async () => {
    await client.app.bsky.actor.updateProfile(
      { did: scene, displayName: 'besties', description: 'feeling scene' },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )

    const sceneForAlice = await client.app.bsky.actor.getProfile(
      { actor: scene },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(sceneForAlice.data)).toMatchSnapshot()
  })

  return

  it('handles racing updates', async () => {
    const descriptions: string[] = []
    const COUNT = 10
    for (let i = 0; i < COUNT; i++) {
      descriptions.push(`description-${i}`)
    }
    await Promise.all(
      descriptions.map(async (description) => {
        await client.app.bsky.actor.updateProfile(
          { description },
          { headers: sc.getHeaders(alice), encoding: 'application/json' },
        )
      }),
    )

    const profile = await client.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )

    // doesn't matter which request wins race, but one of them should win
    const descripExists = descriptions.some(
      (descrip) => profile.data.description === descrip,
    )
    expect(descripExists).toBeTruthy()
  })

  it('fetches profile by handle', async () => {
    const byDid = await client.app.bsky.actor.getProfile(
      { actor: alice },
      {
        headers: sc.getHeaders(bob),
      },
    )

    const byHandle = await client.app.bsky.actor.getProfile(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(bob) },
    )

    expect(byHandle.data).toEqual(byDid.data)
  })
})
