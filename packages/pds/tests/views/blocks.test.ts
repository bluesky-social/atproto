import AtpAgent from '@atproto/api'
import { runTestServer, CloseFn, TestServerInfo, forSnapshot } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { RecordRef } from '@atproto/bsky/tests/seeds/client'
import { BlockedActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'
import { BlockedByActorError } from '@atproto/api/src/client/types/app/bsky/feed/getAuthorFeed'

describe('pds views with blocking', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient
  let aliceReplyToDan: { ref: RecordRef }

  let alice: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_block',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    // add follows just for kicks
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
    alice = sc.dids.alice
    carol = sc.dids.carol
    dan = sc.dids.dan
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
    // Contains reply by carol
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('blocks thread parent', async () => {
    // Parent is a post by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: aliceReplyToDan.ref.uriStr },
      { headers: sc.getHeaders(carol) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('blocks record embeds', async () => {
    // Contains a deep embed of carol's post, blocked by dan
    const { data: thread } = await agent.api.app.bsky.feed.getPostThread(
      { depth: 0, uri: sc.posts[alice][2].ref.uriStr },
      { headers: sc.getHeaders(dan) },
    )
    expect(forSnapshot(thread)).toMatchSnapshot()
  })

  it('errors on getting author feed', async () => {
    const attempt1 = agent.api.app.bsky.feed.getAuthorFeed(
      { actor: carol },
      { headers: sc.getHeaders(dan) },
    )
    await expect(attempt1).rejects.toThrow(BlockedActorError)

    const attempt2 = agent.api.app.bsky.feed.getAuthorFeed(
      { actor: dan },
      { headers: sc.getHeaders(carol) },
    )
    await expect(attempt2).rejects.toThrow(BlockedByActorError)
  })

  // it('strips blocked posts out of getPopular', async () => {
  //   for (let i = 0; i < 15; i++) {
  //     const accnt = await agent.api.com.atproto.server.createAccount({
  //       handle: `user${i}.test`,
  //       email: `user${i}@test.com`,
  //       password: 'password',
  //     })
  //     await
  //   }
  // })
})
