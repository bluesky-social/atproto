import assert from 'node:assert'
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

  describe('bounded by since', () => {
    let sinceList: RecordRef
    /** Posts present when `startCursor` was captured, oldest first. */
    let initial: RecordRef[]
    /** Posts made after `startCursor` was captured, oldest first. */
    let subsequent: RecordRef[]
    /** Start cursor of the list feed as it stood before `subsequent` existed. */
    let startCursor: string

    const fetchListFeed = async (
      params: AppBskyFeedGetListFeed.QueryParams,
    ) => {
      const { data } = await agent.api.app.bsky.feed.getListFeed(params, {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetListFeed,
        ),
      })
      return data
    }

    /*
     * sortAt is the lesser of createdAt and indexedAt, so backdating pins it to
     * createdAt and makes the order these tests bracket deterministic.
     */
    const postAt = async (did: DidString, text: string, createdAt: string) => {
      const post = await sc.post(did, text, undefined, undefined, undefined, {
        createdAt,
      })
      return post.ref
    }

    beforeAll(async () => {
      const member = await sc.createAccount('list-since-member', {
        handle: 'list-since.test',
        email: 'list-since-member@example.com',
        password: 'hunter2',
      })
      sinceList = await sc.createList(alice, 'since list', 'curate')
      await sc.addToList(alice, member.did, sinceList)

      initial = [
        await postAt(
          member.did,
          'list since initial 1',
          '2023-01-01T00:00:00.000Z',
        ),
        await postAt(
          member.did,
          'list since initial 2',
          '2023-01-02T00:00:00.000Z',
        ),
        await postAt(
          member.did,
          'list since initial 3',
          '2023-01-03T00:00:00.000Z',
        ),
      ]
      await network.processAll()

      const before = await fetchListFeed({ list: sinceList.uriStr })
      assert(before.startCursor, 'expected a start cursor')
      startCursor = before.startCursor

      subsequent = [
        await postAt(
          member.did,
          'list since subsequent 1',
          '2023-02-01T00:00:00.000Z',
        ),
        await postAt(
          member.did,
          'list since subsequent 2',
          '2023-02-02T00:00:00.000Z',
        ),
      ]
      await network.processAll()
    })

    it('returns a start cursor identifying the newest item of the page', async () => {
      const page = await fetchListFeed({ list: sinceList.uriStr })
      expect(page.feed.map((item) => item.post.uri)).toEqual([
        subsequent[1].uriStr,
        subsequent[0].uriStr,
        initial[2].uriStr,
        initial[1].uriStr,
        initial[0].uriStr,
      ])
      assert(page.startCursor, 'expected a start cursor')

      /*
       * The bound is exclusive, so a start cursor is pinned to a position by
       * what it excludes: bounding by the second page's start cursor returns
       * exactly the items above that page, and none of the page itself.
       */
      const first = await fetchListFeed({ list: sinceList.uriStr, limit: 2 })
      assert(first.cursor, 'expected a cursor')
      const second = await fetchListFeed({
        list: sinceList.uriStr,
        limit: 2,
        cursor: first.cursor,
      })
      expect(second.feed.map((item) => item.post.uri)).toEqual([
        initial[2].uriStr,
        initial[1].uriStr,
      ])
      assert(second.startCursor, 'expected a start cursor')

      const above = await fetchListFeed({
        list: sinceList.uriStr,
        since: second.startCursor,
      })
      expect(above.feed.map((item) => item.post.uri)).toEqual([
        subsequent[1].uriStr,
        subsequent[0].uriStr,
      ])
    })

    it('returns everything newer than since, echoing the cursor once exhausted', async () => {
      const page = await fetchListFeed({
        list: sinceList.uriStr,
        since: startCursor,
      })

      // The item at the boundary is not re-delivered: the bound is exclusive.
      expect(page.feed.map((item) => item.post.uri)).toEqual([
        subsequent[1].uriStr,
        subsequent[0].uriStr,
      ])
      expect(page.cursor).toBe(startCursor)
      assert(page.startCursor, 'expected a start cursor')
      expect(page.startCursor).not.toBe(startCursor)
    })

    it('returns nothing when since is the newest position the caller holds', async () => {
      const page = await fetchListFeed({ list: sinceList.uriStr })
      assert(page.startCursor, 'expected a start cursor')

      /*
       * `since` names an item the caller already holds, so bounding by the
       * newest position it knows about leaves nothing to return. The cursor is
       * still echoed back rather than emptied, so the caller can keep
       * paginating below the boundary.
       */
      const bounded = await fetchListFeed({
        list: sinceList.uriStr,
        since: page.startCursor,
      })
      expect(bounded.feed).toEqual([])
      expect(bounded.cursor).toBe(page.startCursor)
    })

    it('returns a normal cursor while the bounded range still has more', async () => {
      const page = await fetchListFeed({
        list: sinceList.uriStr,
        since: startCursor,
        limit: 1,
      })
      expect(page.feed.map((item) => item.post.uri)).toEqual([
        subsequent[1].uriStr,
      ])
      assert(page.cursor, 'expected a cursor')
      expect(page.cursor).not.toBe(startCursor)

      const next = await fetchListFeed({
        list: sinceList.uriStr,
        since: startCursor,
        cursor: page.cursor,
        limit: 1,
      })
      expect(next.feed.map((item) => item.post.uri)).toEqual([
        subsequent[0].uriStr,
      ])
      expect(next.cursor).toBe(startCursor)
    })

    it('rejects a malformed since with a 400', async () => {
      const promise = fetchListFeed({
        list: sinceList.uriStr,
        since: 'garbage',
      })
      await expect(promise).rejects.toMatchObject({
        status: 400,
        error: 'InvalidRequest',
      })
    })

    it('echoes since when a legacy cursor short-circuits the read', async () => {
      /*
       * A v1-format cursor is answered with an empty page without consulting
       * the dataplane, but a `since` request must still not come back with an
       * empty cursor.
       */
      const page = await fetchListFeed({
        list: sinceList.uriStr,
        since: startCursor,
        cursor: '1234567890123::bafyabc',
      })
      expect(page.feed).toEqual([])
      expect(page.cursor).toBe(startCursor)
    })

    it('keeps the echoed cursor when the bounded page is short after filtering', async () => {
      const member = await sc.createAccount('list-since-flt-member', {
        handle: 'list-since-flt.test',
        email: 'list-since-flt-member@example.com',
        password: 'hunter2',
      })
      const list = await sc.createList(alice, 'since filtered list', 'curate')
      await sc.addToList(alice, member.did, list)
      // Anchors the start cursor the bounded read is later bounded by.
      await postAt(
        member.did,
        'list since filtered boundary',
        '2023-03-01T00:00:00.000Z',
      )
      await network.processAll()

      const before = await fetchListFeed({ list: list.uriStr })
      assert(before.startCursor, 'expected a start cursor')

      const hidden = [
        await postAt(
          member.did,
          'list since filtered 1',
          '2023-03-02T00:00:00.000Z',
        ),
        await postAt(
          member.did,
          'list since filtered 2',
          '2023-03-03T00:00:00.000Z',
        ),
      ]
      const visible = await postAt(
        member.did,
        'list since filtered visible',
        '2023-03-04T00:00:00.000Z',
      )
      await network.processAll()
      await Promise.all(
        hidden.map((ref) =>
          network.bsky.ctx.dataplane.takedownRecord({ recordUri: ref.uriStr }),
        ),
      )

      // The page comes back under-filled, which would normally trigger a
      // refill; the echoed cursor has to survive that.
      const page = await fetchListFeed({
        list: list.uriStr,
        since: before.startCursor,
        limit: 3,
      })
      expect(page.feed.map((item) => item.post.uri)).toEqual([visible.uriStr])
      expect(page.cursor).toBe(before.startCursor)
    })

    it('bounds the dataplane page exclusively', async () => {
      const page = await network.bsky.ctx.dataplane.getListFeed({
        listUri: sinceList.uriStr,
        limit: 10,
        since: startCursor,
      })
      expect(page.items.map((item) => item.uri)).toEqual([
        subsequent[1].uriStr,
        subsequent[0].uriStr,
      ])
      expect(page.cursor).toBe(startCursor)
      expect(page.startCursor).not.toBe('')
      expect(page.startCursor).not.toBe(startCursor)

      const partial = await network.bsky.ctx.dataplane.getListFeed({
        listUri: sinceList.uriStr,
        limit: 1,
        since: startCursor,
      })
      expect(partial.items).toHaveLength(1)
      expect(partial.cursor).not.toBe('')
      expect(partial.cursor).not.toBe(startCursor)
    })
  })
})
