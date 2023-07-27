import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('proxy read after write', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_read_after_write',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    await network.bsky.sub.destroy()
  })

  afterAll(async () => {
    await network.close()
  })

  it('handles read after write on profiles', async () => {
    await sc.updateProfile(alice, { displayName: 'blah' })
    const res = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' } },
    )
    expect(res.data.displayName).toEqual('blah')
    expect(res.data.description).toBeUndefined()
  })

  it('handles read after write on getAuthorFeed', async () => {
    const res = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' } },
    )
    for (const item of res.data.feed) {
      if (item.post.author.did === alice) {
        expect(item.post.author.displayName).toEqual('blah')
      }
    }
  })

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
      'another reply',
    )
    const res: any = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][0].ref.uriStr },
      { headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' } },
    )
    const layerOne = res.data.thread.replies
    expect(layerOne.length).toBe(1)
    expect(layerOne[0].post.uri).toEqual(reply1.ref.uriStr)
    const layerTwo = layerOne[0].replies
    expect(layerTwo.length).toBe(1)
    expect(layerTwo[0].post.uri).toEqual(reply2.ref.uriStr)
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
    const res: any = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[carol][0].ref.uriStr },
      { headers: { ...sc.getHeaders(alice), 'x-appview-proxy': 'true' } },
    )
    const replies = res.data.thread.replies
    expect(replies.length).toBe(1)
    expect(replies[0].post.uri).toEqual(replyRes.uri)
    expect(replies[0].post.embed.record.uri).toEqual(
      sc.posts[alice][0].ref.uriStr,
    )
  })
})
