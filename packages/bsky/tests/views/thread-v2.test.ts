import assert from 'node:assert'
import { AppBskyUnspeccedGetPostThreadV2, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import {
  OutputSchema,
  QueryParams,
  ThreadItemPost,
} from '../../src/lexicon/types/app/bsky/unspecced/getPostThreadV2'
import { ThreadItemValuePost } from '../../src/views/threadsV2'
import { forSnapshot } from '../_util'
import * as seeds from '../seed/thread-v2'

type PostProps = Pick<
  ThreadItemPost,
  'moreReplies' | 'hiddenByThreadgate' | 'mutedByViewer' | 'opThread'
>

const props = (overrides: Partial<PostProps> = {}): PostProps => ({
  moreReplies: 0,
  hiddenByThreadgate: false,
  mutedByViewer: false,
  opThread: false,
  ...overrides,
})

describe('appview thread views v2', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let labelerDid: string
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_thread_v_two',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    labelerDid = network.bsky.ctx.cfg.modServiceDid
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('not found anchor', () => {
    it('returns not found error', async () => {
      await expect(
        agent.app.bsky.unspecced.getPostThreadV2({
          anchor: 'at://did:plc:123/app.bsky.feed.post/456',
        }),
      ).rejects.toThrow(AppBskyUnspeccedGetPostThreadV2.NotFoundError)
    })
  })

  describe('simple thread', () => {
    let seed: Awaited<ReturnType<typeof seeds.simple>>

    beforeAll(async () => {
      seed = await seeds.simple(sc)
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
      const { thread: t } = data

      assertPosts(t)
      expect(t).toEqual([
        expect.objectContaining({ depth: 0, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['0'].ref.uriStr }),
        expect.objectContaining({ depth: 2, uri: seed.r['0_0'].ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['1'].ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['2'].ref.uriStr }),
        expect.objectContaining({ depth: 2, uri: seed.r['2_0'].ref.uriStr }),
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
      const { thread: t } = data

      assertPosts(t)
      expect(t).toEqual([
        expect.objectContaining({ depth: -1, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['0'].ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['0_0'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on r 0_0', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.r['0_0'].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t } = data

      assertPosts(t)
      expect(t).toEqual([
        expect.objectContaining({ depth: -2, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: -1, uri: seed.r['0'].ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['0_0'].ref.uriStr }),
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
      const { thread: t } = data

      assertPosts(t)
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
      const { thread: t } = data

      assertPosts(t)
      expect(t).toEqual([
        expect.objectContaining({ depth: -1, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['2'].ref.uriStr }),
        expect.objectContaining({ depth: 1, uri: seed.r['2_0'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on 2_0', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.r['2_0'].ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t } = data

      assertPosts(t)
      expect(t).toEqual([
        expect.objectContaining({ depth: -2, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: -1, uri: seed.r['2'].ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['2_0'].ref.uriStr }),
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
      const { thread: t } = data

      assertPosts(t)
      expect(t).toEqual([
        expect.objectContaining({ depth: -1, uri: seed.root.ref.uriStr }),
        expect.objectContaining({ depth: 0, uri: seed.r['3'].ref.uriStr }),
      ])
      expect(forSnapshot(data)).toMatchSnapshot()
    })
  })

  describe('long thread', () => {
    let seed: Awaited<ReturnType<typeof seeds.long>>

    beforeAll(async () => {
      seed = await seeds.long(sc)
      await network.processAll()
    })

    describe('calculating depth', () => {
      type Case = {
        postKey: string
      }

      const cases: Case[] = [
        { postKey: 'root' },
        { postKey: '0' },
        { postKey: '0_0' },
        { postKey: '0_0_0' },
        { postKey: '0_0_0_0' },
        { postKey: '0_0_0_0_0' },
        { postKey: '0_0_1' },
        { postKey: '1' },
        { postKey: '2' },
        { postKey: '3' },
        { postKey: '4' },
        { postKey: '4_0' },
        { postKey: '4_0_0' },
        { postKey: '4_0_0_0' },
        { postKey: '4_0_0_0_0' },
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
          const { thread: t } = data

          assertPosts(t)
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
    let seed: Awaited<ReturnType<typeof seeds.deep>>
    let simple: Awaited<ReturnType<typeof seeds.simple>>

    beforeAll(async () => {
      seed = await seeds.deep(sc)
      simple = await seeds.simple(sc, 'simple2')
      await network.processAll()
    })

    describe('above', () => {
      it('limits to the above count', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: seed.r['0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0'].ref.uriStr,
            above: 10,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
        expect(t).toHaveLength(11)

        const last = t.at(-1)
        expect(last!.uri).toBe(
          seed.r['0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0'].ref.uriStr,
        )
      })

      it(`does not fulfill the above count if there are not enough items in the thread`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: simple.r['0_0'].ref.uriStr,
            above: 10,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
        expect(t).toHaveLength(3)
        const last = t.at(-1)
        expect(last!.uri).toBe(simple.r['0_0'].ref.uriStr)
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
        const { thread: t } = data

        assertPosts(t)
        expect(t).toHaveLength(11)
        const first = t.at(0)
        expect(first!.uri).toBe(seed.root.ref.uriStr)
      })

      it(`does not fulfill the below count if there are not enough items in the thread`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: simple.root.ref.uriStr,
            below: 10,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
        expect(t).toHaveLength(7)

        const first = t.at(0)
        expect(first!.uri).toBe(simple.root.ref.uriStr)
      })
    })
  })

  describe('branching factor', () => {
    let seed: Awaited<ReturnType<typeof seeds.branchingFactor>>

    beforeAll(async () => {
      seed = await seeds.branchingFactor(sc)
      await network.processAll()
    })

    type Case =
      | {
          branchingFactor: number
          sorting: QueryParams['sorting']
          postKeys: string[]
        }
      | {
          branchingFactor: number
          sorting: QueryParams['sorting']
          // For higher branching factors it gets too verbose to write all posts.
          length: number
        }
    const cases: Case[] = [
      {
        branchingFactor: 1,
        sorting: 'app.bsky.unspecced.getPostThreadV2#oldest',
        postKeys: [
          'root',
          '0',
          '0_0',
          '0_0_0',
          '1',
          '1_0',
          '1_0_0',
          '2',
          '2_0',
          '2_0_0',
          '3',
          '3_0',
          '3_0_0',
        ],
      },
      {
        branchingFactor: 1,
        sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
        postKeys: [
          'root',
          '3',
          '3_3',
          '3_3_3',
          '2',
          '2_3',
          '2_3_3',
          '1',
          '1_3',
          '1_3_3',
          '0',
          '0_3',
          '0_3_3',
        ],
      },
      {
        branchingFactor: 2,
        sorting: 'app.bsky.unspecced.getPostThreadV2#oldest',
        postKeys: [
          'root',
          '0',
          '0_0',
          '0_0_0',
          '0_0_1',
          '0_1',
          '0_1_0',
          '0_1_1',
          '1',
          '1_0',
          '1_0_0',
          '1_1',
          '1_1_0',
          '1_1_1',
          '2',
          '2_0',
          '2_0_0',
          '2_0_1',
          '2_1',
          '2_1_0',
          '2_1_1',
          '3',
          '3_0',
          '3_0_0',
          '3_0_1',
          '3_1',
          '3_1_0',
          '3_1_1',
        ],
      },
      {
        branchingFactor: 2,
        sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
        postKeys: [
          'root',
          '3',
          '3_3',
          '3_3_3',
          '3_3_2',
          '3_2',
          '3_2_3',
          '3_2_2',
          '2',
          '2_3',
          '2_3_3',
          '2_3_2',
          '2_2',
          '2_2_3',
          '2_2_2',
          '1',
          '1_3',
          '1_3_3',
          '1_3_2',
          '1_2',
          '1_2_3',
          '1_2_2',
          '0',
          '0_3',
          '0_3_3',
          '0_3_2',
          '0_2',
          '0_2_3',
          '0_2_2',
        ],
      },
      {
        branchingFactor: 3,
        sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
        length: 53,
      },
      {
        branchingFactor: 4,
        sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
        length: 82,
      },
      {
        branchingFactor: 5,
        sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
        // The seeds have 1 post with 5 replies, so it is +1 compared to branchingFactor 4.
        length: 83,
      },
    ]

    it.each(cases)(
      'returns all top-level replies and limits nested to branching factor of $branchingFactor when sorting by $sorting',
      async (args) => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            anchor: seed.root.ref.uriStr,
            sorting: 'sorting' in args ? args.sorting : undefined,
            branchingFactor: args.branchingFactor,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
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
    let seed: Awaited<ReturnType<typeof seeds.annotateMoreReplies>>

    beforeAll(async () => {
      seed = await seeds.annotateMoreReplies(sc)
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
      const { thread: t } = data

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
          uri: seed.r['0_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0_0_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0_0_0_0'].ref.uriStr,
          value: expect.objectContaining(props({ moreReplies: 5 })),
        }),
        expect.objectContaining({
          uri: seed.r['0_1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0_1_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0_1_0_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining(props({ moreReplies: 1 })),
        }),
        expect.objectContaining({
          uri: seed.r['1_0'].ref.uriStr,
          value: expect.objectContaining(props({ moreReplies: 3 })),
        }),
        expect.objectContaining({
          uri: seed.r['1_0_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_0_1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_1_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_1_1'].ref.uriStr,
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
    let seed: Awaited<ReturnType<typeof seeds.annotateOP>>

    beforeAll(async () => {
      seed = await seeds.annotateOP(sc)
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
        opThreadPostKeys: ['root', '0', '0_0', '0_0_0', '2'],
      },
      {
        postKey: '0',
        length: 4,
        opThreadPostKeys: ['root', '0', '0_0', '0_0_0'],
      },
      {
        postKey: '0_0',
        length: 4,
        opThreadPostKeys: ['root', '0', '0_0', '0_0_0'],
      },
      {
        postKey: '0_0_0',
        length: 4,
        opThreadPostKeys: ['root', '0', '0_0', '0_0_0'],
      },
      {
        postKey: '1',
        length: 3,
        opThreadPostKeys: ['root'],
      },
      {
        postKey: '1_0',
        length: 3,
        opThreadPostKeys: ['root'],
      },
      {
        postKey: '2',
        length: 4,
        opThreadPostKeys: ['root', '2'],
      },
      {
        postKey: '2_0',
        length: 4,
        opThreadPostKeys: ['root', '2'],
      },
      {
        postKey: '2_0_0',
        length: 4,
        opThreadPostKeys: ['root', '2'],
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
        const { thread: t } = data

        assertPosts(t)
        const opThreadPostsUris = new Set(
          opThreadPosts.map((k) =>
            k === 'root' ? seed.root.ref.uriStr : seed.r[k].ref.uriStr,
          ),
        )

        expect(t).toHaveLength(length)
        t.forEach((i) => {
          expect(i.value.opThread).toBe(opThreadPostsUris.has(i.uri))
        })
      },
    )
  })

  describe('bumping and sorting', () => {
    describe('sorting', () => {
      let seed: Awaited<ReturnType<typeof seeds.sort>>

      beforeAll(async () => {
        seed = await seeds.sort(sc)
        await network.processAll()
      })

      type Case = {
        sorting: QueryParams['sorting']
        postKeys: string[]
      }

      const cases: Case[] = [
        {
          sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
          postKeys: [
            'root',
            '2',
            '2_2',
            '2_1',
            '2_0',
            '1',
            '1_2',
            '1_1',
            '1_0',
            '0',
            '0_2',
            '0_1',
            '0_0',
          ],
        },
        {
          sorting: 'app.bsky.unspecced.getPostThreadV2#oldest',
          postKeys: [
            'root',
            '0',
            '0_0',
            '0_1',
            '0_2',
            '1',
            '1_0',
            '1_1',
            '1_2',
            '2',
            '2_0',
            '2_1',
            '2_2',
          ],
        },
        {
          sorting: 'app.bsky.unspecced.getPostThreadV2#top',
          postKeys: [
            'root',
            '1',
            '1_1',
            '1_0',
            '1_2',
            '2',
            '2_0',
            '2_1',
            '2_2',
            '0',
            '0_2',
            '0_1',
            '0_0',
          ],
        },
      ]

      it.each(cases)(
        'sorts by $sorting in all levels',
        async ({ sorting, postKeys }) => {
          const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
            {
              anchor: seed.root.ref.uriStr,
              sorting,
            },
            {
              headers: await network.serviceHeaders(
                seed.users.op.did,
                ids.AppBskyUnspeccedGetPostThreadV2,
              ),
            },
          )
          const { thread: t } = data

          assertPosts(t)
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
        let seed: Awaited<ReturnType<typeof seeds.bumpGroupSorting>>

        beforeAll(async () => {
          seed = await seeds.bumpGroupSorting(sc)
          await network.processAll()
        })

        type Case = {
          sorting: QueryParams['sorting']
          postKeys: string[]
        }

        const cases: Case[] = [
          {
            sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
            postKeys: ['root', '5', '3', '1', '7', '4', '0', '6', '2'],
          },
          {
            sorting: 'app.bsky.unspecced.getPostThreadV2#oldest',
            postKeys: ['root', '1', '3', '5', '0', '4', '7', '2', '6'],
          },
        ]

        it.each(cases)(
          'sorts by $sorting inside each bumped group',
          async ({ sorting, postKeys }) => {
            const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
              {
                anchor: seed.root.ref.uriStr,
                sorting,
              },
              {
                headers: await network.serviceHeaders(
                  seed.users.viewer.did,
                  ids.AppBskyUnspeccedGetPostThreadV2,
                ),
              },
            )
            const { thread: t } = data

            assertPosts(t)
            const tUris = t.map((i) => i.uri)
            const postUris = postKeys.map((k) =>
              k === 'root' ? seed.root.ref.uriStr : seed.r[k].ref.uriStr,
            )
            expect(tUris).toEqual(postUris)
          },
        )
      })

      describe('OP and viewer', () => {
        let seed: Awaited<ReturnType<typeof seeds.bumpOpAndViewer>>

        beforeAll(async () => {
          seed = await seeds.bumpOpAndViewer(sc)
          await network.processAll()
        })

        type Case = {
          sorting: QueryParams['sorting']
          postKeys: string[]
        }

        const cases: Case[] = [
          {
            sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
            postKeys: [
              'root',
              '3', // op
              '3_2', // op
              '3_0', // viewer
              '3_4',
              '3_3',
              '3_1',
              '4', // viewer
              '4_2', // op
              '4_3', // viewer
              '4_4',
              '4_1',
              '4_0',
              '2',
              '2_2', // op
              '2_0', // viewer
              '2_4',
              '2_3',
              '2_1',
              '1',
              '1_2', // op
              '1_3', // viewer
              '1_4',
              '1_1',
              '1_0',
              '0',
              '0_4', // op
              '0_3', // viewer
              '0_2',
              '0_1',
              '0_0',
            ],
          },
          {
            sorting: 'app.bsky.unspecced.getPostThreadV2#oldest',
            postKeys: [
              'root',
              '3', // op
              '3_2', // op
              '3_0', // viewer
              '3_1',
              '3_3',
              '3_4',
              '4', // viewer
              '4_2', // op
              '4_3', // viewer
              '4_0',
              '4_1',
              '4_4',
              '0',
              '0_4', // op
              '0_3', // viewer
              '0_0',
              '0_1',
              '0_2',
              '1',
              '1_2', // op
              '1_3', // viewer
              '1_0',
              '1_1',
              '1_4',
              '2',
              '2_2', // op
              '2_0', // viewer
              '2_1',
              '2_3',
              '2_4',
            ],
          },
          {
            sorting: 'app.bsky.unspecced.getPostThreadV2#top',
            postKeys: [
              'root',
              '3', // op
              '3_2', // op
              '3_0', // viewer
              '3_4',
              '3_3',
              '3_1',
              '4', // viewer
              '4_2', // op
              '4_3', // viewer
              '4_1',
              '4_0',
              '4_4',
              '1',
              '1_2', // op
              '1_3', // viewer
              '1_1',
              '1_0',
              '1_4',
              '2',
              '2_2', // op
              '2_0', // viewer
              '2_1',
              '2_4',
              '2_3',
              '0',
              '0_4', // op
              '0_3', // viewer
              '0_2',
              '0_1',
              '0_0',
            ],
          },
        ]

        it.each(cases)(
          'bumps up OP and viewer and sorts by $sorting in all levels',
          async ({ sorting, postKeys }) => {
            const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
              {
                anchor: seed.root.ref.uriStr,
                sorting,
              },
              {
                headers: await network.serviceHeaders(
                  seed.users.viewer.did,
                  ids.AppBskyUnspeccedGetPostThreadV2,
                ),
              },
            )
            const { thread: t } = data

            assertPosts(t)
            const tUris = t.map((i) => i.uri)
            const postUris = postKeys.map((k) =>
              k === 'root' ? seed.root.ref.uriStr : seed.r[k].ref.uriStr,
            )
            expect(tUris).toEqual(postUris)
          },
        )
      })

      describe('followers', () => {
        let seed: Awaited<ReturnType<typeof seeds.bumpFollows>>

        beforeAll(async () => {
          seed = await seeds.bumpFollows(sc)
          await network.processAll()
        })

        const threadForPostAndViewer = async (
          post: string,
          viewer: string,
          prioritizeFollowedUsers: boolean = false,
        ) => {
          const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
            {
              anchor: post,
              sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
              prioritizeFollowedUsers,
            },
            {
              headers: await network.serviceHeaders(
                viewer,
                ids.AppBskyUnspeccedGetPostThreadV2,
              ),
            },
          )
          const { thread: t } = data
          assertPosts(t)
          return t
        }

        it('bumps up followed users if option is set', async () => {
          const prioritizeFollowedUsers = true

          const t1 = await threadForPostAndViewer(
            seed.root.ref.uriStr,
            seed.users.viewerF.did,
            prioritizeFollowedUsers,
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
            prioritizeFollowedUsers,
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

        it('does not prioritize followed users if option is not set', async () => {
          const t1 = await threadForPostAndViewer(
            seed.root.ref.uriStr,
            seed.users.viewerF.did,
          )
          expect(t1).toHaveLength(7)
          expect(t1[0].uri).toBe(seed.root.ref.uriStr) // root
          expect(t1[1].uri).toBe(seed.r['3'].ref.uriStr) // op reply
          expect(t1[2].uri).toBe(seed.r['4'].ref.uriStr) // viewer reply
          // newest to oldest
          expect(t1[3].uri).toBe(seed.r['5'].ref.uriStr)
          expect(t1[4].uri).toBe(seed.r['2'].ref.uriStr)
          expect(t1[5].uri).toBe(seed.r['1'].ref.uriStr)
          expect(t1[6].uri).toBe(seed.r['0'].ref.uriStr)

          const t2 = await threadForPostAndViewer(
            seed.root.ref.uriStr,
            seed.users.viewerNoF.did,
          )
          expect(t2).toHaveLength(7)
          expect(t2[0].uri).toBe(seed.root.ref.uriStr) // root
          expect(t2[1].uri).toBe(seed.r['3'].ref.uriStr) // op reply
          expect(t2[2].uri).toBe(seed.r['5'].ref.uriStr) // viewer reply
          // newest to oldest
          expect(t2[3].uri).toBe(seed.r['4'].ref.uriStr)
          expect(t2[4].uri).toBe(seed.r['2'].ref.uriStr)
          expect(t2[5].uri).toBe(seed.r['1'].ref.uriStr)
          expect(t2[6].uri).toBe(seed.r['0'].ref.uriStr)
        })
      })

      describe('mutes', () => {
        let seed: Awaited<ReturnType<typeof seeds.bumpMutes>>

        beforeAll(async () => {
          seed = await seeds.bumpMutes(sc)
          await network.processAll()
        })

        it('sorts multiple mutes correctly by the sorting param', async () => {
          const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
            {
              anchor: seed.root.ref.uriStr,
              sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
            },
            {
              headers: await network.serviceHeaders(
                seed.users.op.did,
                ids.AppBskyUnspeccedGetPostThreadV2,
              ),
            },
          )
          const { thread: t } = data

          assertPosts(t)
          expect(t).toEqual([
            expect.objectContaining({
              uri: seed.root.ref.uriStr,
              value: expect.objectContaining(props({ opThread: true })),
            }),
            expect.objectContaining({
              uri: seed.r['5'].ref.uriStr,
              value: expect.objectContaining(props({ opThread: true })),
            }),
            expect.objectContaining({
              uri: seed.r['2'].ref.uriStr,
              value: expect.objectContaining(props({ opThread: true })),
            }),
            expect.objectContaining({
              uri: seed.r['1'].ref.uriStr,
              value: expect.objectContaining(props()),
            }),
            // Pushed down because it is `📌`.
            expect.objectContaining({
              uri: seed.r['3'].ref.uriStr,
              value: expect.objectContaining(props()),
            }),
            expect.objectContaining({
              uri: seed.r['6'].ref.uriStr,
              value: expect.objectContaining(props({ mutedByViewer: true })),
            }),
            expect.objectContaining({
              uri: seed.r['4'].ref.uriStr,
              value: expect.objectContaining(props({ mutedByViewer: true })),
            }),
            expect.objectContaining({
              uri: seed.r['0'].ref.uriStr,
              value: expect.objectContaining(props({ mutedByViewer: true })),
            }),
          ])
        })
      })
    })
  })

  describe(`blocks, deletions, no-unauthenticated`, () => {
    let seed: Awaited<ReturnType<typeof seeds.blockDeletionAuth>>

    beforeAll(async () => {
      seed = await seeds.blockDeletionAuth(sc)
      await createLabel({
        src: labelerDid,
        uri: seed.users.auth.did,
        cid: '',
        val: '!no-unauthenticated',
      })
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
        const { thread: t } = data

        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: seed.root.ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3_0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3_0_0'].ref.uriStr }),
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
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemBlocked',
            }),
          }),
        ])
      })

      it(`blocked parent is replaced by blocked view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['0_0'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `blocked`, who was blocked by `blocker`, author of '0'.
              seed.users.blocked.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['0'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemBlocked',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['0_0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
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
        const { thread: t } = data

        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: seed.root.ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0_0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3_0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3_0_0'].ref.uriStr }),
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
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemBlocked',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['1'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
            }),
          }),
          // 1_0 is blocked, but 1_1 is not
          expect.objectContaining({
            uri: seed.r['1_1'].ref.uriStr,
            depth: 1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
            }),
          }),
        ])
      })

      it(`blocked parent is replaced by blocked view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['1_0'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `alice` who is a 3rd party between `op` and `opBlocked`.
              seed.users.alice.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['1'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemBlocked',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['1_0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
            }),
          }),
        ])
      })

      it(`blocked root is replaced by blocked view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['1_1'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `alice` who is a 3rd party between `op` and `opBlocked`.
              seed.users.alice.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: -2,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemBlocked',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['1'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['1_1'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
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
        const { thread: t } = data

        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: seed.root.ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['0_0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3_0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['3_0_0'].ref.uriStr }),
        ])
      })

      it(`deleted parent is replaced by not found view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['2_0'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.r['2'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemNotFound',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['2_0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
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
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['0'].ref.uriStr,
            depth: 1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['0_0'].ref.uriStr,
            depth: 2,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
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
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['3'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type:
                'app.bsky.unspecced.getPostThreadV2#threadItemNoUnauthenticated',
            }),
          }),
        ])
      })

      it(`no-unauthenticated parent is replaced by no-unauthenticated view without breaking the parent chain`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { anchor: seed.r['3_0_0'].ref.uriStr },
          {
            headers: {
              'atproto-accept-labelers': `${labelerDid}`,
            },
          },
        )
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            uri: seed.root.ref.uriStr,
            depth: -3,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['3'].ref.uriStr,
            depth: -2,
            value: expect.objectContaining({
              $type:
                'app.bsky.unspecced.getPostThreadV2#threadItemNoUnauthenticated',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['3_0'].ref.uriStr,
            depth: -1,
            value: expect.objectContaining({
              $type:
                'app.bsky.unspecced.getPostThreadV2#threadItemNoUnauthenticated',
            }),
          }),
          expect.objectContaining({
            uri: seed.r['3_0_0'].ref.uriStr,
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemPost',
            }),
          }),
        ])
      })
    })
  })

  describe(`mutes`, () => {
    let seed: Awaited<ReturnType<typeof seeds.mutes>>

    beforeAll(async () => {
      seed = await seeds.mutes(sc)
      await network.processAll()
    })

    it(`muted reply is set as muted in top-level replies and omitted in nested replies`, async () => {
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
      const { thread: t } = data

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
        // 1_0 is a nested muted reply, so it is omitted.
        expect.objectContaining({
          uri: seed.r['1_1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // 0 is muted but is an anchor reply, so it is not omitted but bumped down.
        expect.objectContaining({
          uri: seed.r['0'].ref.uriStr,
          value: expect.objectContaining(props({ mutedByViewer: true })),
        }),
        // 0's replies are not omitted nor marked as muted.
        expect.objectContaining({
          uri: seed.r['0_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['0_1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
      ])
    })

    it(`mutes by OP don't have 3p effects`, async () => {
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
      const { thread: t } = data

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
          uri: seed.r['0_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // 0_1 is a nested muted reply, so it is omitted.

        // 1 is muted but is an anchor reply, so it is not omitted but bumped down.
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining(props({ mutedByViewer: true })),
        }),
        // 1's replies are not omitted nor marked as muted.
        expect.objectContaining({
          uri: seed.r['1_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
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
      const { thread: t } = data

      assertPosts(t)
      // No muted posts by `opMuted`, gets the full thread.
      expect(t.length).toBe(1 + Object.keys(seed.r).length) // root + replies
    })
  })

  describe(`hidden`, () => {
    let seed: Awaited<ReturnType<typeof seeds.hidden>>

    beforeAll(async () => {
      seed = await seeds.hidden(sc)
      await network.processAll()
    })

    it(`hidden reply is set as hidden in top-level replies and omitted in nested replies`, async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { anchor: seed.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyUnspeccedGetPostThreadV2,
          ),
        },
      )
      const { thread: t } = data

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
          uri: seed.r['2_2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['2_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // 2_1 is a nested hidden reply, so it is omitted.

        // 1 is hidden but is an anchor reply, so it is not omitted but bumped down.
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining(props({ hiddenByThreadgate: true })),
        }),
        // 1's replies are not omitted nor marked as hidden.
        // OP reply bumped up.
        expect.objectContaining({
          uri: seed.r['1_2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),

        // Mutes come after hidden.
        expect.objectContaining({
          uri: seed.r['0'].ref.uriStr,
          value: expect.objectContaining(props({ mutedByViewer: true })),
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
      const { thread: t } = data

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
          uri: seed.r['1_2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_1'].ref.uriStr,
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
          uri: seed.r['2_2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['2_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // 2_1 is a nested hidden reply, so it is omitted.
      ])
    })

    it(`other viewers are affected by hidden replies by OP`, async () => {
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
      const { thread: t } = data

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
          uri: seed.r['2_2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['2_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        // 2_1 is a nested hidden reply, so it is omitted.

        // 1 is hidden but is an anchor reply, so it is not omitted but bumped down.
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining(props({ hiddenByThreadgate: true })),
        }),
        // 1's replies are not omitted nor marked as hidden.
        // OP reply bumped up.
        expect.objectContaining({
          uri: seed.r['1_2'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_0'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
        expect.objectContaining({
          uri: seed.r['1_1'].ref.uriStr,
          value: expect.objectContaining(props()),
        }),
      ])
    })
  })

  const createLabel = async (opts: {
    src?: string
    uri: string
    cid: string
    val: string
    exp?: string
  }) => {
    await network.bsky.db.db
      .insertInto('label')
      .values({
        uri: opts.uri,
        cid: opts.cid,
        val: opts.val,
        cts: new Date().toISOString(),
        exp: opts.exp ?? null,
        neg: false,
        src: opts.src ?? labelerDid,
      })
      .execute()
  }
})

function assertPosts(
  t: OutputSchema['thread'],
): asserts t is ThreadItemValuePost[] {
  t.forEach((i) => {
    assert(
      AppBskyUnspeccedGetPostThreadV2.isThreadItemPost(i.value),
      `Expected thread item to have a post as value`,
    )
  })
}
