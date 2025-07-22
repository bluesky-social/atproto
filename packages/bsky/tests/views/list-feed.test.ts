import { AtpAgent } from '@atproto/api'
import { RecordRef, SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { OutputSchema as GetListFeedOutputSchema } from '../../src/lexicon/types/app/bsky/feed/getListFeed'
import {
  forSnapshot,
  paginateAll,
  stripViewer,
  stripViewerFromPost,
} from '../_util'

describe('list feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  let listRef: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_list_feed',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    listRef = await sc.createList(alice, 'test list', 'curate')
    await sc.addToList(alice, alice, listRef)
    await sc.addToList(alice, bob, listRef)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches list feed', async () => {
    const res = await agent.api.app.bsky.feed.getListFeed(
      { list: listRef.uriStr },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetListFeed,
        ),
      },
    )
    expect(forSnapshot(res.data.feed)).toMatchSnapshot()

    // all posts are from alice or bob
    expect(
      res.data.feed.every((row) => [alice, bob].includes(row.post.author.did)),
    ).toBeTruthy()
  })

  it('paginates', async () => {
    const results = (results: GetListFeedOutputSchema[]) =>
      results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getListFeed(
        {
          list: listRef.uriStr,
          cursor,
          limit: 2,
        },
        {
          headers: await network.serviceHeaders(
            carol,
            ids.AppBskyFeedGetListFeed,
          ),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getListFeed(
      { list: listRef.uriStr },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetListFeed,
        ),
      },
    )

    expect(full.data.feed.length).toEqual(7)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches results unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getListFeed(
      { list: listRef.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetListFeed,
        ),
      },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getListFeed({
      list: listRef.uriStr,
    })
    expect(unauthed.feed.length).toBeGreaterThan(0)
    expect(unauthed.feed).toEqual(
      authed.feed.map((item) => {
        const result = {
          ...item,
          post: stripViewerFromPost(item.post),
        }
        if (item.reply) {
          result.reply = {
            parent: stripViewerFromPost(item.reply.parent, true),
            root: stripViewerFromPost(item.reply.root, true),
          }

          if (item.reply.grandparentAuthor) {
            result.reply.grandparentAuthor = stripViewer(
              item.reply.grandparentAuthor,
            )
          }
        }
        return result
      }),
    )
  })

  it('works for empty lists', async () => {
    const emptyList = await sc.createList(alice, 'empty list', 'curate')
    const res = await agent.api.app.bsky.feed.getListFeed({
      list: emptyList.uriStr,
    })

    expect(res.data.feed.length).toEqual(0)
  })

  it('blocks posts by actor takedown', async () => {
    await network.bsky.ctx.dataplane.takedownActor({
      did: bob,
    })

    const res = await agent.api.app.bsky.feed.getListFeed({
      list: listRef.uriStr,
    })
    const hasBob = res.data.feed.some((item) => item.post.author.did === bob)
    expect(hasBob).toBe(false)

    // Cleanup
    await network.bsky.ctx.dataplane.untakedownActor({
      did: bob,
    })
  })

  it('blocks posts by record takedown.', async () => {
    const postRef = sc.replies[bob][0].ref // Post and reply parent
    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: postRef.uriStr,
    })

    const res = await agent.api.app.bsky.feed.getListFeed({
      list: listRef.uriStr,
    })
    const hasPost = res.data.feed.some(
      (item) => item.post.uri === postRef.uriStr,
    )
    expect(hasPost).toBe(false)

    // Cleanup
    await network.bsky.ctx.dataplane.untakedownRecord({
      recordUri: postRef.uriStr,
    })
  })

  it('does not return posts with creator blocks', async () => {
    await sc.block(bob, alice)
    await network.processAll()

    const res = await agent.api.app.bsky.feed.getListFeed({
      list: listRef.uriStr,
    })

    const hasBob = res.data.feed.some((item) => item.post.author.did === bob)
    expect(hasBob).toBe(false)
  })
})
