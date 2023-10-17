import util from 'util'
import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient, RecordRef } from '@atproto/dev-env'
import basicSeed from '../seeds/basic'
import { ThreadViewPost } from '../../src/lexicon/types/app/bsky/feed/defs'
import { View as RecordEmbedView } from '../../src/lexicon/types/app/bsky/embed/record'

describe('proxy read after write', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let carol: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_read_after_write',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    carol = sc.dids.carol
    await network.bsky.sub.destroy()
  })

  afterAll(async () => {
    await network.close()
  })

  it('handles read after write on profiles', async () => {
    await sc.updateProfile(alice, { displayName: 'blah' })
    const res = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: { ...sc.getHeaders(alice) } },
    )
    expect(res.data.displayName).toEqual('blah')
    expect(res.data.description).toBeUndefined()
  })

  it('handles image formatting', async () => {
    const blob = await sc.uploadFile(
      alice,
      'tests/sample-img/key-landscape-small.jpg',
      'image/jpeg',
    )
    await sc.updateProfile(alice, { displayName: 'blah', avatar: blob.image })

    const res = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: { ...sc.getHeaders(alice) } },
    )
    expect(res.data.avatar).toEqual(
      util.format(
        network.pds.ctx.cfg.bskyAppView.cdnUrlPattern,
        'avatar',
        alice,
        blob.image.ref.toString(),
      ),
    )
  })

  it('handles read after write on getAuthorFeed', async () => {
    const res = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: { ...sc.getHeaders(alice) } },
    )
    for (const item of res.data.feed) {
      if (item.post.author.did === alice) {
        expect(item.post.author.displayName).toEqual('blah')
      }
    }
  })

  let replyRef1: RecordRef
  let replyRef2: RecordRef

  it('handles read after write on threads', async () => {
    const reply1 = await sc.reply(
      alice,
      sc.posts[alice][0].ref,
      sc.posts[alice][0].ref,
      'another reply',
    )
    const reply2 = await sc.reply(
      alice,
      sc.posts[alice][0].ref,
      reply1.ref,
      'another another reply',
    )
    replyRef1 = reply1.ref
    replyRef2 = reply2.ref
    const res = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][0].ref.uriStr },
      { headers: { ...sc.getHeaders(alice) } },
    )
    const layerOne = res.data.thread.replies as ThreadViewPost[]
    expect(layerOne.length).toBe(1)
    expect(layerOne[0].post.uri).toEqual(reply1.ref.uriStr)
    const layerTwo = layerOne[0].replies as ThreadViewPost[]
    expect(layerTwo.length).toBe(1)
    expect(layerTwo[0].post.uri).toEqual(reply2.ref.uriStr)
  })

  it('handles read after write on a thread that is not found on appview', async () => {
    const res = await agent.api.app.bsky.feed.getPostThread(
      { uri: replyRef1.uriStr },
      { headers: { ...sc.getHeaders(alice) } },
    )
    const thread = res.data.thread as ThreadViewPost
    expect(thread.post.uri).toEqual(replyRef1.uriStr)
    expect((thread.parent as ThreadViewPost).post.uri).toEqual(
      sc.posts[alice][0].ref.uriStr,
    )
    expect(thread.replies?.length).toEqual(1)
    expect((thread.replies?.at(0) as ThreadViewPost).post.uri).toEqual(
      replyRef2.uriStr,
    )
  })

  it('handles read after write on threads with record embeds', async () => {
    const replyRes = await agent.api.app.bsky.feed.post.create(
      { repo: alice },
      {
        text: 'blah',
        reply: {
          root: sc.posts[carol][0].ref.raw,
          parent: sc.posts[carol][0].ref.raw,
        },
        embed: {
          $type: 'app.bsky.embed.record',
          record: sc.posts[alice][0].ref.raw,
        },
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    const res = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[carol][0].ref.uriStr },
      { headers: { ...sc.getHeaders(alice) } },
    )
    const replies = res.data.thread.replies as ThreadViewPost[]
    expect(replies.length).toBe(1)
    expect(replies[0].post.uri).toEqual(replyRes.uri)
    const embed = replies[0].post.embed as RecordEmbedView
    expect(embed.record.uri).toEqual(sc.posts[alice][0].ref.uriStr)
  })

  it('handles read after write on getTimeline', async () => {
    const postRes = await agent.api.app.bsky.feed.post.create(
      { repo: alice },
      {
        text: 'poast',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    const res = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: { ...sc.getHeaders(alice) } },
    )
    expect(res.data.feed[0].post.uri).toEqual(postRes.uri)
  })

  it('returns lag headers', async () => {
    const res = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: { ...sc.getHeaders(alice) } },
    )
    const lag = res.headers['atproto-upstream-lag']
    expect(lag).toBeDefined()
    const parsed = parseInt(lag)
    expect(parsed > 0).toBe(true)
  })
})
