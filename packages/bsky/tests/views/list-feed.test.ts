import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type AppBskyFeedGetListFeed, type AtpAgent, ids } from '@atproto/api'
import {
  type RecordRef,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import {
  forSnapshot,
  paginateAll,
  stripViewer,
  stripViewerFromPost,
} from '../_util.js'

describe('list feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: DidString
  let bob: DidString
  let carol: DidString

  let listRef: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_list_feed',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    listRef = await sc.createList(alice, 'test list', 'curate')
    await sc.addToList(alice, alice, listRef)
    await sc.addToList(alice, bob, listRef)
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

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
      res.data.feed.every((row) =>
        [alice, bob].includes(row.post.author.did as DidString),
      ),
    ).toBeTruthy()
  })

  it('paginates', async () => {
    const results = (results: AppBskyFeedGetListFeed.OutputSchema[]) =>
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
    expect(paginatedAll[0].cursor).toBeDefined()
    expect(paginatedAll.at(-1)?.cursor).toBeUndefined()

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

    const exact = await network.bsky.ctx.dataplane.getListFeed({
      listUri: listRef.uriStr,
      limit: 7,
    })
    const nonterminal = await network.bsky.ctx.dataplane.getListFeed({
      listUri: listRef.uriStr,
      limit: 2,
    })
    expect(exact.items).toHaveLength(7)
    expect(exact.cursor).toBe('')
    expect(nonterminal.items).toHaveLength(2)
    expect(nonterminal.cursor).not.toBe('')
  })

  it('fills a limited list feed after an entirely filtered page', async () => {
    const member = await sc.createAccount('list-feed-page-fill-member', {
      handle: 'list-fill.test',
      email: 'list-feed-page-fill-member@example.com',
      password: 'hunter2',
    })
    const fillList = await sc.createList(alice, 'page fill list', 'curate')
    await sc.addToList(alice, member.did, fillList)
    const older = await sc.post(
      member.did,
      'older visible list post',
      undefined,
      undefined,
      undefined,
      { createdAt: '2030-02-01T00:00:00.000Z' },
    )
    const newer = await sc.post(
      member.did,
      'newer visible list post',
      undefined,
      undefined,
      undefined,
      { createdAt: '2030-02-02T00:00:00.000Z' },
    )
    const filtered1 = await sc.post(
      member.did,
      'filtered list post 1',
      undefined,
      undefined,
      undefined,
      { createdAt: '2030-02-03T00:00:00.000Z' },
    )
    const filtered2 = await sc.post(
      member.did,
      'filtered list post 2',
      undefined,
      undefined,
      undefined,
      { createdAt: '2030-02-04T00:00:00.000Z' },
    )
    await network.processAll()
    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: filtered1.ref.uriStr,
    })
    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: filtered2.ref.uriStr,
    })

    const { data } = await agent.api.app.bsky.feed.getListFeed(
      { list: fillList.uriStr, limit: 2 },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetListFeed,
        ),
      },
    )

    expect(data.feed.map((item) => item.post.uri)).toEqual([
      newer.ref.uriStr,
      older.ref.uriStr,
    ])
    expect(data.cursor).toBeUndefined()
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
