import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds profile views', () => {
  let client: AdxServiceClient
  let close: util.CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let dan: string

  beforeAll(async () => {
    const server = await util.runTestServer()
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

  it('fetches profile', async () => {
    const aliceProf = await client.todo.social.getProfile(
      {
        user: 'alice.test',
      },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    expect(aliceProf.data.did).toEqual(alice)
    expect(aliceProf.data.name).toEqual(sc.accounts[alice].username)
    expect(aliceProf.data.displayName).toEqual(sc.profiles[alice].displayName)
    expect(aliceProf.data.description).toEqual(sc.profiles[alice].description)
    expect(aliceProf.data.followersCount).toEqual(2)
    expect(aliceProf.data.followsCount).toEqual(3)
    expect(aliceProf.data.postsCount).toEqual(4)
    // TODO
    // expect(aliceProf.data.badges.length).toEqual(1)
    // expect(aliceProf.data.badges[0].uri).toEqual(badges[0].toString())
    // expect(aliceProf.data.badges[0].assertion?.type).toEqual('tag')
    // expect(aliceProf.data.badges[0].issuer?.did).toEqual(bob)
    // expect(aliceProf.data.badges[0].issuer?.name).toEqual(users.bob.name)
    // expect(aliceProf.data.badges[0].issuer?.displayName).toEqual(
    //   users.bob.displayName,
    // )
    expect(aliceProf.data.myState?.follow).toEqual(
      sc.follows[bob][alice].toString(),
    )

    const danProf = await client.todo.social.getProfile(
      {
        user: 'dan.test',
      },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    expect(danProf.data.did).toEqual(dan)
    expect(danProf.data.name).toEqual(sc.accounts[dan].username)
    expect(danProf.data.displayName).toEqual(sc.profiles[dan]?.displayName)
    expect(danProf.data.description).toEqual(sc.profiles[dan]?.description)
    expect(danProf.data.followersCount).toEqual(1)
    expect(danProf.data.followsCount).toEqual(1)
    expect(danProf.data.postsCount).toEqual(2)
    expect(danProf.data.badges).toEqual([])
    expect(danProf.data.myState?.follow).toEqual(
      sc.follows[bob][dan]?.toString(),
    )
  })
})
