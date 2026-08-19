import assert from 'node:assert'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  AppBskyUnspeccedDefs,
  type AppBskyUnspeccedGetPostThreadOtherV2,
  type AppBskyUnspeccedGetPostThreadV2,
  type AtpAgent,
  ids,
} from '@atproto/api'
import { type SeedClient, TestNetwork, seedThreadV2 } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import type {
  ThreadItemValuePost,
  ThreadOtherItemValuePost,
} from '../../src/views/threads-v2.js'
import { forSnapshot } from '../_util.js'

type PostProps = Pick<
  AppBskyUnspeccedDefs.ThreadItemPost,
  'moreReplies' | 'opThread'
>
const props = (overrides: Partial<PostProps> = {}): PostProps => ({
  moreReplies: 0,
  opThread: false,
  ...overrides,
})

type PostPropsHidden = Pick<
  AppBskyUnspeccedDefs.ThreadItemPost,
  'hiddenByThreadgate' | 'mutedByViewer'
>
const propsHidden = (
  overrides: Partial<PostPropsHidden> = {},
): PostPropsHidden => ({
  hiddenByThreadgate: false,
  mutedByViewer: false,
  ...overrides,
})

describe('appview thread views v2', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let labelerDid: string
  let sc: SeedClient<TestNetwork>

  beforeAll(async () => {
    network = await TestNetwork.create({
      bsky: {
        maxThreadParents: 15,
        threadTagsBumpDown: new Set([seedThreadV2.TAG_BUMP_DOWN]),
        threadTagsHide: new Set([seedThreadV2.TAG_HIDE]),
      },
      dbPostgresSchema: 'bsky_views_thread_v_two',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    labelerDid = network.bsky.ctx.cfg.modServiceDid
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  describe('not found anchor', () => {
    it('returns not found error', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2({
        anchor: 'at://did:plc:123/app.bsky.feed.post/456',
      })
      const { thread: t } = data

      expect(t).toEqual([
        expect.objectContaining({
          depth: 0,
          value: {
            $type: 'app.bsky.unspecced.defs#threadItemNotFound',
          },
        }),
      ])
    })
  })

  describe('simple thread', () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.simple>>

    beforeAll(async () => {
      seed = await seedThreadV2.simple(sc)
      await network.processAll()
    })

    it('returns thread anchored on root', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      assertPosts(t)
      expect(hasOtherReplies).toBe(false)
      expect(t).toEqual([
        expect.objectContaining({ depth: 0, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['0'].ref.uriStr }),
        expect.objectContaining({ depth: 2, uri: seed.r['0.0'].ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['1'].ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['2'].ref.uriStr }),
        expect.objectContaining({ depth: 2, uri: seed.r['2.0'].ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['3'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on r 0', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.r['0'].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      assertPosts(t)
      expect(hasOtherReplies).toBe(false)
      expect(t).toEqual([
        expect.objectContaining({ depth: -1, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['0'].ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['0.0'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on r 0.0', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.r['0.0'].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      assertPosts(t)
      expect(hasOtherReplies).toBe(false)
      expect(t).toEqual([
        expect.objectContaining({ depth: -2, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: -1, uri: seed.r['0'].ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['0.0'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on 1', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.r['1'].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      assertPosts(t)
      expect(hasOtherReplies).toBe(false)
      expect(t).toEqual([
        expect.objectContaining({ depth: -1, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['1'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on 2', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.r['2'].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      assertPosts(t)
      expect(hasOtherReplies).toBe(false)
      expect(t).toEqual([
        expect.objectContaining({ depth: -1, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['2'].ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['2.0'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on 2.0', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.r['2.0'].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      assertPosts(t)
      expect(hasOtherReplies).toBe(false)
      expect(t).toEqual([
        expect.objectContaining({ depth: -2, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: -1, uri: seed.r['2'].ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['2.0'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on 3', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.r['3'].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      assertPosts(t)
      expect(hasOtherReplies).toBe(false)
      expect(t).toEqual([
        expect.objectContaining({ depth: -1, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['3'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns known likers on the anchor post', async () => {
      await sc.follow(seed.users.op.did, seed.users.alice.did)
      await sc.like(seed.users.alice.did, seed.root.ref)
      await sc.like(seed.users.bob.did, seed.root.ref)
      await network.processAll()

      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      assertPosts(data.thread)
      const anchor = data.thread.find((item) => item.depth === 0)

      expect(
        anchor?.value.post.viewer?.knownLikers?.actors.map(
          (actor) => actor.did,
        ),
      ).toEqual([seed.users.alice.did])
      expect(anchor?.value.post.viewer?.knownLikers?.count).toBe(1)
    })
  })

  describe('long thread', () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.long>>

    beforeAll(async () => {
      seed = await seedThreadV2.long(sc)
      await network.processAll()
    })

    describe('calculating depth', () => {
      type Case = {
        postKey: string
      }

      const cases: Case[] = [
        { postKey: 'root' },
        { postKey: '0' },
        { postKey: '0.0' },
        { postKey: '0.0.0' },
        { postKey: '0.0.0.0' },
        { postKey: '0.0.0.0.0' },
        { postKey: '0.0.1' },
        { postKey: '1' },
        { postKey: '2' },
        { postKey: '3' },
        { postKey: '4' },
        { postKey: '4.0' },
        { postKey: '4.0.0' },
        { postKey: '4.0.0.0' },
        { postKey: '4.0.0.0.0' },
        { postKey: '5' },
        { postKey: '6' },
        { postKey: '7' },
      ]

      it.each(cases)(
        'calculates the depths anchored at $postKey',
        async ({ postKey }) => {
          const post = postKey === 'root' ? seed.root : seed.r[postKey]
          const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
            { anchor: post.ref.uriStr },
            {
              headers: await network.serviceHeaders(
                seed.users.op.did,
                ids.AppBskyUnspeccedGetPostThreadV2,
              ),
            },
          )
          const { thread: t, hasOtherReplies } = data

          assertPosts(t)
          expect(hasOtherReplies).toBe(false)
          const anchorIndex = t.findIndex((i) => i.uri === post.ref.uriStr)
          const anchorPost = t[anchorIndex]

          const parents = t.slice(0, anchorIndex)
          const children = t.slice(anchorIndex + 1, t.length)

          parents.forEach((parent) => {
            expect(parent.depth).toBeLessThan(0)
          })
          expect(anchorPost.depth).toEqual(0)
          children.forEach((child) => {
            expect(child.depth).toBeGreaterThan(0)
          })
        },
      )
    })
  })

  describe('deep thread', () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.deep>>

    beforeAll(async () => {
      seed = await seedThreadV2.deep(sc)
      await network.processAll()
    })

    describe('above', () => {
      it('returns the ancestors above if true (default)', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: seed.r['0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0'].ref.uriStr,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        assertPosts(t)
        expect(hasOtherReplies).toBe(false)
        expect(t).toHaveLength(16) // anchor + 15 ancestors, as limited by `maxThreadParents`.

        const first = t.at(0)
        expect(first!.uri).toBe(seed.r['0.0.0'].ref.uriStr)
        expect(first!.value.moreParents).toBe(true)

        const second = t.at(1)
        expect(second!.uri).toBe(seed.r['0.0.0.0'].ref.uriStr)
        expect(second!.value.moreParents).toBe(false)

        const last = t.at(-1)
        expect(last!.uri).toBe(
          seed.r['0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0'].ref.uriStr,
        )
        expect(last!.value.moreParents).toBe(false)
      })

      it(`does not return ancestors if false`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: seed.r['0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0'].ref.uriStr,
            above: false,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        assertPosts(t)
        expect(hasOtherReplies).toBe(false)
        expect(t).toHaveLength(1)

        const first = t.at(0)
        expect(first!.uri).toBe(
          seed.r['0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0'].ref.uriStr,
        )
      })
    })

    describe('below', () => {
      it('limits to the below count', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: seed.root.ref.uriStr,
            below: 10,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        assertPosts(t)
        expect(hasOtherReplies).toBe(false)
        expect(t).toHaveLength(11)
        const first = t.at(0)
        expect(first!.uri).toBe(seed.root.ref.uriStr)
      })

      it(`does not fulfill the below count if there are not enough items in the thread`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: seed.r['0.0.0.0.0.0.0.0.0.0.0.0.0.0.0'].ref.uriStr,
            above: false,
            below: 10,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        assertPosts(t)
        expect(hasOtherReplies).toBe(false)
        expect(t).toHaveLength(4)

        const first = t.at(0)
        expect(first!.uri).toBe(
          seed.r['0.0.0.0.0.0.0.0.0.0.0.0.0.0.0'].ref.uriStr,
        )
      })
    })
  })

  describe('branching factor', () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.branchingFactor>>

    beforeAll(async () => {
      seed = await seedThreadV2.branchingFactor(sc)
      await network.processAll()
    })

    type Case =
      | {
          branchingFactor: number
          sort: AppBskyUnspeccedGetPostThreadV2.QueryParams['sort']
          postKeys: string[]
        }
      | {
          branchingFactor: number
          sort: AppBskyUnspeccedGetPostThreadV2.QueryParams['sort']
          // For higher branching factors it gets too verbose to write all posts.
          length: number
        }
    const cases: Case[] = [
      {
        branchingFactor: 1,
        sort: 'oldest',
        postKeys: [
          'root',
          '0',
          '0.0',
          '0.0.0',
          '1',
          '1.0',
          '1.0.0',
          '2',
          '2.0',
          '2.0.0',
          '3',
          '3.0',
          '3.0.0',
        ],
      },
      {
        branchingFactor: 1,
        sort: 'newest',
        postKeys: [
          'root',
          '3',
          '3.3',
          '3.3.3',
          '2',
          '2.3',
          '2.3.3',
          '1',
          '1.3',
          '1.3.3',
          '0',
          '0.3',
          '0.3.3',
        ],
      },
      {
        branchingFactor: 2,
        sort: 'oldest',
        postKeys: [
          'root',
          '0',
          '0.0',
          '0.0.0',
          '0.0.1',
          '0.1',
          '0.1.0',
          '0.1.1',
          '1',
          '1.0',
          '1.0.0',
          '1.1',
          '1.1.0',
          '1.1.1',
          '2',
          '2.0',
          '2.0.0',
          '2.0.1',
          '2.1',
          '2.1.0',
          '2.1.1',
          '3',
          '3.0',
          '3.0.0',
          '3.0.1',
          '3.1',
          '3.1.0',
          '3.1.1',
        ],
      },
      {
        branchingFactor: 2,
        sort: 'newest',
        postKeys: [
          'root',
          '3',
          '3.3',
          '3.3.3',
          '3.3.2',
          '3.2',
          '3.2.3',
          '3.2.2',
          '2',
          '2.3',
          '2.3.3',
          '2.3.2',
          '2.2',
          '2.2.3',
          '2.2.2',
          '1',
          '1.3',
          '1.3.3',
          '1.3.2',
          '1.2',
          '1.2.3',
          '1.2.2',
          '0',
          '0.3',
          '0.3.3',
          '0.3.2',
          '0.2',
          '0.2.3',
          '0.2.2',
        ],
      },
      {
        branchingFactor: 3,
        sort: 'newest',
        length: 53,
      },
      {
        branchingFactor: 4,
        sort: 'newest',
        length: 82,
      },
      {
        branchingFactor: 5,
        sort: 'newest',
        // The seeds have 1 post with 5 replies, so it is +1 compared to branchingFactor 4.
        length: 83,
      },
    ]

    it.each(cases)(
      'returns all top-level replies and limits nested to branching factor of $branchingFactor when sorting by $sort',
      async (args) => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: seed.root.ref.uriStr,
            sort: 'sort' in args ? args.sort : undefined,
            branchingFactor: args.branchingFactor,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        assertPosts(t)
        expect(hasOtherReplies).toBe(false)
        if ('length' in args) {
          expect(data.thread).toHaveLength(args.length)
        } else {
          const tUris = t.map((i) => i.uri)
          const postUris = args.postKeys.map((k) =>
            k === 'root' ? seed.root.ref.uriStr : seed.r[k].ref.uriStr,
          )
          expect(tUris).toEqual(postUris)
        }
      },
    )
  })

  describe('annotate more replies', () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.annotateMoreReplies>>

    beforeAll(async () => {
      seed = await seedThreadV2.annotateMoreReplies(sc)
      await network.processAll()
    })

    it('annotates correctly both in cases of trimmed replies by depth and by branching factor reached', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        {
          anchor: seed.root.ref.uriStr,
          below: 4,
          branchingFactor: 2,
        },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      assertPosts(t)
      expect(hasOtherReplies).toBe(false)
      expect(t).toEqual([
        expect.objectContaining({
          uri: seed.root.ref.uriStr,
          value: expect.objectContaining(props({ opThread: true })),
        }),
        expect.objectContaining({
          uri: seed.r['0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0.0.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0.0.0.0'].ref.uriStr,
          value: expect.objectContaining(props({ moreReplies: 5 })),
        }),
        expect.objectContaining({
          uri: seed.r['0.1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0.1.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0.1.0.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining(props({ moreReplies: 1 })),
        }),
        expect.objectContaining({
          uri: seed.r['1.0'].ref.uriStr,
          value: expect.objectContaining(props({ moreReplies: 3 })),
        }),
        expect.objectContaining({
          uri: seed.r['1.0.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1.0.1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1.1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1.1.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1.1.1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
      ])
    })
  })

  describe(`annotate OP thread`, () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.annotateOP>>

    beforeAll(async () => {
      seed = await seedThreadV2.annotateOP(sc)
      await network.processAll()
    })

    type Case = {
      postKey: string
      length: number
      opThreadPostKeys: string[]
    }

    const cases: Case[] = [
      {
        postKey: 'root',
        length: 9,
        opThreadPostKeys: ['root', '0', '0.0', '0.0.0'],
      },
      {
        postKey: '0',
        length: 4,
        opThreadPostKeys: ['root', '0', '0.0', '0.0.0'],
      },
      {
        postKey: '0.0',
        length: 4,
        opThreadPostKeys: ['root', '0', '0.0', '0.0.0'],
      },
      {
        postKey: '0.0.0',
        length: 4,
        opThreadPostKeys: ['root', '0', '0.0', '0.0.0'],
      },
      {
        postKey: '1',
        length: 3,
        opThreadPostKeys: ['root'],
      },
      {
        postKey: '1.0',
        length: 3,
        opThreadPostKeys: ['root'],
      },
      {
        postKey: '2',
        length: 4,
        opThreadPostKeys: ['root'],
      },
      {
        postKey: '2.0',
        length: 4,
        opThreadPostKeys: ['root'],
      },
      {
        postKey: '2.0.0',
        length: 4,
        opThreadPostKeys: ['root'],
      },
    ]

    it.each(cases)(
      `annotates OP threads correctly anchored at $postKey`,
      async ({ postKey, length, opThreadPostKeys: opThreadPosts }) => {
        const post = postKey === 'root' ? seed.root : seed.r[postKey]
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: post.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        assertPosts(t)
        expect(hasOtherReplies).toBe(false)
        const opThreadPostsUris = new Set<string>(
          opThreadPosts.map((k) =>
            k === 'root' ? seed.root.ref.uriStr : seed.r[k].ref.uriStr,
          ),
        )
        const opThreadIndexByUri = new Map<string, number>([
          [seed.root.ref.uriStr, 1],
          [seed.r['0'].ref.uriStr, 2],
          [seed.r['0.0'].ref.uriStr, 3],
          [seed.r['0.0.0'].ref.uriStr, 4],
        ])

        expect(t).toHaveLength(length)
        t.forEach((i) => {
          const isOpThread = opThreadPostsUris.has(i.uri)
          expect(i.value.opThread).toBe(isOpThread)
          expect(i.value.opThreadPostIndex).toBe(
            isOpThread ? opThreadIndexByUri.get(i.uri) : undefined,
          )
          expect(i.value.opThreadPostCount).toBe(isOpThread ? 4 : undefined)
        })
      },
    )

    it(`preserves the full OP thread count when replies are truncated`, async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.root.ref.uriStr, below: 1 },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )

      assertPosts(data.thread)
      const opThreadPosts = data.thread.filter((item) => item.value.opThread)
      expect(opThreadPosts.map((item) => item.uri)).toEqual([
        seed.root.ref.uriStr,
        seed.r['0'].ref.uriStr,
      ])
      expect(
        opThreadPosts.map((item) => ({
          index: item.value.opThreadPostIndex,
          count: item.value.opThreadPostCount,
        })),
      ).toEqual([
        { index: 1, count: 4 },
        { index: 2, count: 4 },
      ])
    })

    it(`does not number a post without an OP thread`, async () => {
      const post = await sc.post(seed.users.op.did, 'standalone post')
      await network.processAll()
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: post.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )

      assertPosts(data.thread)
      expect(data.thread).toHaveLength(1)
      expect(data.thread[0].value.opThread).toBe(true)
      expect(data.thread[0].value.opThreadPostIndex).toBeUndefined()
      expect(data.thread[0].value.opThreadPostCount).toBeUndefined()
    })

    it.each(['oldest', 'newest', 'top'] as const)(
      `keeps the OP thread reply first beneath its parent under %s sort`,
      async (sort) => {
        // Root's replies include the chain reply 0 (oldest) and the OP fork 2
        // (newest). Under newest/top the fork would otherwise sort above the
        // chain within the OP bump; the chain reply must stay first.
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.root.ref.uriStr, sort },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )

        assertPosts(data.thread)
        const depth1 = data.thread.filter((item) => item.depth === 1)
        expect(depth1[0].uri).toBe(seed.r['0'].ref.uriStr)
        expect(depth1[0].value.opThread).toBe(true)
      },
    )
  })

  describe('OP thread numbering with deleted replies', () => {
    let op: DidString

    beforeAll(async () => {
      await sc.createAccount('opdel', {
        handle: 'opdel.test',
        email: 'opdel@test.com',
        password: 'opdel-pass',
      })
      op = sc.dids.opdel
      await network.processAll()
    })

    // Maps the rendered post items to their numbering. Non-post items (e.g. a
    // deleted parent rendered as a not-found placeholder) are skipped.
    const getNumbering = async (anchor: string) => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor },
        {
          headers: await network.serviceHeaders(
            op,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      return data.thread.flatMap((item) =>
        AppBskyUnspeccedDefs.isThreadItemPost(item.value)
          ? [
              {
                uri: item.uri,
                index: item.value.opThreadPostIndex,
                count: item.value.opThreadPostCount,
              },
            ]
          : [],
      )
    }

    it(`keeps a deleted middle reply's slot while replies below it survive`, async () => {
      const root = await sc.post(op, 'root')
      await network.processAll()
      const first = await sc.reply(op, root.ref, root.ref, 'first')
      await network.processAll()
      const second = await sc.reply(op, root.ref, first.ref, 'second')
      await network.processAll()

      // Deleting `first` keeps its slot: `second` survives below it.
      await sc.deletePost(op, first.ref.uri)
      await network.processAll()

      // The descendants walk cannot route through the deleted post, so
      // `second` is unreachable from the root and does not render — but the
      // chain still counts all three slots, keeping the numbering stable.
      const numbering = await getNumbering(root.ref.uriStr)
      expect(numbering).toEqual([{ uri: root.ref.uriStr, index: 1, count: 3 }])

      // Anchoring on the surviving reply shows its stable position.
      const anchored = await getNumbering(second.ref.uriStr)
      expect(anchored).toContainEqual({
        uri: second.ref.uriStr,
        index: 3,
        count: 3,
      })
    })

    it(`frees a deleted tail reply's slot and allows a younger continuation`, async () => {
      const root = await sc.post(op, 'root')
      await network.processAll()
      const first = await sc.reply(op, root.ref, root.ref, 'first')
      await network.processAll()
      const tail = await sc.reply(op, root.ref, first.ref, 'tail')
      await network.processAll()

      // Deleting the tail frees its slot: nothing survives below it.
      await sc.deletePost(op, tail.ref.uri)
      await network.processAll()

      let numbering = await getNumbering(root.ref.uriStr)
      expect(numbering).toEqual([
        { uri: root.ref.uriStr, index: 1, count: 2 },
        { uri: first.ref.uriStr, index: 2, count: 2 },
      ])

      // OP picks the thread back up from the surviving tail. The replacement
      // takes the freed slot even though it is younger than the deleted reply.
      const replacement = await sc.reply(op, root.ref, first.ref, 'replacement')
      await network.processAll()

      numbering = await getNumbering(root.ref.uriStr)
      expect(numbering).toEqual([
        { uri: root.ref.uriStr, index: 1, count: 3 },
        { uri: first.ref.uriStr, index: 2, count: 3 },
        { uri: replacement.ref.uriStr, index: 3, count: 3 },
      ])
    })

    it(`does not let a younger fork re-anchor the chain after a middle delete`, async () => {
      const root = await sc.post(op, 'root')
      await network.processAll()
      const first = await sc.reply(op, root.ref, root.ref, 'first')
      await network.processAll()
      const second = await sc.reply(op, root.ref, first.ref, 'second')
      await network.processAll()

      await sc.deletePost(op, first.ref.uri)
      await network.processAll()

      // OP replies to the root again. This is a fork, not a continuation: it
      // is younger than the deleted reply it sits beside, whose slot is held
      // by the surviving `second` below it.
      const fork = await sc.reply(op, root.ref, root.ref, 'fork')
      await network.processAll()

      // `second` is unreachable through the deleted post from the root, so it
      // does not render — but its held slot keeps the chain at 3, and the fork
      // renders as a plain reply, unnumbered.
      const numbering = await getNumbering(root.ref.uriStr)
      expect(numbering).toEqual([
        { uri: root.ref.uriStr, index: 1, count: 3 },
        { uri: fork.ref.uriStr, index: undefined, count: undefined },
      ])

      // Anchoring on the surviving reply shows its stable position.
      const anchored = await getNumbering(second.ref.uriStr)
      expect(anchored).toContainEqual({
        uri: second.ref.uriStr,
        index: 3,
        count: 3,
      })
    })

    it(`does not promote a reply that predates the deletion it would replace`, async () => {
      const root = await sc.post(op, 'root')
      await network.processAll()
      const first = await sc.reply(op, root.ref, root.ref, 'first')
      await network.processAll()
      const tail = await sc.reply(op, root.ref, first.ref, 'tail')
      await network.processAll()
      // Created before the delete, so it was never part of the chain.
      const bystander = await sc.reply(op, root.ref, first.ref, 'bystander')
      await network.processAll()

      await sc.deletePost(op, tail.ref.uri)
      await network.processAll()

      // The vacated slot is not claimed by the pre-existing bystander.
      const numbering = await getNumbering(root.ref.uriStr)
      expect(numbering).toEqual([
        { uri: root.ref.uriStr, index: 1, count: 2 },
        { uri: first.ref.uriStr, index: 2, count: 2 },
        { uri: bystander.ref.uriStr, index: undefined, count: undefined },
      ])
    })

    it(`yields a fully deleted line only to a reply written after the deletion`, async () => {
      const root = await sc.post(op, 'root')
      await network.processAll()
      const abandoned = await sc.reply(op, root.ref, root.ref, 'abandoned')
      await network.processAll()
      const abandonedChild = await sc.reply(
        op,
        root.ref,
        abandoned.ref,
        'abandoned child',
      )
      await network.processAll()
      // Created before the deletes, so it can never claim the vacated slot.
      const bystander = await sc.reply(op, root.ref, root.ref, 'bystander')
      await network.processAll()

      // Delete the whole abandoned line.
      await sc.deletePost(op, abandonedChild.ref.uri)
      await sc.deletePost(op, abandoned.ref.uri)
      await network.processAll()

      // The whole line is gone and nothing newer exists yet, so the chain is
      // just the root — a chain of one, so nothing is numbered.
      let numbering = await getNumbering(root.ref.uriStr)
      expect(numbering).toEqual([
        { uri: root.ref.uriStr, index: undefined, count: undefined },
        { uri: bystander.ref.uriStr, index: undefined, count: undefined },
      ])

      // A reply written after the deletion does claim the slot, and as the
      // chain reply it appears above the older bystander.
      const fork = await sc.reply(op, root.ref, root.ref, 'fork')
      await network.processAll()

      numbering = await getNumbering(root.ref.uriStr)
      expect(numbering).toEqual([
        { uri: root.ref.uriStr, index: 1, count: 2 },
        { uri: fork.ref.uriStr, index: 2, count: 2 },
        { uri: bystander.ref.uriStr, index: undefined, count: undefined },
      ])
    })
  })

  describe('bumping and sorting', () => {
    describe('sorting', () => {
      let seed: Awaited<ReturnType<typeof seedThreadV2.sort>>

      beforeAll(async () => {
        seed = await seedThreadV2.sort(sc)
        await network.processAll()
      })

      type Case = {
        sort: AppBskyUnspeccedGetPostThreadV2.QueryParams['sort']
        postKeys: string[]
      }

      const cases: Case[] = [
        {
          sort: 'newest',
          postKeys: [
            'root',
            '2',
            '2.2',
            '2.1',
            '2.0',
            '1',
            '1.2',
            '1.1',
            '1.0',
            '0',
            '0.2',
            '0.1',
            '0.0',
          ],
        },
        {
          sort: 'oldest',
          postKeys: [
            'root',
            '0',
            '0.0',
            '0.1',
            '0.2',
            '1',
            '1.0',
            '1.1',
            '1.2',
            '2',
            '2.0',
            '2.1',
            '2.2',
          ],
        },
        {
          sort: 'top',
          postKeys: [
            'root',
            '1',
            '1.1',
            '1.0',
            '1.2',
            '2',
            '2.0',
            '2.1',
            '2.2',
            '0',
            '0.2',
            '0.1',
            '0.0',
          ],
        },
      ]

      it.each(cases)(
        'sorts by $sort in all levels',
        async ({ sort: sort, postKeys }) => {
          const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
            {
              anchor: seed.root.ref.uriStr,
              sort,
            },
            {
              headers: await network.serviceHeaders(
                seed.users.op.did,
                ids.AppBskyUnspeccedGetPostThreadV2,
              ),
            },
          )
          const { thread: t, hasOtherReplies } = data

          assertPosts(t)
          expect(hasOtherReplies).toBe(false)
          const tUris = t.map((i) => i.uri)
          const postUris = postKeys.map((k) =>
            k === 'root' ? seed.root.ref.uriStr : seed.r[k].ref.uriStr,
          )
          expect(tUris).toEqual(postUris)
        },
      )
    })

    describe('bumping', () => {
      describe('sorting within bumped post groups', () => {
        let seed: Awaited<ReturnType<typeof seedThreadV2.bumpGroupSorting>>

        beforeAll(async () => {
          seed = await seedThreadV2.bumpGroupSorting(sc)
          await network.processAll()
        })

        type Case = {
          sort: AppBskyUnspeccedGetPostThreadV2.QueryParams['sort']
          postKeys: string[]
        }

        const cases: Case[] = [
          {
            // `1` is on the OP thread (root's oldest OP reply), so it stays
            // first within the OP group regardless of sort.
            sort: 'newest',
            postKeys: ['root', '1', '5', '3', '7', '4', '0', '6', '2'],
          },
          {
            sort: 'oldest',
            postKeys: ['root', '1', '3', '5', '0', '4', '7', '2', '6'],
          },
        ]

        it.each(cases)(
          'sorts by $sort inside each bumped group',
          async ({ sort: sort, postKeys }) => {
            const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
              {
                anchor: seed.root.ref.uriStr,
                sort,
              },
              {
                headers: await network.serviceHeaders(
                  seed.users.viewer.did,
                  ids.AppBskyUnspeccedGetPostThreadV2,
                ),
              },
            )
            const { thread: t, hasOtherReplies } = data

            assertPosts(t)
            expect(hasOtherReplies).toBe(false)
            const tUris = t.map((i) => i.uri)
            const postUris = postKeys.map((k) =>
              k === 'root' ? seed.root.ref.uriStr : seed.r[k].ref.uriStr,
            )
            expect(tUris).toEqual(postUris)
          },
        )
      })

      describe('OP and viewer', () => {
        let seed: Awaited<ReturnType<typeof seedThreadV2.bumpOpAndViewer>>

        beforeAll(async () => {
          seed = await seedThreadV2.bumpOpAndViewer(sc)
          await network.processAll()
        })

        type Case = {
          sort: AppBskyUnspeccedGetPostThreadV2.QueryParams['sort']
          postKeys: string[]
        }

        const cases: Case[] = [
          {
            sort: 'newest',
            postKeys: [
              'root',
              '3', // op
              '3.2', // op
              '3.0', // viewer
              '3.4',
              '3.3',
              '3.1',
              '4', // viewer
              '4.2', // op
              '4.3', // viewer
              '4.4',
              '4.1',
              '4.0',
              '2',
              '2.2', // op
              '2.0', // viewer
              '2.4',
              '2.3',
              '2.1',
              '1',
              '1.2', // op
              '1.3', // viewer
              '1.4',
              '1.1',
              '1.0',
              '0',
              '0.4', // op
              '0.3', // viewer
              '0.2',
              '0.1',
              '0.0',
            ],
          },
          {
            sort: 'oldest',
            postKeys: [
              'root',
              '3', // op
              '3.2', // op
              '3.0', // viewer
              '3.1',
              '3.3',
              '3.4',
              '4', // viewer
              '4.2', // op
              '4.3', // viewer
              '4.0',
              '4.1',
              '4.4',
              '0',
              '0.4', // op
              '0.3', // viewer
              '0.0',
              '0.1',
              '0.2',
              '1',
              '1.2', // op
              '1.3', // viewer
              '1.0',
              '1.1',
              '1.4',
              '2',
              '2.2', // op
              '2.0', // viewer
              '2.1',
              '2.3',
              '2.4',
            ],
          },
          {
            sort: 'top',
            postKeys: [
              'root',
              '3', // op
              '3.2', // op
              '3.0', // viewer
              '3.4',
              '3.3',
              '3.1',
              '4', // viewer
              '4.2', // op
              '4.3', // viewer
              '4.1',
              '4.0',
              '4.4',
              '1',
              '1.2', // op
              '1.3', // viewer
              '1.1',
              '1.0',
              '1.4',
              '2',
              '2.2', // op
              '2.0', // viewer
              '2.1',
              '2.4',
              '2.3',
              '0',
              '0.4', // op
              '0.3', // viewer
              '0.2',
              '0.1',
              '0.0',
            ],
          },
        ]

        it.each(cases)(
          'bumps up OP and viewer and sorts by $sort in all levels',
          async ({ sort: sort, postKeys }) => {
            const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
              {
                anchor: seed.root.ref.uriStr,
                sort,
              },
              {
                headers: await network.serviceHeaders(
                  seed.users.viewer.did,
                  ids.AppBskyUnspeccedGetPostThreadV2,
                ),
              },
            )
            const { thread: t, hasOtherReplies } = data

            assertPosts(t)
            expect(hasOtherReplies).toBe(false)
            const tUris = t.map((i) => i.uri)
            const postUris = postKeys.map((k) =>
              k === 'root' ? seed.root.ref.uriStr : seed.r[k].ref.uriStr,
            )
            expect(tUris).toEqual(postUris)
          },
        )
      })

      describe('followers', () => {
        let seed: Awaited<ReturnType<typeof seedThreadV2.bumpFollows>>

        beforeAll(async () => {
          seed = await seedThreadV2.bumpFollows(sc)
          await network.processAll()
        })

        const threadForPostAndViewer = async (post: string, viewer: string) => {
          const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
            {
              anchor: post,
              sort: 'newest',
            },
            {
              headers: await network.serviceHeaders(
                viewer,
                ids.AppBskyUnspeccedGetPostThreadV2,
              ),
            },
          )
          const { thread: t, hasOtherReplies } = data

          assertPosts(t)
          expect(hasOtherReplies).toBe(false)
          return t
        }

        it('bumps up followed users', async () => {
          const t1 = await threadForPostAndViewer(
            seed.root.ref.uriStr,
            seed.users.viewerF.did,
          )
          expect(t1).toEqual([
            expect.objectContaining({ uri: seed.root.ref.uriStr }), // root
            expect.objectContaining({ uri: seed.r['3'].ref.uriStr }), // op reply
            expect.objectContaining({ uri: seed.r['4'].ref.uriStr }), // viewer reply
            expect.objectContaining({ uri: seed.r['1'].ref.uriStr }), // newest followed reply
            expect.objectContaining({ uri: seed.r['0'].ref.uriStr }), // oldest followed reply
            expect.objectContaining({ uri: seed.r['5'].ref.uriStr }), // newest non-followed reply
            expect.objectContaining({ uri: seed.r['2'].ref.uriStr }), // oldest non-followed reply
          ])

          const t2 = await threadForPostAndViewer(
            seed.root.ref.uriStr,
            seed.users.viewerNoF.did,
          )
          expect(t2).toEqual([
            expect.objectContaining({ uri: seed.root.ref.uriStr }), // root
            expect.objectContaining({ uri: seed.r['3'].ref.uriStr }), // op reply
            expect.objectContaining({ uri: seed.r['5'].ref.uriStr }), // viewer reply
            // newest to oldest
            expect.objectContaining({ uri: seed.r['4'].ref.uriStr }),
            expect.objectContaining({ uri: seed.r['2'].ref.uriStr }),
            expect.objectContaining({ uri: seed.r['1'].ref.uriStr }),
            expect.objectContaining({ uri: seed.r['0'].ref.uriStr }),
          ])
        })
      })
    })
  })

  describe(`blocks, deletions, no-unauthenticated`, () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.blockDeletionAuth>>

    beforeAll(async () => {
      seed = await seedThreadV2.blockDeletionAuth(sc, labelerDid)
      await network.processAll()
    })

    describe(`1p blocks`, () => {
      it(`blocked reply is omitted from replies`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `blocked`, who was blocked by `blocker`, author of '0'.
              seed.users.blocked.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        assertPosts(t)
        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({ uri: seed.root.ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3.0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3.0.0'].ref.uriStr }),
        ])
      })

      it(`blocked anchor returns lone blocked view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['0'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `blocked`, who was blocked by `blocker`, author of '0'.
              seed.users.blocked.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemBlocked',
            }),
          }),
        ])
      })

      it(`blocked parent is replaced by blocked view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['0.0'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `blocked`, who was blocked by `blocker`, author of '0'.
              seed.users.blocked.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['0'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemBlocked',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['0.0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
        ])
      })
    })

    describe(`3p blocks`, () => {
      it(`blocked reply is omitted from replies`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `alice` who is a 3rd party between `op` and `opBlocked`.
              seed.users.alice.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: seed.root.ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0.0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3.0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3.0.0'].ref.uriStr }),
        ])
      })

      it(`blocked anchor returns post with blocked parent and non-blocked descendants`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['1'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `alice` who is a 3rd party between `op` and `opBlocked`.
              seed.users.alice.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemBlocked',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['1'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
          // 1.0 is blocked, but 1.1 is not
          expect.objectContaining({
            uri: seed.r['1.1'].ref.uriStr,
            depth: 1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
        ])
      })

      it(`blocked parent is replaced by blocked view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['1.0'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `alice` who is a 3rd party between `op` and `opBlocked`.
              seed.users.alice.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['1'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemBlocked',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['1.0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
        ])
      })

      it(`blocked root is replaced by blocked view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['1.1'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `alice` who is a 3rd party between `op` and `opBlocked`.
              seed.users.alice.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: -2,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemBlocked',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['1'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['1.1'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
        ])
      })
    })

    describe(`deleted posts`, () => {
      it(`deleted reply is omitted from replies`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: seed.root.ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0.0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3.0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3.0.0'].ref.uriStr }),
        ])
      })

      it(`deleted parent is replaced by not found view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['2.0'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['2'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemNotFound',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['2.0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
        ])
      })
    })

    describe('no-unauthenticated', () => {
      it(`no-unauthenticated reply is omitted from replies`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.root.ref.uriStr },
          {
            headers: {
              'atproto-accept-labelers': `${labelerDid}`,
            },
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['0'].ref.uriStr,
            depth: 1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['0.0'].ref.uriStr,
            depth: 2,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
        ])
      })

      it(`no-unauthenticated anchor returns no-unauthenticated view without breaking the parent chain`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['3'].ref.uriStr },
          {
            headers: {
              'atproto-accept-labelers': `${labelerDid}`,
            },
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['3'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemNoUnauthenticated',
            }),
          }),
        ])
      })

      it(`no-unauthenticated parent is replaced by no-unauthenticated view without breaking the parent chain`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['3.0.0'].ref.uriStr },
          {
            headers: {
              'atproto-accept-labelers': `${labelerDid}`,
            },
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: -3,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['3'].ref.uriStr,
            depth: -2,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemNoUnauthenticated',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['3.0'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemNoUnauthenticated',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['3.0.0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.defs#threadItemPost',
            }),
          }),
        ])
      })
    })
  })

  describe(`mutes`, () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.mutes>>

    beforeAll(async () => {
      seed = await seedThreadV2.mutes(sc)
      await network.processAll()
    })

    describe('omitting muted replies', () => {
      it(`muted reply is omitted in top-level replies and in nested replies`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Fetching as `op` mutes `opMuted`.
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(true)
        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            value: expect.objectContaining(props({ opThread: true })),
          }),
          expect.objectContaining({
            uri: seed.r['1'].ref.uriStr,
            value: expect.objectContaining(props()),
          }),
          // 1.0 is a nested muted reply, so it is omitted.
          expect.objectContaining({
            uri: seed.r['1.1'].ref.uriStr,
            value: expect.objectContaining(props()),
          }),
        ])
      })

      it(`top-level muted replies are returned when fetching hidden, sorted by newest`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadOtherV2(
          { anchor: seed.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Fetching as `op` mutes `opMuted`.
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadOtherV2,
            ),
          },
        )
        const { thread: t } = data

        assertHiddenPosts(t)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['0'].ref.uriStr,
            value: expect.objectContaining(
              propsHidden({ mutedByViewer: true }),
            ),
          }),
          // No nested replies for hidden.
        ])
      })
    })

    describe('OP mutes', () => {
      it(`mutes by OP don't mute for 3p`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Fetching as `muter` mutes `muted`.
              seed.users.muter.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(true)
        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            value: expect.objectContaining(props({ opThread: true })),
          }),
          expect.objectContaining({
            uri: seed.r['0'].ref.uriStr,
            value: expect.objectContaining(props()),
          }),
          expect.objectContaining({
            uri: seed.r['0.0'].ref.uriStr,
            value: expect.objectContaining(props()),
          }),
          // 0.1 is a nested muted reply, so it is omitted.
        ])
      })

      it(`fetches hidden replies includes own mutes, not OP mutes, sorted by newest`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadOtherV2(
          { anchor: seed.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Fetching as `muter` mutes `muted`.
              seed.users.muter.did,
              ids.AppBskyUnspeccedGetPostThreadOtherV2,
            ),
          },
        )
        const { thread: t } = data

        assertHiddenPosts(t)
        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['1'].ref.uriStr,
            value: expect.objectContaining(
              propsHidden({ mutedByViewer: true }),
            ),
          }),
          // No nested replies for hidden.
        ])
      })

      it(`mutes by OP don't affect the muted user`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.opMuted.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(false)
        assertPosts(t)
        // No muted posts by `opMuted`, gets the full thread.
        expect(t.length).toBe(1 + Object.keys(seed.r).length) // root + replies
      })
    })
  })

  describe(`threadgated`, () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.threadgated>>

    beforeAll(async () => {
      seed = await seedThreadV2.threadgated(sc)
      await network.processAll()
    })

    it(`threadgated reply is omitted in top-level replies and in nested replies`, async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      expect(hasOtherReplies).toBe(true)
      assertPosts(t)
      expect(t).toEqual([
        expect.objectContaining({
          uri: seed.root.ref.uriStr,
          value: expect.objectContaining(props({ opThread: true })),
        }),
        expect.objectContaining({
          uri: seed.r['2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // OP reply bumped up.
        expect.objectContaining({
          uri: seed.r['2.2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['2.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // 2.1 is a nested hidden reply, so it is omitted.
      ])
    })

    it(`top-level threadgated replies are returned to OP when fetching hidden, sorted by newest`, async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadOtherV2(
        { anchor: seed.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadOtherV2,
          ),
        },
      )
      const { thread: t } = data

      assertHiddenPosts(t)
      expect(t).toEqual([
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining(
            propsHidden({ hiddenByThreadgate: true }),
          ),
        }),
        // No nested replies for hidden.

        // Mutes come after hidden.
        expect.objectContaining({
          uri: seed.r['0'].ref.uriStr,
          value: expect.objectContaining(propsHidden({ mutedByViewer: true })),
        }),
      ])
    })

    it(`author of hidden reply does not see it as hidden`, async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            // `alice` does not get its own reply as hidden.
            seed.users.alice.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      expect(hasOtherReplies).toBe(false)
      assertPosts(t)
      expect(t).toEqual([
        expect.objectContaining({
          uri: seed.root.ref.uriStr,
          value: expect.objectContaining(props({ opThread: true })),
        }),

        // alice does not see its own reply as hidden.
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // OP reply bumped up.
        expect.objectContaining({
          uri: seed.r['1.2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1.1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),

        // `opMuted` is not muted by `alice`.
        expect.objectContaining({
          uri: seed.r['0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),

        expect.objectContaining({
          uri: seed.r['2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // OP reply bumped up.
        expect.objectContaining({
          uri: seed.r['2.2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['2.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // 2.1 is a nested hidden reply, so it is omitted.
      ])
    })

    it(`other viewers are affected by threadgate-hidden replies by OP`, async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            // `viewer` also gets the replies as hidden.
            seed.users.viewer.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t, hasOtherReplies } = data

      expect(hasOtherReplies).toBe(true)
      assertPosts(t)
      expect(t).toEqual([
        expect.objectContaining({
          uri: seed.root.ref.uriStr,
          value: expect.objectContaining(props({ opThread: true })),
        }),
        // `opMuted` doesn't see itself as muted, just `op` does.
        expect.objectContaining({
          uri: seed.r['0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),

        expect.objectContaining({
          uri: seed.r['2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // OP reply bumped up.
        expect.objectContaining({
          uri: seed.r['2.2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['2.0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // 2.1 is a nested hidden reply, so it is omitted.
      ])
    })

    it(`top-level threadgated replies are returned to other viewers when fetching hidden, sorted by newest`, async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadOtherV2(
        { anchor: seed.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            // `viewer` also gets the replies as hidden.
            seed.users.viewer.did,
            ids.AppBskyUnspeccedGetPostThreadOtherV2,
          ),
        },
      )
      const { thread: t } = data

      assertHiddenPosts(t)
      expect(t).toEqual([
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining(
            propsHidden({ hiddenByThreadgate: true }),
          ),
        }),
        // No nested replies for hidden.
      ])
    })
  })

  describe('tags', () => {
    let seed: Awaited<ReturnType<typeof seedThreadV2.tags>>

    beforeAll(async () => {
      seed = await seedThreadV2.tags(sc)
      await network.processAll()
    })

    describe('when prioritizing followed users', () => {
      it('considers tags for bumping down and hiding', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: seed.root.ref.uriStr,
            sort: 'newest',
          },
          {
            headers: await network.serviceHeaders(
              seed.users.viewer.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t, hasOtherReplies } = data

        expect(hasOtherReplies).toBe(true)
        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: seed.root.ref.uriStr }),
          // OP (down overridden).
          expect.objectContaining({ uri: seed.r['3'].ref.uriStr }),
          // Viewer (hide overridden).
          expect.objectContaining({ uri: seed.r['4'].ref.uriStr }),
          // Following (hide overridden).
          expect.objectContaining({ uri: seed.r['5'].ref.uriStr }),
          // Fot following.
          expect.objectContaining({ uri: seed.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0.0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0.1'].ref.uriStr }),
          // Down.
          expect.objectContaining({ uri: seed.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['1.0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['1.1'].ref.uriStr }),
        ])
      })

      it('finds the hidden by tag', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadOtherV2(
          {
            anchor: seed.root.ref.uriStr,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.viewer.did,
              ids.AppBskyUnspeccedGetPostThreadOtherV2,
            ),
          },
        )
        const { thread: t } = data

        assertHiddenPosts(t)
        expect(t).toEqual([
          // Hide.
          expect.objectContaining({ uri: seed.r['2'].ref.uriStr }),
        ])
      })
    })
  })
})

function assertPosts(
  t: AppBskyUnspeccedGetPostThreadV2.OutputSchema['thread'],
): asserts t is ThreadItemValuePost[] {
  t.forEach((i) => {
    assert(
      AppBskyUnspeccedDefs.isThreadItemPost(i.value),
      `Expected thread item to have a post as value`,
    )
  })
}

function assertHiddenPosts(
  t: AppBskyUnspeccedGetPostThreadOtherV2.OutputSchema['thread'],
): asserts t is ThreadOtherItemValuePost[] {
  t.forEach((i) => {
    assert(
      AppBskyUnspeccedDefs.isThreadItemPost(i.value),
      `Expected thread item to have a hidden post as value`,
    )
  })
}
