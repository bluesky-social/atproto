import AtpAgent from '@atproto/api'
import { runTestServer, CloseFn, TestServerInfo, forSnapshot } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { RecordRef } from '@atproto/bsky/tests/seeds/client'

describe('pds views with blocking', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient
  let aliceReplyToDan: { ref: RecordRef }

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_block',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    // dan blocks carol
    await agent.api.app.bsky.graph.block.create(
      { repo: sc.dids.dan },
      { createdAt: new Date().toISOString(), subject: sc.dids.carol },
      sc.getHeaders(sc.dids.dan),
    )
    aliceReplyToDan = await sc.reply(
      sc.dids.alice,
      sc.posts[sc.dids.dan][0].ref,
      sc.posts[sc.dids.dan][0].ref,
      'alice replies to dan',
    )
    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('blocks thread post', async () => {
    const { carol, dan } = sc.dids
    const { data: threadAlice } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[carol][0].ref.uriStr },
      { headers: sc.getHeaders(dan) },
    )
    expect(threadAlice).toEqual({
      thread: {
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: sc.posts[carol][0].ref.uriStr,
        blocked: true,
      },
    })
    const { data: threadCarol } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[dan][0].ref.uriStr },
      { headers: sc.getHeaders(carol) },
    )
    expect(threadCarol).toEqual({
      thread: {
        $type: 'app.bsky.feed.defs#blockedPost',
        uri: sc.posts[dan][0].ref.uriStr,
        blocked: true,
      },
    })
  })

  it('blocks thread reply', async () => {
    const { alice, dan } = sc.dids
    // Contains reply by carol
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('blocks thread parent', async () => {
    const { carol } = sc.dids
    // Parent is a post by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: aliceReplyToDan.ref.uriStr },
      { headers: sc.getHeaders(carol) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('blocks record embeds', async () => {
    const { alice, dan } = sc.dids
    // Contains a deep embed of carol's post, blocked by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 0, uri: sc.posts[alice][2].ref.uriStr },
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })
})
