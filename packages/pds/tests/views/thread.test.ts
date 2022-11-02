import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { runTestServer, forSnapshot, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds thread views', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_thread',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  beforeAll(async () => {
    // Add a repost of a reply so that we can confirm myState in the thread
    await sc.repost(bob, sc.replies[alice][0].ref)
  })

  afterAll(async () => {
    await close()
  })

  it('fetches deep post thread', async () => {
    const thread = await client.app.bsky.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches shallow post thread', async () => {
    const thread = await client.app.bsky.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fails for an unknown post', async () => {
    const promise = client.app.bsky.getPostThread(
      { uri: 'does.not.exist' },
      { headers: sc.getHeaders(bob) },
    )

    await expect(promise).rejects.toThrow('Post not found: does.not.exist')
  })
})
