import assert from 'node:assert'
import { subHours } from 'date-fns'
import { AppBskyFeedDefs, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { ThreadItemPost } from '../../src/lexicon/types/app/bsky/feed/defs'
import { forSnapshot } from '../_util'
import * as seeds from '../seed/get-post-thread-v2.seed'
import {
  mockClientData,
  responseToThreadNodes,
} from './get-post-thread-v2-util/mock-v1-client'
import {
  ThreadTree,
  getPostHotness,
  postThreadView,
  run,
} from './get-post-thread-v2-util/v2-sandbox'

// @TODO remove this helper
const debugThread = (t: ThreadItemPost[]) => {
  t.forEach((i) => console.log(i.post.record.text))
}

describe('appview thread views v2', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let simpleSeed: Awaited<ReturnType<typeof seeds.simpleThreadSeed>>

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_get_post_thread_v_two',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()

    simpleSeed = await seeds.simpleThreadSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  describe('simple thread', () => {
    it('returns thread anchored on p_0', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: simpleSeed.posts.p_0.ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            simpleSeed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      const t = thread as ThreadItemPost[]
      expect(t).toHaveLength(7)

      expect(t[0].post.record.text).toEqual('p_0 (op)')
      expect(t[0].depth).toEqual(0)

      expect(t[1].post.record.text).toEqual('p_0_0 (op)')
      expect(t[1].depth).toEqual(1)

      expect(t[2].post.record.text).toEqual('p_0_0_0 (op)')
      expect(t[2].depth).toEqual(2)

      expect(t[3].post.record.text).toEqual('p_0_1 (alice)')
      expect(t[3].depth).toEqual(1)

      expect(t[4].post.record.text).toEqual('p_0_2 (bob)')
      expect(t[4].depth).toEqual(1)

      expect(t[5].post.record.text).toEqual('p_0_2_0 (alice)')
      expect(t[5].depth).toEqual(2)

      expect(t[6].post.record.text).toEqual('p_0_3 (carol)')
      expect(t[6].depth).toEqual(1)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_0', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: simpleSeed.posts.p_0_0.ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            simpleSeed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      const t = thread as ThreadItemPost[]
      expect(t).toHaveLength(3)

      expect(t[0].post.record.text).toEqual('p_0 (op)')
      expect(t[0].depth).toEqual(-1)

      expect(t[1].post.record.text).toEqual('p_0_0 (op)')
      expect(t[1].depth).toEqual(0)

      expect(t[2].post.record.text).toEqual('p_0_0_0 (op)')
      expect(t[2].depth).toEqual(1)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_0_0', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: simpleSeed.posts.p_0_0_0.ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            simpleSeed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      const t = thread as ThreadItemPost[]
      expect(t).toHaveLength(3)

      expect(t[0].post.record.text).toEqual('p_0 (op)')
      expect(t[0].depth).toEqual(-2)

      expect(t[1].post.record.text).toEqual('p_0_0 (op)')
      expect(t[1].depth).toEqual(-1)

      expect(t[2].post.record.text).toEqual('p_0_0_0 (op)')
      expect(t[2].depth).toEqual(0)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_1', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: simpleSeed.posts.p_0_1.ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            simpleSeed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      const t = thread as ThreadItemPost[]
      expect(t).toHaveLength(2)

      expect(t[0].post.record.text).toEqual('p_0 (op)')
      expect(t[0].depth).toEqual(-1)

      expect(t[1].post.record.text).toEqual('p_0_1 (alice)')
      expect(t[1].depth).toEqual(0)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_2', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: simpleSeed.posts.p_0_2.ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            simpleSeed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      const t = thread as ThreadItemPost[]
      expect(t).toHaveLength(3)

      expect(t[0].post.record.text).toEqual('p_0 (op)')
      expect(t[0].depth).toEqual(-1)

      expect(t[1].post.record.text).toEqual('p_0_2 (bob)')
      expect(t[1].depth).toEqual(0)

      expect(t[2].post.record.text).toEqual('p_0_2_0 (alice)')
      expect(t[2].depth).toEqual(1)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_2_0', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: simpleSeed.posts.p_0_2_0.ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            simpleSeed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      const t = thread as ThreadItemPost[]
      expect(t).toHaveLength(3)

      expect(t[0].post.record.text).toEqual('p_0 (op)')
      expect(t[0].depth).toEqual(-2)

      expect(t[1].post.record.text).toEqual('p_0_2 (bob)')
      expect(t[1].depth).toEqual(-1)

      expect(t[2].post.record.text).toEqual('p_0_2_0 (alice)')
      expect(t[2].depth).toEqual(0)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_3', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: simpleSeed.posts.p_0_3.ref.uriStr,
        },
        {
          headers: await network.serviceHeaders(
            simpleSeed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      const t = thread as ThreadItemPost[]
      expect(t).toHaveLength(2)

      expect(t[0].post.record.text).toEqual('p_0 (op)')
      expect(t[1].post.record.text).toEqual('p_0_3 (carol)')
      expect(forSnapshot(data)).toMatchSnapshot()
    })
  })

  describe('long thread', () => {
    let seed: Awaited<ReturnType<typeof seeds.longThreadSeed>>

    beforeAll(async () => {
      seed = await seeds.longThreadSeed(sc)
    })

    describe('calculating depth', () => {
      type Case = {
        postKey: keyof Awaited<ReturnType<typeof seeds.longThreadSeed>>['posts']
      }

      const cases: Case[] = [
        { postKey: 'p_0' },
        { postKey: 'p_0_0' },
        { postKey: 'p_0_0_0' },
        { postKey: 'p_0_0_0_0' },
        { postKey: 'p_0_0_0_0_0' },
        { postKey: 'p_0_0_0_0_0_0' },
        { postKey: 'p_0_0_0_1' },
        { postKey: 'p_0_1' },
        { postKey: 'p_0_2' },
        { postKey: 'p_0_3' },
        { postKey: 'p_0_4' },
        { postKey: 'p_0_4_0' },
        { postKey: 'p_0_4_0_0' },
        { postKey: 'p_0_4_0_0_0' },
        { postKey: 'p_0_4_0_0_0_0' },
        { postKey: 'p_0_5' },
        { postKey: 'p_0_6' },
        { postKey: 'p_0_7' },
      ]

      it.each(cases)(
        'calculates the depths anchored at $postKey',
        async ({ postKey }) => {
          const post = seed.posts[postKey]
          const { data } = await agent.app.bsky.feed.getPostThreadV2(
            {
              uri: post.ref.uriStr,
            },
            {
              headers: await network.serviceHeaders(
                seed.users.op.did,
                ids.AppBskyFeedGetPostThreadV2,
              ),
            },
          )

          const { thread } = data
          const t = thread as ThreadItemPost[]

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
    let seed: Awaited<ReturnType<typeof seeds.deepThreadSeed>>

    beforeAll(async () => {
      seed = await seeds.deepThreadSeed(sc)
    })

    describe('above', () => {
      it('limits to the above count', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: seed.posts.p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0.ref.uriStr,
            above: 10,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(11)

        const last = t.at(-1)
        expect(last!.uri).toBe(
          seed.posts.p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0.ref.uriStr,
        )
      })

      it(`does not fulfill the above count if there are not enough items in the thread`, async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: simpleSeed.posts.p_0_0_0.ref.uriStr,
            above: 10,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(3)

        const last = t.at(-1)
        expect(last!.uri).toBe(simpleSeed.posts.p_0_0_0.ref.uriStr)
      })
    })

    describe('below', () => {
      it('limits to the below count', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: seed.posts.p_0.ref.uriStr,
            below: 10,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(11)
        expect(thread)

        const first = t.at(0)
        expect(first!.uri).toBe(seed.posts.p_0.ref.uriStr)
      })

      it(`does not fulfill the below count if there are not enough items in the thread`, async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: simpleSeed.posts.p_0.ref.uriStr,
            below: 10,
          },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(7)

        const first = t.at(0)
        expect(first!.uri).toBe(simpleSeed.posts.p_0.ref.uriStr)
      })
    })
  })

  describe(`annotateOPThread`, () => {
    let seed: Awaited<ReturnType<typeof seeds.annotateOPThreadSeed>>

    beforeAll(async () => {
      seed = await seeds.annotateOPThreadSeed(sc)
    })

    type PostKey = keyof Awaited<
      ReturnType<typeof seeds.annotateOPThreadSeed>
    >['posts']
    type Case = {
      postKey: PostKey
      length: number
      opThreadPosts: PostKey[]
    }

    const cases: Case[] = [
      {
        postKey: 'p_0_o',
        length: 9,
        opThreadPosts: [
          'p_0_o',
          'p_0_0_o',
          'p_0_0_0_o',
          'p_0_0_0_0_o',
          'p_0_2_o',
        ],
      },
      {
        postKey: 'p_0_0_o',
        length: 4,
        opThreadPosts: ['p_0_o', 'p_0_0_o', 'p_0_0_0_o', 'p_0_0_0_0_o'],
      },
      {
        postKey: 'p_0_0_0_o',
        length: 4,
        opThreadPosts: ['p_0_o', 'p_0_0_o', 'p_0_0_0_o', 'p_0_0_0_0_o'],
      },
      {
        postKey: 'p_0_0_0_0_o',
        length: 4,
        opThreadPosts: ['p_0_o', 'p_0_0_o', 'p_0_0_0_o', 'p_0_0_0_0_o'],
      },
      {
        postKey: 'p_0_1_a',
        length: 3,
        opThreadPosts: ['p_0_o'],
      },
      {
        postKey: 'p_0_1_0_a',
        length: 3,
        opThreadPosts: ['p_0_o'],
      },
      {
        postKey: 'p_0_2_o',
        length: 4,
        opThreadPosts: ['p_0_o', 'p_0_2_o'],
      },
      {
        postKey: 'p_0_2_0_b',
        length: 4,
        opThreadPosts: ['p_0_o', 'p_0_2_o'],
      },
      {
        postKey: 'p_0_2_0_0_o',
        length: 4,
        opThreadPosts: ['p_0_o', 'p_0_2_o'],
      },
    ]

    it.each(cases)(
      `annotates OP threads correctly anchored at $postKey`,
      async ({ postKey, length, opThreadPosts }) => {
        const post = seed.posts[postKey]
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          { uri: post.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const opThreadPostsUris = new Set(
          opThreadPosts.map((k) => seed.posts[k].ref.uriStr),
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(length)

        t.forEach((i) => {
          expect(i.isOPThread).toBe(opThreadPostsUris.has(i.uri))
        })
      },
    )
  })

  describe(`sorting`, () => {
    let noOpOrViewer: Awaited<
      ReturnType<typeof seeds.threadSortingSeedNoOpOrViewerReplies>
    >
    let withOpAndViewer: Awaited<
      ReturnType<typeof seeds.threadSortingSeedWithOpAndViewerReplies>
    >

    beforeAll(async () => {
      noOpOrViewer = await seeds.threadSortingSeedNoOpOrViewerReplies(sc)
      withOpAndViewer = await seeds.threadSortingSeedWithOpAndViewerReplies(sc)
    })

    describe('newest', () => {
      it('sorts in all levels for the case without viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: noOpOrViewer.posts.p_0_o.ref.uriStr,
            sorting: 'app.bsky.feed.getPostThreadV2#newest',
          },
          {
            headers: await network.serviceHeaders(
              noOpOrViewer.users.op.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(13)

        expect(t[0].uri).toBe(noOpOrViewer.posts.p_0_o.ref.uriStr)
        {
          expect(t[1].uri).toBe(noOpOrViewer.posts.p_0_2_b.ref.uriStr)
          {
            expect(t[2].uri).toBe(noOpOrViewer.posts.p_0_2_2_c.ref.uriStr)
            expect(t[3].uri).toBe(noOpOrViewer.posts.p_0_2_1_a.ref.uriStr)
            expect(t[4].uri).toBe(noOpOrViewer.posts.p_0_2_0_b.ref.uriStr)
          }
        }
        {
          expect(t[5].uri).toBe(noOpOrViewer.posts.p_0_1_c.ref.uriStr)
          {
            expect(t[6].uri).toBe(noOpOrViewer.posts.p_0_1_2_a.ref.uriStr)
            expect(t[7].uri).toBe(noOpOrViewer.posts.p_0_1_1_c.ref.uriStr)
            expect(t[8].uri).toBe(noOpOrViewer.posts.p_0_1_0_b.ref.uriStr)
          }
        }
        {
          expect(t[9].uri).toBe(noOpOrViewer.posts.p_0_0_a.ref.uriStr)
          {
            expect(t[10].uri).toBe(noOpOrViewer.posts.p_0_0_2_b.ref.uriStr)
            expect(t[11].uri).toBe(noOpOrViewer.posts.p_0_0_1_a.ref.uriStr)
            expect(t[12].uri).toBe(noOpOrViewer.posts.p_0_0_0_c.ref.uriStr)
          }
        }
      })

      it('sorts in all levels for the case with viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: withOpAndViewer.posts.p_0_o.ref.uriStr,
            sorting: 'app.bsky.feed.getPostThreadV2#newest',
          },
          {
            headers: await network.serviceHeaders(
              withOpAndViewer.users.viewer.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(31)

        expect(t[0].uri).toBe(withOpAndViewer.posts.p_0_o.ref.uriStr)
        {
          expect(t[1].uri).toBe(withOpAndViewer.posts.p_0_3_o.ref.uriStr)
          {
            expect(t[2].uri).toBe(withOpAndViewer.posts.p_0_3_2_o.ref.uriStr)
            expect(t[3].uri).toBe(withOpAndViewer.posts.p_0_3_0_v.ref.uriStr)
            expect(t[4].uri).toBe(withOpAndViewer.posts.p_0_3_4_c.ref.uriStr)
            expect(t[5].uri).toBe(withOpAndViewer.posts.p_0_3_3_a.ref.uriStr)
            expect(t[6].uri).toBe(withOpAndViewer.posts.p_0_3_1_b.ref.uriStr)
          }
        }
        {
          expect(t[7].uri).toBe(withOpAndViewer.posts.p_0_4_v.ref.uriStr)
          {
            expect(t[8].uri).toBe(withOpAndViewer.posts.p_0_4_2_o.ref.uriStr)
            expect(t[9].uri).toBe(withOpAndViewer.posts.p_0_4_3_v.ref.uriStr)
            expect(t[10].uri).toBe(withOpAndViewer.posts.p_0_4_4_a.ref.uriStr)
            expect(t[11].uri).toBe(withOpAndViewer.posts.p_0_4_1_c.ref.uriStr)
            expect(t[12].uri).toBe(withOpAndViewer.posts.p_0_4_0_b.ref.uriStr)
          }
        }
        {
          expect(t[13].uri).toBe(withOpAndViewer.posts.p_0_2_b.ref.uriStr)
          {
            expect(t[14].uri).toBe(withOpAndViewer.posts.p_0_2_2_o.ref.uriStr)
            expect(t[15].uri).toBe(withOpAndViewer.posts.p_0_2_0_v.ref.uriStr)
            expect(t[16].uri).toBe(withOpAndViewer.posts.p_0_2_4_c.ref.uriStr)
            expect(t[17].uri).toBe(withOpAndViewer.posts.p_0_2_3_a.ref.uriStr)
            expect(t[18].uri).toBe(withOpAndViewer.posts.p_0_2_1_b.ref.uriStr)
          }
        }
        {
          expect(t[19].uri).toBe(withOpAndViewer.posts.p_0_1_c.ref.uriStr)
          {
            expect(t[20].uri).toBe(withOpAndViewer.posts.p_0_1_2_o.ref.uriStr)
            expect(t[21].uri).toBe(withOpAndViewer.posts.p_0_1_3_v.ref.uriStr)
            expect(t[22].uri).toBe(withOpAndViewer.posts.p_0_1_4_a.ref.uriStr)
            expect(t[23].uri).toBe(withOpAndViewer.posts.p_0_1_1_c.ref.uriStr)
            expect(t[24].uri).toBe(withOpAndViewer.posts.p_0_1_0_b.ref.uriStr)
          }
        }
        {
          expect(t[25].uri).toBe(withOpAndViewer.posts.p_0_0_a.ref.uriStr)
          {
            expect(t[26].uri).toBe(withOpAndViewer.posts.p_0_0_4_o.ref.uriStr)
            expect(t[27].uri).toBe(withOpAndViewer.posts.p_0_0_3_v.ref.uriStr)
            expect(t[28].uri).toBe(withOpAndViewer.posts.p_0_0_2_b.ref.uriStr)
            expect(t[29].uri).toBe(withOpAndViewer.posts.p_0_0_1_a.ref.uriStr)
            expect(t[30].uri).toBe(withOpAndViewer.posts.p_0_0_0_c.ref.uriStr)
          }
        }
      })
    })

    describe('oldest', () => {
      it('sorts in all levels for the case without viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: noOpOrViewer.posts.p_0_o.ref.uriStr,
            sorting: 'app.bsky.feed.getPostThreadV2#oldest',
          },
          {
            headers: await network.serviceHeaders(
              noOpOrViewer.users.op.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(13)

        expect(t[0].uri).toBe(noOpOrViewer.posts.p_0_o.ref.uriStr)
        {
          expect(t[1].uri).toBe(noOpOrViewer.posts.p_0_0_a.ref.uriStr)
          {
            expect(t[2].uri).toBe(noOpOrViewer.posts.p_0_0_0_c.ref.uriStr)
            expect(t[3].uri).toBe(noOpOrViewer.posts.p_0_0_1_a.ref.uriStr)
            expect(t[4].uri).toBe(noOpOrViewer.posts.p_0_0_2_b.ref.uriStr)
          }
        }
        {
          expect(t[5].uri).toBe(noOpOrViewer.posts.p_0_1_c.ref.uriStr)
          {
            expect(t[6].uri).toBe(noOpOrViewer.posts.p_0_1_0_b.ref.uriStr)
            expect(t[7].uri).toBe(noOpOrViewer.posts.p_0_1_1_c.ref.uriStr)
            expect(t[8].uri).toBe(noOpOrViewer.posts.p_0_1_2_a.ref.uriStr)
          }
        }
        {
          expect(t[9].uri).toBe(noOpOrViewer.posts.p_0_2_b.ref.uriStr)
          {
            expect(t[10].uri).toBe(noOpOrViewer.posts.p_0_2_0_b.ref.uriStr)
            expect(t[11].uri).toBe(noOpOrViewer.posts.p_0_2_1_a.ref.uriStr)
            expect(t[12].uri).toBe(noOpOrViewer.posts.p_0_2_2_c.ref.uriStr)
          }
        }
      })

      it('sorts in all levels for the case with viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: withOpAndViewer.posts.p_0_o.ref.uriStr,
            sorting: 'app.bsky.feed.getPostThreadV2#oldest',
          },
          {
            headers: await network.serviceHeaders(
              withOpAndViewer.users.viewer.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(31)

        expect(t[0].uri).toBe(withOpAndViewer.posts.p_0_o.ref.uriStr)
        {
          expect(t[1].uri).toBe(withOpAndViewer.posts.p_0_3_o.ref.uriStr)
          {
            expect(t[2].uri).toBe(withOpAndViewer.posts.p_0_3_2_o.ref.uriStr)
            expect(t[3].uri).toBe(withOpAndViewer.posts.p_0_3_0_v.ref.uriStr)
            expect(t[4].uri).toBe(withOpAndViewer.posts.p_0_3_1_b.ref.uriStr)
            expect(t[5].uri).toBe(withOpAndViewer.posts.p_0_3_3_a.ref.uriStr)
            expect(t[6].uri).toBe(withOpAndViewer.posts.p_0_3_4_c.ref.uriStr)
          }
        }
        {
          expect(t[7].uri).toBe(withOpAndViewer.posts.p_0_4_v.ref.uriStr)
          {
            expect(t[8].uri).toBe(withOpAndViewer.posts.p_0_4_2_o.ref.uriStr)
            expect(t[9].uri).toBe(withOpAndViewer.posts.p_0_4_3_v.ref.uriStr)
            expect(t[10].uri).toBe(withOpAndViewer.posts.p_0_4_0_b.ref.uriStr)
            expect(t[11].uri).toBe(withOpAndViewer.posts.p_0_4_1_c.ref.uriStr)
            expect(t[12].uri).toBe(withOpAndViewer.posts.p_0_4_4_a.ref.uriStr)
          }
        }
        {
          expect(t[13].uri).toBe(withOpAndViewer.posts.p_0_0_a.ref.uriStr)
          {
            expect(t[14].uri).toBe(withOpAndViewer.posts.p_0_0_4_o.ref.uriStr)
            expect(t[15].uri).toBe(withOpAndViewer.posts.p_0_0_3_v.ref.uriStr)
            expect(t[16].uri).toBe(withOpAndViewer.posts.p_0_0_0_c.ref.uriStr)
            expect(t[17].uri).toBe(withOpAndViewer.posts.p_0_0_1_a.ref.uriStr)
            expect(t[18].uri).toBe(withOpAndViewer.posts.p_0_0_2_b.ref.uriStr)
          }
        }
        {
          expect(t[19].uri).toBe(withOpAndViewer.posts.p_0_1_c.ref.uriStr)
          {
            expect(t[20].uri).toBe(withOpAndViewer.posts.p_0_1_2_o.ref.uriStr)
            expect(t[21].uri).toBe(withOpAndViewer.posts.p_0_1_3_v.ref.uriStr)
            expect(t[22].uri).toBe(withOpAndViewer.posts.p_0_1_0_b.ref.uriStr)
            expect(t[23].uri).toBe(withOpAndViewer.posts.p_0_1_1_c.ref.uriStr)
            expect(t[24].uri).toBe(withOpAndViewer.posts.p_0_1_4_a.ref.uriStr)
          }
        }
        {
          expect(t[25].uri).toBe(withOpAndViewer.posts.p_0_2_b.ref.uriStr)
          {
            expect(t[26].uri).toBe(withOpAndViewer.posts.p_0_2_2_o.ref.uriStr)
            expect(t[27].uri).toBe(withOpAndViewer.posts.p_0_2_0_v.ref.uriStr)
            expect(t[28].uri).toBe(withOpAndViewer.posts.p_0_2_1_b.ref.uriStr)
            expect(t[29].uri).toBe(withOpAndViewer.posts.p_0_2_3_a.ref.uriStr)
            expect(t[30].uri).toBe(withOpAndViewer.posts.p_0_2_4_c.ref.uriStr)
          }
        }
      })
    })

    describe('hotness', () => {
      it('sorts in all levels for the case without viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: noOpOrViewer.posts.p_0_o.ref.uriStr,
            sorting: 'app.bsky.feed.getPostThreadV2#hotness',
          },
          {
            headers: await network.serviceHeaders(
              noOpOrViewer.users.op.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(13)

        expect(t[0].uri).toBe(noOpOrViewer.posts.p_0_o.ref.uriStr)
        {
          expect(t[1].uri).toBe(noOpOrViewer.posts.p_0_1_c.ref.uriStr)
          {
            expect(t[2].uri).toBe(noOpOrViewer.posts.p_0_1_1_c.ref.uriStr)
            expect(t[3].uri).toBe(noOpOrViewer.posts.p_0_1_0_b.ref.uriStr)
            expect(t[4].uri).toBe(noOpOrViewer.posts.p_0_1_2_a.ref.uriStr)
          }
        }
        {
          expect(t[5].uri).toBe(noOpOrViewer.posts.p_0_2_b.ref.uriStr)
          {
            expect(t[6].uri).toBe(noOpOrViewer.posts.p_0_2_0_b.ref.uriStr)
            expect(t[7].uri).toBe(noOpOrViewer.posts.p_0_2_1_a.ref.uriStr)
            expect(t[8].uri).toBe(noOpOrViewer.posts.p_0_2_2_c.ref.uriStr)
          }
        }
        {
          expect(t[9].uri).toBe(noOpOrViewer.posts.p_0_0_a.ref.uriStr)
          {
            expect(t[10].uri).toBe(noOpOrViewer.posts.p_0_0_2_b.ref.uriStr)
            expect(t[11].uri).toBe(noOpOrViewer.posts.p_0_0_1_a.ref.uriStr)
            expect(t[12].uri).toBe(noOpOrViewer.posts.p_0_0_0_c.ref.uriStr)
          }
        }
      })

      it('sorts in all levels for the case with viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: withOpAndViewer.posts.p_0_o.ref.uriStr,
            sorting: 'app.bsky.feed.getPostThreadV2#hotness',
          },
          {
            headers: await network.serviceHeaders(
              withOpAndViewer.users.viewer.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(31)

        expect(t[0].uri).toBe(withOpAndViewer.posts.p_0_o.ref.uriStr)
        {
          expect(t[1].uri).toBe(withOpAndViewer.posts.p_0_3_o.ref.uriStr)
          {
            expect(t[2].uri).toBe(withOpAndViewer.posts.p_0_3_2_o.ref.uriStr)
            expect(t[3].uri).toBe(withOpAndViewer.posts.p_0_3_0_v.ref.uriStr)
            expect(t[4].uri).toBe(withOpAndViewer.posts.p_0_3_4_c.ref.uriStr)
            expect(t[5].uri).toBe(withOpAndViewer.posts.p_0_3_3_a.ref.uriStr)
            expect(t[6].uri).toBe(withOpAndViewer.posts.p_0_3_1_b.ref.uriStr)
          }
        }
        {
          expect(t[7].uri).toBe(withOpAndViewer.posts.p_0_4_v.ref.uriStr)
          {
            expect(t[8].uri).toBe(withOpAndViewer.posts.p_0_4_2_o.ref.uriStr)
            expect(t[9].uri).toBe(withOpAndViewer.posts.p_0_4_3_v.ref.uriStr)
            expect(t[10].uri).toBe(withOpAndViewer.posts.p_0_4_1_c.ref.uriStr)
            expect(t[11].uri).toBe(withOpAndViewer.posts.p_0_4_0_b.ref.uriStr)
            expect(t[12].uri).toBe(withOpAndViewer.posts.p_0_4_4_a.ref.uriStr)
          }
        }
        {
          expect(t[13].uri).toBe(withOpAndViewer.posts.p_0_1_c.ref.uriStr)
          {
            expect(t[14].uri).toBe(withOpAndViewer.posts.p_0_1_2_o.ref.uriStr)
            expect(t[15].uri).toBe(withOpAndViewer.posts.p_0_1_3_v.ref.uriStr)
            expect(t[16].uri).toBe(withOpAndViewer.posts.p_0_1_1_c.ref.uriStr)
            expect(t[17].uri).toBe(withOpAndViewer.posts.p_0_1_0_b.ref.uriStr)
            expect(t[18].uri).toBe(withOpAndViewer.posts.p_0_1_4_a.ref.uriStr)
          }
        }
        {
          expect(t[19].uri).toBe(withOpAndViewer.posts.p_0_2_b.ref.uriStr)
          {
            expect(t[20].uri).toBe(withOpAndViewer.posts.p_0_2_2_o.ref.uriStr)
            expect(t[21].uri).toBe(withOpAndViewer.posts.p_0_2_0_v.ref.uriStr)
            expect(t[22].uri).toBe(withOpAndViewer.posts.p_0_2_4_c.ref.uriStr)
            expect(t[23].uri).toBe(withOpAndViewer.posts.p_0_2_1_b.ref.uriStr)
            expect(t[24].uri).toBe(withOpAndViewer.posts.p_0_2_3_a.ref.uriStr)
          }
        }
        {
          expect(t[25].uri).toBe(withOpAndViewer.posts.p_0_0_a.ref.uriStr)
          {
            expect(t[26].uri).toBe(withOpAndViewer.posts.p_0_0_4_o.ref.uriStr)
            expect(t[27].uri).toBe(withOpAndViewer.posts.p_0_0_3_v.ref.uriStr)
            expect(t[28].uri).toBe(withOpAndViewer.posts.p_0_0_2_b.ref.uriStr)
            expect(t[29].uri).toBe(withOpAndViewer.posts.p_0_0_1_a.ref.uriStr)
            expect(t[30].uri).toBe(withOpAndViewer.posts.p_0_0_0_c.ref.uriStr)
          }
        }
      })
    })

    describe('mostLikes', () => {
      it('sorts in all levels for the case without viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: noOpOrViewer.posts.p_0_o.ref.uriStr,
            sorting: 'app.bsky.feed.getPostThreadV2#mostLikes',
          },
          {
            headers: await network.serviceHeaders(
              noOpOrViewer.users.op.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(13)

        expect(t[0].uri).toBe(noOpOrViewer.posts.p_0_o.ref.uriStr)
        {
          expect(t[1].uri).toBe(noOpOrViewer.posts.p_0_1_c.ref.uriStr)
          {
            expect(t[2].uri).toBe(noOpOrViewer.posts.p_0_1_1_c.ref.uriStr)
            expect(t[3].uri).toBe(noOpOrViewer.posts.p_0_1_0_b.ref.uriStr)
            expect(t[4].uri).toBe(noOpOrViewer.posts.p_0_1_2_a.ref.uriStr)
          }
        }
        {
          expect(t[5].uri).toBe(noOpOrViewer.posts.p_0_2_b.ref.uriStr)
          {
            expect(t[6].uri).toBe(noOpOrViewer.posts.p_0_2_0_b.ref.uriStr)
            expect(t[7].uri).toBe(noOpOrViewer.posts.p_0_2_1_a.ref.uriStr)
            expect(t[8].uri).toBe(noOpOrViewer.posts.p_0_2_2_c.ref.uriStr)
          }
        }
        {
          expect(t[9].uri).toBe(noOpOrViewer.posts.p_0_0_a.ref.uriStr)
          {
            expect(t[10].uri).toBe(noOpOrViewer.posts.p_0_0_1_a.ref.uriStr)
            expect(t[11].uri).toBe(noOpOrViewer.posts.p_0_0_2_b.ref.uriStr)
            expect(t[12].uri).toBe(noOpOrViewer.posts.p_0_0_0_c.ref.uriStr)
          }
        }
      })

      it('sorts in all levels for the case with viewer and OP replies', async () => {
        const { data } = await agent.app.bsky.feed.getPostThreadV2(
          {
            uri: withOpAndViewer.posts.p_0_o.ref.uriStr,
            sorting: 'app.bsky.feed.getPostThreadV2#mostLikes',
          },
          {
            headers: await network.serviceHeaders(
              withOpAndViewer.users.viewer.did,
              ids.AppBskyFeedGetPostThreadV2,
            ),
          },
        )

        const { thread } = data
        const t = thread as ThreadItemPost[]
        expect(t).toHaveLength(31)

        expect(t[0].uri).toBe(withOpAndViewer.posts.p_0_o.ref.uriStr)
        {
          expect(t[1].uri).toBe(withOpAndViewer.posts.p_0_3_o.ref.uriStr)
          {
            expect(t[2].uri).toBe(withOpAndViewer.posts.p_0_3_2_o.ref.uriStr)
            expect(t[3].uri).toBe(withOpAndViewer.posts.p_0_3_0_v.ref.uriStr)
            expect(t[4].uri).toBe(withOpAndViewer.posts.p_0_3_4_c.ref.uriStr)
            expect(t[5].uri).toBe(withOpAndViewer.posts.p_0_3_3_a.ref.uriStr)
            expect(t[6].uri).toBe(withOpAndViewer.posts.p_0_3_1_b.ref.uriStr)
          }
        }
        {
          expect(t[7].uri).toBe(withOpAndViewer.posts.p_0_4_v.ref.uriStr)
          {
            expect(t[8].uri).toBe(withOpAndViewer.posts.p_0_4_2_o.ref.uriStr)
            expect(t[9].uri).toBe(withOpAndViewer.posts.p_0_4_3_v.ref.uriStr)
            expect(t[10].uri).toBe(withOpAndViewer.posts.p_0_4_1_c.ref.uriStr)
            expect(t[11].uri).toBe(withOpAndViewer.posts.p_0_4_0_b.ref.uriStr)
            expect(t[12].uri).toBe(withOpAndViewer.posts.p_0_4_4_a.ref.uriStr)
          }
        }
        {
          expect(t[13].uri).toBe(withOpAndViewer.posts.p_0_1_c.ref.uriStr)
          {
            expect(t[14].uri).toBe(withOpAndViewer.posts.p_0_1_2_o.ref.uriStr)
            expect(t[15].uri).toBe(withOpAndViewer.posts.p_0_1_3_v.ref.uriStr)
            expect(t[16].uri).toBe(withOpAndViewer.posts.p_0_1_1_c.ref.uriStr)
            expect(t[17].uri).toBe(withOpAndViewer.posts.p_0_1_0_b.ref.uriStr)
            expect(t[18].uri).toBe(withOpAndViewer.posts.p_0_1_4_a.ref.uriStr)
          }
        }
        {
          expect(t[19].uri).toBe(withOpAndViewer.posts.p_0_2_b.ref.uriStr)
          {
            expect(t[20].uri).toBe(withOpAndViewer.posts.p_0_2_2_o.ref.uriStr)
            expect(t[21].uri).toBe(withOpAndViewer.posts.p_0_2_0_v.ref.uriStr)
            expect(t[22].uri).toBe(withOpAndViewer.posts.p_0_2_1_b.ref.uriStr)
            expect(t[23].uri).toBe(withOpAndViewer.posts.p_0_2_4_c.ref.uriStr)
            expect(t[24].uri).toBe(withOpAndViewer.posts.p_0_2_3_a.ref.uriStr)
          }
        }
        {
          expect(t[25].uri).toBe(withOpAndViewer.posts.p_0_0_a.ref.uriStr)
          {
            expect(t[26].uri).toBe(withOpAndViewer.posts.p_0_0_4_o.ref.uriStr)
            expect(t[27].uri).toBe(withOpAndViewer.posts.p_0_0_3_v.ref.uriStr)
            expect(t[28].uri).toBe(withOpAndViewer.posts.p_0_0_1_a.ref.uriStr)
            expect(t[29].uri).toBe(withOpAndViewer.posts.p_0_0_2_b.ref.uriStr)
            expect(t[30].uri).toBe(withOpAndViewer.posts.p_0_0_0_c.ref.uriStr)
          }
        }
      })
    })
  })

  describe('utils', () => {
    describe('getPostHotness', () => {
      const NOW = Date.now()

      function createThreadItem({
        hoursAgo = 0,
        likes = 0,
        hasOPLike = false,
      }: {
        hoursAgo?: number
        likes?: number
        hasOPLike?: boolean
      } = {}): Extract<ThreadTree, { $type: 'post' }> {
        return {
          $type: 'post' as const,
          uri: 'at://did:plc:ay34zl7ko3x6jsazmka4kp2f/app.bsky.feed.post/3lo4zfmu6bs2y',
          post: {
            uri: 'at://did:plc:ay34zl7ko3x6jsazmka4kp2f/app.bsky.feed.post/3lo4zfmu6bs2y',
            cid: 'bafyreifiq5bmqqjuafvxyxibjpad3gjajnenhvckqsgwhoe6g5jmmo4ur4',
            author: {
              did: 'did:plc:ay34zl7ko3x6jsazmka4kp2f',
              handle: 'fl-op.test',
              viewer: {
                muted: false,
                blockedBy: false,
              },
              labels: [],
            },
            record: {
              text: 'root',
              $type: 'app.bsky.feed.post',
              createdAt: '2025-05-01T19:14:19.210Z',
            },
            replyCount: 0,
            repostCount: 0,
            likeCount: likes,
            quoteCount: 0,
            indexedAt: subHours(NOW, hoursAgo).toISOString(),
            viewer: {
              threadMuted: false,
              embeddingDisabled: false,
            },
            labels: [],
          },
          parent: undefined,
          replies: undefined,
          depth: 0,
          isOPThread: false,
          hasOPLike: hasOPLike,
          hasUnhydratedReplies: false,
        } as const
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

  describe.skip(`OLD basic test cases`, () => {
    let baseSeed: Awaited<ReturnType<typeof seeds.longThreadSeed>>

    beforeAll(async () => {
      baseSeed = await seeds.longThreadSeed(sc)
    })

    const cases = [
      {
        params: {
          viewerDid: undefined,
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
      },
      {
        params: {
          viewerDid: undefined,
          sort: 'oldest',
          prioritizeFollowedUsers: false,
        },
      },
      {
        params: {
          viewerDid: undefined,
          sort: 'hotness',
          prioritizeFollowedUsers: false,
        },
      },
      {
        params: {
          viewerDid: undefined,
          sort: 'most-likes',
          prioritizeFollowedUsers: false,
        },
      },
      // with prioritizeFollowedUsers
      {
        params: {
          viewerDid: undefined,
          sort: 'newest',
          prioritizeFollowedUsers: true,
        },
      },
      {
        params: {
          viewerDid: undefined,
          sort: 'oldest',
          prioritizeFollowedUsers: true,
        },
      },
      {
        params: {
          viewerDid: undefined,
          sort: 'hotness',
          prioritizeFollowedUsers: true,
        },
      },
      {
        params: {
          viewerDid: undefined,
          sort: 'most-likes',
          prioritizeFollowedUsers: true,
        },
      },
    ]

    it.each(cases)(`root viewed by op - %j`, async ({ params }) => {
      const { data } = await agent.app.bsky.feed.getPostThread(
        { uri: baseSeed.posts.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            baseSeed.users.op.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      const v1 = mockClientData(data.thread, {
        ...params,
      })
      const v2 = run(data.thread, {
        ...params,
      })

      assert(v1)
      assert(v2)
      assert(v1.highlightedPost.type === 'post')
      assert(v2.highlightedPost.$type === 'post')
      expect(v1.highlightedPost.post.record).toEqual(
        v2.highlightedPost.post.record,
      )
      expect(v1.highlightedPost.parent?.uri).toEqual(
        v2.highlightedPost.parent?.uri,
      )
      // expect(v1.highlightedPost.ctx.isHighlightedPost).toEqual(
      //   v2.highlightedPost.isHighlighted,
      // )
      expect(v1.highlightedPost.ctx.depth).toEqual(v2.highlightedPost.depth)
      expect(v1.highlightedPost.hasOPLike).toEqual(v2.highlightedPost.hasOPLike)
      expect(v1.replies.length).toEqual(v2.replies.length)

      for (let i = 0; i < v1.replies.length; i++) {
        const v1node = v1.replies[i]
        const v2node = v2.replies[i]

        if (!('type' in v1node) || !('$type' in v2node)) continue

        expect(v1node.uri).toEqual(v2node.uri)

        if (v1node.ctx.isSelfThread) {
          assert(v2node.$type === 'post')
          expect(v2node.isOPThread).toBe(true)
        }
      }
    })

    it.each(cases)(`root viewed by dan - %j`, async ({ params }) => {
      const { data } = await agent.app.bsky.feed.getPostThread(
        { uri: baseSeed.posts.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            baseSeed.users.dan.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      const v1 = mockClientData(data.thread, {
        ...params,
      })
      const v2 = run(data.thread, {
        ...params,
      })

      assert(v1)
      assert(v2)
      assert(v1.highlightedPost.type === 'post')
      assert(v2.highlightedPost.$type === 'post')
      expect(v1.highlightedPost.post.record).toEqual(
        v2.highlightedPost.post.record,
      )
      expect(v1.highlightedPost.parent?.uri).toEqual(
        v2.highlightedPost.parent?.uri,
      )
      // expect(v1.highlightedPost.ctx.isHighlightedPost).toEqual(
      //   v2.highlightedPost.isHighlighted,
      // )
      expect(v1.highlightedPost.ctx.depth).toEqual(v2.highlightedPost.depth)
      expect(v1.highlightedPost.hasOPLike).toEqual(v2.highlightedPost.hasOPLike)
      expect(v1.replies.length).toEqual(v2.replies.length)

      for (let i = 0; i < v1.replies.length; i++) {
        const v1node = v1.replies[i]
        const v2node = v2.replies[i]

        if (!('type' in v1node) || !('$type' in v2node)) continue

        expect(v1node.uri).toEqual(v2node.uri)

        if (v1node.ctx.isSelfThread) {
          assert(v2node.$type === 'post')
          expect(v2node.isOPThread).toBe(true)
        }
      }
    })

    it.each(cases)(`self thread viewed by op - %j`, async ({ params }) => {
      const { data } = await agent.app.bsky.feed.getPostThread(
        { uri: baseSeed.posts.p_0_0.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            baseSeed.users.op.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      const v1 = mockClientData(data.thread, {
        ...params,
      })
      const v2 = run(data.thread, {
        ...params,
      })

      assert(v1)
      assert(v2)
      assert(v1.highlightedPost.type === 'post')
      assert(v2.highlightedPost.$type === 'post')
      expect(v1.highlightedPost.post.record).toEqual(
        v2.highlightedPost.post.record,
      )
      expect(v1.highlightedPost.parent?.uri).toEqual(
        v2.highlightedPost.parent?.uri,
      )
      // expect(v1.highlightedPost.ctx.isHighlightedPost).toEqual(
      //   v2.highlightedPost.isHighlighted,
      // )
      expect(v1.highlightedPost.ctx.depth).toEqual(v2.highlightedPost.depth)
      expect(v1.highlightedPost.hasOPLike).toEqual(v2.highlightedPost.hasOPLike)
      expect(v1.replies.length).toEqual(v2.replies.length)

      for (let i = 0; i < v1.replies.length; i++) {
        const v1node = v1.replies[i]
        const v2node = v2.replies[i]

        if (!('type' in v1node) || !('$type' in v2node)) continue

        expect(v1node.uri).toEqual(v2node.uri)

        if (v1node.ctx.isSelfThread) {
          assert(v2node.$type === 'post')
          expect(v2node.isOPThread).toBe(true)
        }
      }
    })
  })

  describe.skip(`postThreadView`, () => {
    let seed: Awaited<ReturnType<typeof seeds.threadViewSeed>>

    beforeAll(async () => {
      seed = await seeds.threadViewSeed(sc)
    })

    describe(`deletions`, () => {
      it(`deleted reply is omitted from replies[]`, async () => {
        const { data } = await agent.app.bsky.feed.getPostThread(
          { uri: seed.posts.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyFeedGetPostThread,
            ),
          },
        )

        const v1 = responseToThreadNodes(data.thread)
        const v2 = postThreadView({
          thread: data.thread,
        })

        assert(v1)
        assert(v2)
        assert(v1.type === 'post')
        assert(v2.$type === 'post')

        expect(v1.replies?.length).toEqual(v2.replies?.length)
        assert(v1.replies)
        expect(
          v1.replies.find((r) => r.uri === seed.posts.root_a1.ref.uriStr),
        ).toBeUndefined()
        assert(v2.replies)
        expect(
          v2.replies.find((r) => r.uri === seed.posts.root_a1.ref.uriStr),
        ).toBeUndefined()
      })

      it(`deleted reply parent is replaced by deleted view`, async () => {
        const { data } = await agent.app.bsky.feed.getPostThread(
          { uri: seed.posts.root_a1_a2.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.op.did,
              ids.AppBskyFeedGetPostThread,
            ),
          },
        )

        const v1 = responseToThreadNodes(data.thread)
        const v2 = postThreadView({
          thread: data.thread,
        })

        assert(v1)
        assert(v2)
        assert(v1.type === 'post')
        assert(v2.$type === 'post')

        assert(v1.parent)
        assert(v2.parent)
        expect(v1.parent.uri).toEqual(v2.parent.uri)
        expect(v1.parent.type).toEqual('not-found')
        expect(AppBskyFeedDefs.isNotFoundPost(v2.parent)).toEqual(true)
        assert(v1.replies)
        assert(v2.replies)
        expect(v1.replies?.length).toEqual(v2.replies?.length)
      })
    })

    describe(`blocks`, () => {
      it(`blocked reply parent is replaced by blocked view`, async () => {
        const { data } = await agent.app.bsky.feed.getPostThread(
          { uri: seed.posts.root_b1_a1.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.viewer.did,
              ids.AppBskyFeedGetPostThread,
            ),
          },
        )

        const v1 = responseToThreadNodes(data.thread)
        const v2 = postThreadView({
          thread: data.thread,
        })

        assert(v1)
        assert(v2)
        assert(v1.type === 'post')
        assert(v2.$type === 'post')

        assert(v1.parent)
        assert(v2.parent)
        expect(v1.parent.uri).toEqual(v2.parent.uri)
        expect(v1.parent.type).toEqual('blocked')
        expect(AppBskyFeedDefs.isBlockedPost(v2.parent)).toEqual(true)
      })

      it(`blocked reply is omitted from replies[]`, async () => {
        const { data } = await agent.app.bsky.feed.getPostThread(
          { uri: seed.posts.root.ref.uriStr },
          {
            headers: await network.serviceHeaders(
              seed.users.viewer.did,
              ids.AppBskyFeedGetPostThread,
            ),
          },
        )

        const v1 = responseToThreadNodes(data.thread)
        const v2 = postThreadView({
          thread: data.thread,
        })

        assert(v1)
        assert(v2)
        assert(v1.type === 'post')
        assert(v2.$type === 'post')

        assert(v1.replies)
        assert(v2.replies)
        expect(
          v1.replies.find((r) => r.uri === seed.posts.root_b1.ref.uriStr),
        ).toBeUndefined()
        expect(
          v2.replies.find((r) => r.uri === seed.posts.root_b1.ref.uriStr),
        ).toBeUndefined()
      })
    })
  })
})
