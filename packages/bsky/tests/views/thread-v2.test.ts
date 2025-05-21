import assert from 'node:assert'
import { AppBskyUnspeccedGetPostThreadV2, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import {
  OutputSchema,
  QueryParams,
} from '../../src/lexicon/types/app/bsky/unspecced/getPostThreadV2'
import { ThreadItemValuePost } from '../../src/views/threadsV2'
import { forSnapshot } from '../_util'
import * as seeds from '../seed/thread-v2'

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

  describe('simple thread', () => {
    let seed: Awaited<ReturnType<typeof seeds.simple>>

    beforeAll(async () => {
      seed = await seeds.simple(sc)
      await network.processAll()
    })

    it('returns thread anchored on root', async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { uri: seed.root.ref.uriStr },
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
        { uri: seed.r['0'].ref.uriStr },
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
        { uri: seed.r['0_0'].ref.uriStr },
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
        { uri: seed.r['1'].ref.uriStr },
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
        { uri: seed.r['2'].ref.uriStr },
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
        { uri: seed.r['2_0'].ref.uriStr },
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
        { uri: seed.r['3'].ref.uriStr },
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
            { uri: post.ref.uriStr },
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
            uri: seed.r['0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0'].ref.uriStr,
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
            uri: simple.r['0_0'].ref.uriStr,
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
            uri: seed.root.ref.uriStr,
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
            uri: simple.root.ref.uriStr,
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
    let seed: Awaited<ReturnType<typeof seeds.nestedBranchingFactor>>

    beforeAll(async () => {
      seed = await seeds.nestedBranchingFactor(sc)
      await network.processAll()
    })

    type Case =
      | {
          nestedBranchingFactor: number
          sorting: QueryParams['sorting']
          postKeys: string[]
        }
      | {
          nestedBranchingFactor: number
          sorting: QueryParams['sorting']
          // For higher branching factors it gets too verbose to write all posts.
          length: number
        }
    const cases: Case[] = [
      {
        nestedBranchingFactor: 1,
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
        nestedBranchingFactor: 1,
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
        nestedBranchingFactor: 2,
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
        nestedBranchingFactor: 2,
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
        nestedBranchingFactor: 3,
        sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
        length: 53,
      },
      {
        nestedBranchingFactor: 4,
        sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
        length: 82,
      },
      {
        nestedBranchingFactor: 5,
        sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
        // The seeds have 1 post with 5 replies, so it is +1 compared to nestedBranchingFactor 4.
        length: 83,
      },
    ]

    it.each(cases)(
      'returns all top-level replies and limits nested to branching factor of $nestedBranchingFactor when sorting by $sorting',
      async (args) => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: seed.root.ref.uriStr,
            sorting: 'sorting' in args ? args.sorting : undefined,
            nestedBranchingFactor: args.nestedBranchingFactor,
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
          { uri: post.ref.uriStr },
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
          expect(i.value.isOPThread).toBe(opThreadPostsUris.has(i.uri))
        })
      },
    )
  })

  describe(`sorting`, () => {
    let s1: Awaited<ReturnType<typeof seeds.sortingNoOpOrViewer>>
    let s2: Awaited<ReturnType<typeof seeds.sortingWithOpAndViewer>>
    let s3: Awaited<ReturnType<typeof seeds.sortingWithFollows>>

    beforeAll(async () => {
      s1 = await seeds.sortingNoOpOrViewer(sc)
      s2 = await seeds.sortingWithOpAndViewer(sc)
      s3 = await seeds.sortingWithFollows(sc)
      await network.processAll()
    })

    describe('newest', () => {
      it('sorts in all levels for the case without viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: s1.root.ref.uriStr,
            sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
          },
          {
            headers: await network.serviceHeaders(
              s1.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: s1.root.ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2_2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2_0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1_2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1_0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_0'].ref.uriStr }),
        ])
      })

      it('sorts in all levels for the case with viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: s2.root.ref.uriStr,
            sorting: 'app.bsky.unspecced.getPostThreadV2#newest',
          },
          {
            headers: await network.serviceHeaders(
              s2.users.viewer.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: s2.root.ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_0'].ref.uriStr }),
        ])
      })
    })

    describe('oldest', () => {
      it('sorts in all levels for the case without viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: s1.root.ref.uriStr,
            sorting: 'app.bsky.unspecced.getPostThreadV2#oldest',
          },
          {
            headers: await network.serviceHeaders(
              s1.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: s1.root.ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1_0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1_2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2_0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2_2'].ref.uriStr }),
        ])
      })

      it('sorts in all levels for the case with viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: s2.root.ref.uriStr,
            sorting: 'app.bsky.unspecced.getPostThreadV2#oldest',
          },
          {
            headers: await network.serviceHeaders(
              s2.users.viewer.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: s2.root.ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_4'].ref.uriStr }),
        ])
      })
    })

    describe('top', () => {
      it('sorts in all levels for the case without viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: s1.root.ref.uriStr,
            sorting: 'app.bsky.unspecced.getPostThreadV2#top',
          },
          {
            headers: await network.serviceHeaders(
              s1.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: s1.root.ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1_0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['1_2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2_0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['2_2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_0'].ref.uriStr }),
        ])
      })

      it('sorts in all levels for the case with viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: s2.root.ref.uriStr,
            sorting: 'app.bsky.unspecced.getPostThreadV2#top',
          },
          {
            headers: await network.serviceHeaders(
              s2.users.viewer.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        assertPosts(t)
        expect(t).toEqual([
          expect.objectContaining({ uri: s2.root.ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['3_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['4_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_0'].ref.uriStr }),
        ])
      })
    })

    describe('followers', () => {
      const threadForPostAndViewer = async (
        post: string,
        viewer: string,
        prioritizeFollowedUsers: boolean = false,
      ) => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: post,
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

      it('prioritizes followed users if option is set', async () => {
        const prioritizeFollowedUsers = true

        const t1 = await threadForPostAndViewer(
          s3.root.ref.uriStr,
          s3.users.viewerF.did,
          prioritizeFollowedUsers,
        )
        expect(t1).toEqual([
          expect.objectContaining({ uri: s3.root.ref.uriStr }), // root
          expect.objectContaining({ uri: s3.r['3'].ref.uriStr }), // op reply
          expect.objectContaining({ uri: s3.r['4'].ref.uriStr }), // viewer reply
          expect.objectContaining({ uri: s3.r['1'].ref.uriStr }), // newest followed reply
          expect.objectContaining({ uri: s3.r['0'].ref.uriStr }), // oldest followed reply
          expect.objectContaining({ uri: s3.r['5'].ref.uriStr }), // newest non-followed reply
          expect.objectContaining({ uri: s3.r['2'].ref.uriStr }), // oldest non-followed reply
        ])

        const t2 = await threadForPostAndViewer(
          s3.root.ref.uriStr,
          s3.users.viewerNoF.did,
          prioritizeFollowedUsers,
        )
        expect(t2).toEqual([
          expect.objectContaining({ uri: s3.root.ref.uriStr }), // root
          expect.objectContaining({ uri: s3.r['3'].ref.uriStr }), // op reply
          expect.objectContaining({ uri: s3.r['5'].ref.uriStr }), // viewer reply
          // newest to oldest
          expect.objectContaining({ uri: s3.r['4'].ref.uriStr }),
          expect.objectContaining({ uri: s3.r['2'].ref.uriStr }),
          expect.objectContaining({ uri: s3.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: s3.r['0'].ref.uriStr }),
        ])
      })

      it('does not prioritize followed users if option is not set', async () => {
        const t1 = await threadForPostAndViewer(
          s3.root.ref.uriStr,
          s3.users.viewerF.did,
        )
        expect(t1).toHaveLength(7)
        expect(t1[0].uri).toBe(s3.root.ref.uriStr) // root
        expect(t1[1].uri).toBe(s3.r['3'].ref.uriStr) // op reply
        expect(t1[2].uri).toBe(s3.r['4'].ref.uriStr) // viewer reply
        // newest to oldest
        expect(t1[3].uri).toBe(s3.r['5'].ref.uriStr)
        expect(t1[4].uri).toBe(s3.r['2'].ref.uriStr)
        expect(t1[5].uri).toBe(s3.r['1'].ref.uriStr)
        expect(t1[6].uri).toBe(s3.r['0'].ref.uriStr)

        const t2 = await threadForPostAndViewer(
          s3.root.ref.uriStr,
          s3.users.viewerNoF.did,
        )
        expect(t2).toHaveLength(7)
        expect(t2[0].uri).toBe(s3.root.ref.uriStr) // root
        expect(t2[1].uri).toBe(s3.r['3'].ref.uriStr) // op reply
        expect(t2[2].uri).toBe(s3.r['5'].ref.uriStr) // viewer reply
        // newest to oldest
        expect(t2[3].uri).toBe(s3.r['4'].ref.uriStr)
        expect(t2[4].uri).toBe(s3.r['2'].ref.uriStr)
        expect(t2[5].uri).toBe(s3.r['1'].ref.uriStr)
        expect(t2[6].uri).toBe(s3.r['0'].ref.uriStr)
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
          { uri: seed.root.ref.uriStr },
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
          { uri: seed.r['0'].ref.uriStr },
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
          { uri: seed.r['0_0'].ref.uriStr },
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
          { uri: seed.root.ref.uriStr },
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
          { uri: seed.r['1'].ref.uriStr },
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
          { uri: seed.r['1_0'].ref.uriStr },
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
          { uri: seed.r['1_1'].ref.uriStr },
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
          { uri: seed.root.ref.uriStr },
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

      it(`deleted anchor returns lone not found view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { uri: seed.r['2'].ref.uriStr },
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
            depth: 0,
            value: expect.objectContaining({
              $type: 'app.bsky.unspecced.getPostThreadV2#threadItemNotFound',
            }),
          }),
        ])
      })

      it(`deleted parent is replaced by not found view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { uri: seed.r['2_0'].ref.uriStr },
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
          { uri: seed.root.ref.uriStr },
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
          { uri: seed.r['3'].ref.uriStr },
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
          { uri: seed.r['3_0_0'].ref.uriStr },
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
        { uri: seed.root.ref.uriStr },
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
          value: expect.objectContaining({ isMuted: false }),
        }),
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining({ isMuted: false }),
        }),
        // 1_0 is a nested muted reply, so it is omitted.
        expect.objectContaining({
          uri: seed.r['1_1'].ref.uriStr,
          value: expect.objectContaining({ isMuted: false }),
        }),
        // 0 is muted but is an anchor reply, so it is not omitted but de-prioritized.
        expect.objectContaining({
          uri: seed.r['0'].ref.uriStr,
          value: expect.objectContaining({ isMuted: true }),
        }),
        // 0's replies are not omitted nor marked as muted.
        expect.objectContaining({
          uri: seed.r['0_0'].ref.uriStr,
          value: expect.objectContaining({ isMuted: false }),
        }),
        expect.objectContaining({
          uri: seed.r['0_1'].ref.uriStr,
          value: expect.objectContaining({ isMuted: false }),
        }),
      ])
    })

    it(`mutes by OP don't have 3p effects`, async () => {
      const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
        { uri: seed.root.ref.uriStr },
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
          value: expect.objectContaining({ isMuted: false }),
        }),
        expect.objectContaining({
          uri: seed.r['0'].ref.uriStr,
          value: expect.objectContaining({ isMuted: false }),
        }),
        expect.objectContaining({
          uri: seed.r['0_0'].ref.uriStr,
          value: expect.objectContaining({ isMuted: false }),
        }),
        // 0_1 is a nested muted reply, so it is omitted.

        // 1 is muted but is an anchor reply, so it is not omitted but de-prioritized.
        expect.objectContaining({
          uri: seed.r['1'].ref.uriStr,
          value: expect.objectContaining({ isMuted: true }),
        }),
        // 1's replies are not omitted nor marked as muted.
        expect.objectContaining({
          uri: seed.r['1_0'].ref.uriStr,
          value: expect.objectContaining({ isMuted: false }),
        }),
        expect.objectContaining({
          uri: seed.r['1_1'].ref.uriStr,
          value: expect.objectContaining({ isMuted: false }),
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
