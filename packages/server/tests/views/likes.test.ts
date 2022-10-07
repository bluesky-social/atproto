import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds like views', () => {
  let client: AdxServiceClient
  let close: util.CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    const server = await util.runTestServer()
    close = server.close
    client = AdxApi.service(server.url)
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

  it('fetches liked by view', async () => {
    const view = await client.todo.social.getLikedBy({
      uri: sc.posts[alice][1].uriRaw,
    })
    expect(view.data.uri).toEqual(sc.posts[alice][1].uriRaw)
    expect(view.data.likedBy.length).toBe(3)
    const bobLike = view.data.likedBy.find(
      (l) => l.name === sc.accounts[bob].username,
    )
    expect(bobLike?.did).toEqual(bob)
    expect(bobLike?.displayName).toEqual(sc.profiles[bob].displayName)
    expect(bobLike?.createdAt).toBeDefined()
    expect(bobLike?.indexedAt).toBeDefined()
    const carolLike = view.data.likedBy.find(
      (l) => l.name === sc.accounts[carol].username,
    )
    expect(carolLike?.did).toEqual(carol)
    expect(carolLike?.displayName).toEqual(sc.profiles[carol]?.displayName)
    expect(carolLike?.createdAt).toBeDefined()
    expect(carolLike?.indexedAt).toBeDefined()
    const danLike = view.data.likedBy.find(
      (l) => l.name === sc.accounts[dan].username,
    )
    expect(danLike?.did).toEqual(dan)
    expect(danLike?.displayName).toEqual(sc.profiles[dan]?.displayName)
    expect(danLike?.createdAt).toBeDefined()
    expect(danLike?.indexedAt).toBeDefined()
  })
})
