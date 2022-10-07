import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds repost views', () => {
  let client: AdxServiceClient
  let close: util.CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let carol: string
  let dan: string

  beforeAll(async () => {
    const server = await util.runTestServer()
    close = server.close
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await close()
  })

  it('fetches reposted by view', async () => {
    const view = await client.todo.social.getRepostedBy({
      uri: sc.posts[dan][1].uriRaw,
    })
    expect(view.data.uri).toEqual(sc.posts[dan][1].uriRaw)
    expect(view.data.repostedBy.length).toBe(1)
    const repost = view.data.repostedBy[0]
    expect(repost.did).toEqual(carol)
    expect(repost.displayName).toEqual(sc.profiles[carol]?.displayName)
    expect(repost.createdAt).toBeDefined()
    expect(repost.indexedAt).toBeDefined()
  })
})
