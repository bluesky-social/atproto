import assert from 'node:assert'
import { subHours } from 'date-fns'
import { $Typed, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { PostView } from '../../src/lexicon/types/app/bsky/feed/defs'
import { ThreadItemPost } from '../../src/lexicon/types/app/bsky/unspecced/defs'
import {
  OutputSchema,
  QueryParams,
} from '../../src/lexicon/types/app/bsky/unspecced/getPostThreadV2'
import { ThreadTree, getPostHotness } from '../../src/util/threads'
import { forSnapshot } from '../_util'
import * as seeds from '../seed/get-post-thread-v2.seed'

describe('appview thread views v2', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_get_post_thread_v_two',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('simple thread', () => {
    let seed: Awaited<ReturnType<typeof seeds.simple>>

    beforeAll(async () => {
      seed = await seeds.simple(sc)
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
      assertThreadItemPostArray(t)

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
      assertThreadItemPostArray(t)

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
      assertThreadItemPostArray(t)

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
      assertThreadItemPostArray(t)

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
      assertThreadItemPostArray(t)

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
      assertThreadItemPostArray(t)

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
      assertThreadItemPostArray(t)

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
          assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)

        const opThreadPostsUris = new Set(
          opThreadPosts.map((k) =>
            k === 'root' ? seed.root.ref.uriStr : seed.r[k].ref.uriStr,
          ),
        )

        expect(t).toHaveLength(length)
        t.forEach((i) => {
          expect(i.isOPThread).toBe(opThreadPostsUris.has(i.uri))
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
        assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)

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

    describe('hotness', () => {
      it('sorts in all levels for the case without viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: s1.root.ref.uriStr,
            sorting: 'app.bsky.unspecced.getPostThreadV2#hotness',
          },
          {
            headers: await network.serviceHeaders(
              s1.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data
        assertThreadItemPostArray(t)

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
          expect.objectContaining({ uri: s1.r['0_2'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_1'].ref.uriStr }),
          expect.objectContaining({ uri: s1.r['0_0'].ref.uriStr }),
        ])
      })

      it('sorts in all levels for the case with viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: s2.root.ref.uriStr,
            sorting: 'app.bsky.unspecced.getPostThreadV2#hotness',
          },
          {
            headers: await network.serviceHeaders(
              s2.users.viewer.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data
        assertThreadItemPostArray(t)

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
          expect.objectContaining({ uri: s2.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['1_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['2_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_4'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_3'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_2'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_1'].ref.uriStr }),
          expect.objectContaining({ uri: s2.r['0_0'].ref.uriStr }),
        ])
      })
    })

    describe('mostLikes', () => {
      it('sorts in all levels for the case without viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          {
            uri: s1.root.ref.uriStr,
            sorting: 'app.bsky.unspecced.getPostThreadV2#mostLikes',
          },
          {
            headers: await network.serviceHeaders(
              s1.users.op.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data
        assertThreadItemPostArray(t)

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
            sorting: 'app.bsky.unspecced.getPostThreadV2#mostLikes',
          },
          {
            headers: await network.serviceHeaders(
              s2.users.viewer.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data
        assertThreadItemPostArray(t)

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
        assertThreadItemPostArray(t)
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

  describe('utils', () => {
    describe('getPostHotness', () => {
      const NOW = Date.now()
      type ThreadTreeLeaf = Extract<ThreadTree, { $type: 'threadLeaf' }>

      function createThreadItem({
        hoursAgo = 0,
        likes = 0,
        hasOPLike = false,
      }: {
        hoursAgo?: number
        likes?: number
        hasOPLike?: boolean
      } = {}): ThreadTreeLeaf {
        return {
          $type: 'threadLeaf' as const,
          uri: 'at://did:plc:ay34zl7ko3x6jsazmka4kp2f/app.bsky.feed.post/3lo4zfmu6bs2y',
          post: {
            likeCount: likes,
            indexedAt: subHours(NOW, hoursAgo).toISOString(),
          } as $Typed<PostView>,
          parent: undefined,
          replies: undefined,
          depth: 0,
          isOPThread: false,
          hasOPLike: hasOPLike,
        } as ThreadTreeLeaf
      }

      it('newer posts have higher hotness than older posts with same likes', () => {
        const now = Date.now()
        const newerPost = createThreadItem({ hoursAgo: 1 })
        const olderPost = createThreadItem({ hoursAgo: 10 })

        const newerHotness = getPostHotness(newerPost, now)
        const olderHotness = getPostHotness(olderPost, now)

        expect(newerHotness).toBeGreaterThan(olderHotness)
      })

      it('posts with more likes have higher hotness than posts with fewer likes at same age', () => {
        const now = Date.now()
        const popularPost = createThreadItem({ hoursAgo: 5, likes: 100 })
        const unpopularPost = createThreadItem({ hoursAgo: 5, likes: 1 })

        const popularHotness = getPostHotness(popularPost, now)
        const unpopularHotness = getPostHotness(unpopularPost, now)

        expect(popularHotness).toBeGreaterThan(unpopularHotness)
      })

      it('posts with OP like have higher hotness than posts without OP like with same age and likes', () => {
        const now = Date.now()
        const opLikedPost = createThreadItem({
          hoursAgo: 5,
          likes: 10,
          hasOPLike: true,
        })
        const normalPost = createThreadItem({
          hoursAgo: 5,
          likes: 10,
          hasOPLike: false,
        })

        const opLikedHotness = getPostHotness(opLikedPost, now)
        const normalHotness = getPostHotness(normalPost, now)

        expect(opLikedHotness).toBeGreaterThan(normalHotness)
      })

      it('time penalty increases with post age', () => {
        const now = Date.now()
        const ages = [0, 1, 5, 24, 48, 72] // hours
        const hotness = ages.map((age) => {
          const post = createThreadItem({
            hoursAgo: age,
            likes: 10,
            hasOPLike: false,
          })
          return getPostHotness(post, now)
        })

        // Hotness should be strictly decreasing
        for (let i = 1; i < hotness.length; i++) {
          expect(hotness[i]).toBeLessThan(hotness[i - 1])
        }
      })

      it('OP like reduces time penalty effect', () => {
        const now = Date.now()
        const oldWithOpLike = createThreadItem({
          hoursAgo: 24,
          likes: 10,
          hasOPLike: true,
        })
        const newerNoOpLike = createThreadItem({
          hoursAgo: 18,
          likes: 10,
          hasOPLike: false,
        })

        const oldWithOpLikeHotness = getPostHotness(oldWithOpLike, now)
        const newerNoOpLikeHotness = getPostHotness(newerNoOpLike, now)

        // The older post with OP like might still be less hot than a newer post without OP like,
        // but it should be closer than if we compared two posts without OP like at these ages
        const withOpLikeRatio = oldWithOpLikeHotness / newerNoOpLikeHotness

        // Create two posts with the same age difference, neither with OP like
        const oldNoOpLike = createThreadItem({
          hoursAgo: 24,
          likes: 10,
          hasOPLike: false,
        })
        const newerNoOpLike2 = createThreadItem({
          hoursAgo: 18,
          likes: 10,
          hasOPLike: false,
        })

        const oldNoOpLikeHotness = getPostHotness(oldNoOpLike, now)
        const newerNoOpLike2Hotness = getPostHotness(newerNoOpLike2, now)

        const withoutOpLikeRatio = oldNoOpLikeHotness / newerNoOpLike2Hotness

        // The ratio should be higher (closer to 1) with OP like than without
        expect(withOpLikeRatio).toBeGreaterThan(withoutOpLikeRatio)
      })

      const testCases = [
        {
          hoursAgo: 0,
          likes: 0,
          hasOPLike: false,
          label: 'brand new, no likes',
          expected: 0.13679929689098982,
        },
        {
          hoursAgo: 0,
          likes: 100,
          hasOPLike: false,
          label: 'brand new, many likes',
          expected: 1.3585617635466951,
        },
        {
          hoursAgo: 0,
          likes: 10,
          hasOPLike: true,
          label: 'brand new, some likes, with OP like',
          expected: 1.2648359689243216,
        },
        {
          hoursAgo: 12,
          likes: 5,
          hasOPLike: false,
          label: '12 hours old, few likes',
          expected: 0.00961131881253479,
        },
        {
          hoursAgo: 12,
          likes: 5,
          hasOPLike: true,
          label: '12 hours old, few likes, with OP like',
          expected: 0.04084921658935257,
        },
        {
          hoursAgo: 48,
          likes: 1000,
          hasOPLike: false,
          label: '2 days old, very popular',
          expected: 0.00930680087227178,
        },
        {
          hoursAgo: 48,
          likes: 1000,
          hasOPLike: true,
          label: '2 days old, very popular, with OP like',
          expected: 0.05061897959005076,
        },
        {
          hoursAgo: 168,
          likes: 10,
          hasOPLike: false,
          label: '1 week old, some likes',
          expected: 0.00011988409773059021,
        },
        {
          hoursAgo: 168,
          likes: 10,
          hasOPLike: true,
          label: '1 week old, some likes, with OP like',
          expected: 0.0012770062547400216,
        },
      ]

      it.each(testCases)(
        'has correct hotness for: $label',
        ({ hoursAgo, likes, hasOPLike, expected }) => {
          // This test creates a range of posts with different properties and captures
          // their hotness values as a snapshot for regression testing
          const now = Date.now()

          const post = createThreadItem({ hoursAgo, likes, hasOPLike })
          const hotness = getPostHotness(post, now)
          expect(hotness).toBeCloseTo(expected)
        },
      )
    })
  })

  describe(`blocks and deletions`, () => {
    let seed: Awaited<ReturnType<typeof seeds.blockAndDeletion>>

    beforeAll(async () => {
      seed = await seeds.blockAndDeletion(sc)
    })

    describe(`blocks`, () => {
      it(`blocked reply is omitted from replies`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { uri: seed.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `viewer`, who was blocked by `bob`.
              seed.users.viewer.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data
        assertThreadItemPostArray(t)

        expect(t).toEqual([
          expect.objectContaining({ uri: seed.root.ref.uriStr }),
          expect.objectContaining({ uri: seed.r['2'].ref.uriStr }),
        ])
      })

      it(`blocked reply parent is replaced by blocked view`, async () => {
        const { data } = await agent.app.bsky.unspecced.getPostThreadV2(
          { uri: seed.r['1_0'].ref.uriStr },
          {
            headers: await network.serviceHeaders(
              // Use `viewer`, who was blocked by `bob`.
              seed.users.viewer.did,
              ids.AppBskyUnspeccedGetPostThreadV2,
            ),
          },
        )
        const { thread: t } = data

        expect(t).toEqual([
          expect.objectContaining({
            $type: 'app.bsky.unspecced.defs#threadItemBlocked',
            uri: seed.r['1'].ref.uriStr,
            depth: -1,
          }),
          expect.objectContaining({
            $type: 'app.bsky.unspecced.defs#threadItemPost',
            uri: seed.r['1_0'].ref.uriStr,
            depth: 0,
          }),
        ])
      })
    })

    describe(`deletions`, () => {
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
        assertThreadItemPostArray(t)

        expect(t).toEqual([
          expect.objectContaining({ uri: seed.root.ref.uriStr }),
          expect.objectContaining({ uri: seed.r['1'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['1_0'].ref.uriStr }),
          expect.objectContaining({ uri: seed.r['2'].ref.uriStr }),
        ])
      })

      it(`deleted reply parent is replaced by deleted view`, async () => {
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

        expect(t).toEqual([
          expect.objectContaining({
            $type: 'app.bsky.unspecced.defs#threadItemNotFound',
            uri: seed.r['0'].ref.uriStr,
            depth: -1,
          }),
          expect.objectContaining({
            $type: 'app.bsky.unspecced.defs#threadItemPost',
            uri: seed.r['0_0'].ref.uriStr,
            depth: 0,
          }),
          expect.objectContaining({
            $type: 'app.bsky.unspecced.defs#threadItemPost',
            uri: seed.r['0_0_0'].ref.uriStr,
            depth: 1,
          }),
        ])
      })
    })
  })
})

function assertThreadItemPostArray(
  t: OutputSchema['thread'],
): asserts t is $Typed<ThreadItemPost>[] {
  t.forEach((i) => {
    assert(
      i.$type === 'app.bsky.unspecced.defs#threadItemPost',
      `Expected thread item to be of type 'app.bsky.unspecced.defs#threadItemPost'`,
    )
  })
}
