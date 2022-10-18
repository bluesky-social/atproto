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
  })

  afterAll(async () => {
    await close()
  })

  it('fetches own profile', async () => {
    const aliceForAlice = await client.app.bsky.getProfile(
      { user: alice },
      undefined,
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it("fetches other's profile, with a follow", async () => {
    const aliceForBob = await client.app.bsky.getProfile(
      { user: alice },
      undefined,
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(aliceForBob.data)).toMatchSnapshot()
  })

  it("fetches other's profile, without a follow", async () => {
    const danForBob = await client.app.bsky.getProfile(
      { user: dan },
      undefined,
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(danForBob.data)).toMatchSnapshot()
  })

  it('updates profile', async () => {
    const toPin = [sc.badges[bob][1].raw]
    await client.app.bsky.updateProfile(
      {},
      { displayName: 'ali', pinnedBadges: toPin },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const aliceForAlice = await client.app.bsky.getProfile(
      { user: alice },
      undefined,
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('adds & removes badges from profile', async () => {
    const toPin = [sc.badges[carol][0].raw]
    await client.app.bsky.updateProfile(
      {},
      { description: 'new descript', pinnedBadges: toPin },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const aliceForAlice = await client.app.bsky.getProfile(
      { user: alice },
      undefined,
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('does not return a badge that the user does not possess', async () => {
    const toPin = [
      sc.badges[carol][0].raw,
      sc.badges[carol][1].raw, // alice was not offered this badge
    ]
    await client.app.bsky.updateProfile(
      {},
      { pinnedBadges: toPin },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const aliceForAlice = await client.app.bsky.getProfile(
      { user: alice },
      undefined,
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceForAlice.data)).toMatchSnapshot()
  })

  it('fetches profile by username', async () => {
    const byDid = await client.app.bsky.getProfile({ user: alice }, undefined, {
      headers: sc.getHeaders(bob),
    })

    const byUsername = await client.app.bsky.getProfile(
      { user: sc.accounts[alice].username },
      undefined,
      { headers: sc.getHeaders(bob) },
    )

    expect(byUsername.data).toEqual(byDid.data)
  })
})
