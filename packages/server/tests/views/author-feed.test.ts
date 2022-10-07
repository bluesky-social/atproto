import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds author feed views', () => {
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

  it('fetches author feed', async () => {
    const aliceFeed = await client.todo.social.getAuthorFeed(
      { author: 'alice.test' },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed.map((item) => item.record.text)).toEqual([
      sc.replies[alice][0].text,
      sc.posts[alice][2].text,
      sc.posts[alice][1].text,
      sc.posts[alice][0].text,
    ])

    const aliceFeed2 = await client.todo.social.getAuthorFeed(
      { author: 'alice.test', before: aliceFeed.data.feed[0].cursor, limit: 1 },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    /** @ts-ignore TODO */
    expect(aliceFeed2.data.feed.map((item) => item.record.text)).toEqual([
      sc.posts[alice][2].text,
    ])

    const carolFeed = await client.todo.social.getAuthorFeed(
      { author: 'carol.test' },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    /** @ts-ignore TODO */
    expect(carolFeed.data.feed.map((item) => item.record.text)).toEqual([
      sc.posts[dan][1].text,
      sc.replies[carol][0].text,
      sc.posts[carol][0].text,
    ])
  })
})
