import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds thread views', () => {
  let client: AdxServiceClient
  let close: util.CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    const server = await util.runTestServer()
    close = server.close
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
  })

  afterAll(async () => {
    await close()
  })

  // @TODO test badges

  it('fetches postThread', async () => {
    const thread = await client.todo.social.getPostThread(
      { uri: sc.posts[alice][1].uriRaw },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    /** @ts-ignore TODO */
    expect(thread.data.thread.record.text).toEqual(sc.posts[alice][1].text)
    expect(thread.data.thread.replyCount).toEqual(2)
    expect(thread.data.thread.likeCount).toEqual(3)
    expect(thread.data.thread.replies?.length).toEqual(2)
    /** @ts-ignore TODO */
    expect(thread.data.thread.replies?.[0].record.text).toEqual(
      sc.replies[carol][0].text,
    )
    /** @ts-ignore TODO */
    expect(thread.data.thread.replies?.[1].record.text).toEqual(
      sc.replies[bob][0].text,
    )
    /** @ts-ignore TODO */
    expect(thread.data.thread.replies?.[1].parent?.record.text).toEqual(
      sc.posts[alice][1].text,
    )
    /** @ts-ignore TODO */
    // TODO: this is failing -- not clear to me why
    expect(thread.data.thread.replies?.[1].replies?.[0].record.text).toEqual(
      sc.replies[alice][0].text,
    )
  })
})
