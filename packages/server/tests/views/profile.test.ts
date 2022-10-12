import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import { runTestServer, forSnapshot, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds profile views', () => {
  let client: AdxServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let dan: string

  beforeAll(async () => {
    const server = await runTestServer()
    close = server.close
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
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
