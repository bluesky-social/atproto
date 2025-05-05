import assert from 'node:assert'
import { subHours } from 'date-fns'
import { AppBskyFeedDefs, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { ThreadItemPost } from '../../src/lexicon/types/app/bsky/feed/defs'
import { forSnapshot } from '../_util'
import * as seeds from '../seed/get-post-thread-v2.seed'
import {
  annotateSelfThread,
  mockClientData,
  responseToThreadNodes,
} from './get-post-thread-v2-util/mock-v1-client'
import {
  ThreadTree,
  annotateOPThread,
  getPostHotness,
  postThreadView,
  run,
} from './get-post-thread-v2-util/v2-sandbox'

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
    let seed: Awaited<ReturnType<typeof seeds.simpleThreadSeed>>

    beforeAll(async () => {
      seed = await seeds.simpleThreadSeed(sc)
    })

    it('returns thread anchored on p_0 sorting by oldest', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: seed.posts.p_0.ref.uriStr,
          sorting: 'app.bsky.feed.getPostThreadV2#oldest',
        },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      expect(thread).toHaveLength(7)

      const item0 = thread[0] as ThreadItemPost
      const item1 = thread[1] as ThreadItemPost
      const item2 = thread[2] as ThreadItemPost
      const item3 = thread[3] as ThreadItemPost
      const item4 = thread[4] as ThreadItemPost
      const item5 = thread[5] as ThreadItemPost
      const item6 = thread[6] as ThreadItemPost

      expect(item0.post.record.text).toEqual('p_0 (op)')
      expect(item0.depth).toEqual(0)

      expect(item1.post.record.text).toEqual('p_0_0 (op)')
      expect(item1.depth).toEqual(1)

      expect(item2.post.record.text).toEqual('p_0_0_0 (op)')
      expect(item2.depth).toEqual(2)

      expect(item3.post.record.text).toEqual('p_0_1 (alice)')
      expect(item3.depth).toEqual(1)

      expect(item4.post.record.text).toEqual('p_0_2 (bob)')
      expect(item4.depth).toEqual(1)

      expect(item5.post.record.text).toEqual('p_0_2_0 (alice)')
      expect(item5.depth).toEqual(2)

      expect(item6.post.record.text).toEqual('p_0_3 (carol)')
      expect(item6.depth).toEqual(1)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0 sorting by newest', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: seed.posts.p_0.ref.uriStr,
          sorting: 'app.bsky.feed.getPostThreadV2#newest',
        },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      expect(thread).toHaveLength(7)

      const item0 = thread[0] as ThreadItemPost
      const item1 = thread[1] as ThreadItemPost
      const item2 = thread[2] as ThreadItemPost
      const item3 = thread[3] as ThreadItemPost
      const item4 = thread[4] as ThreadItemPost
      const item5 = thread[5] as ThreadItemPost
      const item6 = thread[6] as ThreadItemPost

      expect(item0.post.record.text).toEqual('p_0 (op)')
      expect(item0.depth).toEqual(0)

      expect(item1.post.record.text).toEqual('p_0_0 (op)')
      expect(item1.depth).toEqual(1)

      expect(item2.post.record.text).toEqual('p_0_0_0 (op)')
      expect(item2.depth).toEqual(2)

      expect(item3.post.record.text).toEqual('p_0_3 (carol)')
      expect(item3.depth).toEqual(1)

      expect(item4.post.record.text).toEqual('p_0_2 (bob)')
      expect(item4.depth).toEqual(1)

      expect(item5.post.record.text).toEqual('p_0_2_0 (alice)')
      expect(item5.depth).toEqual(2)

      expect(item6.post.record.text).toEqual('p_0_1 (alice)')
      expect(item6.depth).toEqual(1)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_0', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: seed.posts.p_0_0.ref.uriStr,
          sorting: 'app.bsky.feed.getPostThreadV2#oldest',
        },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      expect(thread).toHaveLength(3)

      const item0 = thread[0] as ThreadItemPost
      const item1 = thread[1] as ThreadItemPost
      const item2 = thread[2] as ThreadItemPost

      expect(item0.post.record.text).toEqual('p_0 (op)')
      expect(item0.depth).toEqual(-1)

      expect(item1.post.record.text).toEqual('p_0_0 (op)')
      expect(item1.depth).toEqual(0)

      expect(item2.post.record.text).toEqual('p_0_0_0 (op)')
      expect(item2.depth).toEqual(1)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_0_0', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: seed.posts.p_0_0_0.ref.uriStr,
          sorting: 'app.bsky.feed.getPostThreadV2#oldest',
        },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      expect(thread).toHaveLength(3)

      const item0 = thread[0] as ThreadItemPost
      const item1 = thread[1] as ThreadItemPost
      const item2 = thread[2] as ThreadItemPost

      expect(item0.post.record.text).toEqual('p_0 (op)')
      expect(item0.depth).toEqual(-2)

      expect(item1.post.record.text).toEqual('p_0_0 (op)')
      expect(item1.depth).toEqual(-1)

      expect(item2.post.record.text).toEqual('p_0_0_0 (op)')
      expect(item2.depth).toEqual(0)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_1', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: seed.posts.p_0_1.ref.uriStr,
          sorting: 'app.bsky.feed.getPostThreadV2#oldest',
        },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      expect(thread).toHaveLength(2)

      const item0 = thread[0] as ThreadItemPost
      const item1 = thread[1] as ThreadItemPost

      expect(item0.post.record.text).toEqual('p_0 (op)')
      expect(item0.depth).toEqual(-1)

      expect(item1.post.record.text).toEqual('p_0_1 (alice)')
      expect(item1.depth).toEqual(0)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_2', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: seed.posts.p_0_2.ref.uriStr,
          sorting: 'app.bsky.feed.getPostThreadV2#oldest',
        },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      expect(thread).toHaveLength(3)

      const item0 = thread[0] as ThreadItemPost
      const item1 = thread[1] as ThreadItemPost
      const item2 = thread[2] as ThreadItemPost

      expect(item0.post.record.text).toEqual('p_0 (op)')
      expect(item0.depth).toEqual(-1)

      expect(item1.post.record.text).toEqual('p_0_2 (bob)')
      expect(item1.depth).toEqual(0)

      expect(item2.post.record.text).toEqual('p_0_2_0 (alice)')
      expect(item2.depth).toEqual(1)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_2_0', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: seed.posts.p_0_2_0.ref.uriStr,
          sorting: 'app.bsky.feed.getPostThreadV2#oldest',
        },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      expect(thread).toHaveLength(3)

      const item0 = thread[0] as ThreadItemPost
      const item1 = thread[1] as ThreadItemPost
      const item2 = thread[2] as ThreadItemPost

      expect(item0.post.record.text).toEqual('p_0 (op)')
      expect(item0.depth).toEqual(-2)

      expect(item1.post.record.text).toEqual('p_0_2 (bob)')
      expect(item1.depth).toEqual(-1)

      expect(item2.post.record.text).toEqual('p_0_2_0 (alice)')
      expect(item2.depth).toEqual(0)

      expect(forSnapshot(data)).toMatchSnapshot()
    })

    it('returns thread anchored on p_0_3', async () => {
      const { data } = await agent.app.bsky.feed.getPostThreadV2(
        {
          uri: seed.posts.p_0_3.ref.uriStr,
          sorting: 'app.bsky.feed.getPostThreadV2#oldest',
        },
        {
          headers: await network.serviceHeaders(
            seed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      const { thread } = data
      expect(thread).toHaveLength(2)
      expect((thread[0] as ThreadItemPost).post.record.text).toEqual('p_0 (op)')
      expect((thread[1] as ThreadItemPost).post.record.text).toEqual(
        'p_0_3 (carol)',
      )
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
        'calculates the depths starting at $postKey',
        async ({ postKey }) => {
          const post = seed.posts[postKey]
          const { data } = await agent.app.bsky.feed.getPostThreadV2(
            {
              uri: post.ref.uriStr,
              sorting: 'app.bsky.feed.getPostThreadV2#oldest',
            },
            {
              headers: await network.serviceHeaders(
                seed.users.op.did,
                ids.AppBskyFeedGetPostThreadV2,
              ),
            },
          )

          const { thread } = data

          const anchorIndex = thread.findIndex(
            // TODO all of them should have URI, so I shouldn't need this type cast
            (i) => (i as ThreadItemPost).uri === post.ref.uriStr,
          )
          // TODO all of them should have depth, so I shouldn't need this type cast
          const anchorPost = thread[anchorIndex] as ThreadItemPost

          const parents = thread.slice(0, anchorIndex)
          const children = thread.slice(anchorIndex + 1, thread.length)

          parents.forEach((parent) => {
            // TODO all of them should have depth, so I shouldn't need this type cast
            expect((parent as ThreadItemPost).depth).toBeLessThan(0)
          })
          expect(anchorPost.depth).toEqual(0)
          children.forEach((child) => {
            // TODO all of them should have depth, so I shouldn't need this type cast
            expect((child as ThreadItemPost).depth).toBeGreaterThan(0)
          })
        },
      )
    })
  })

  describe.skip(`v2`, () => {
    let baseSeed: Awaited<ReturnType<typeof seeds.longThreadSeed>>

    beforeAll(async () => {
      baseSeed = await seeds.longThreadSeed(sc)
    })

    // it(`works`, async () => {
    //   const { data } = await agent.app.bsky.feed.getPostThreadV2(
    //     { uri: baseSeed.posts.op1_1_1.ref.uriStr, parentHeight: 3 },
    //     {
    //       headers: await network.serviceHeaders(
    //         baseSeed.users.op.did,
    //         ids.AppBskyFeedGetPostThreadV2,
    //       ),
    //     },
    //   )

    //   console.log(JSON.stringify(data, null, 2))
    // })

    const cases = [
      {
        params: {
          viewerDid: undefined,
          sort: 'newest',
          prioritizeFollowedUsers: false,
        },
      },
      // {
      //   params: {
      //     viewerDid: undefined,
      //     sort: 'oldest',
      //     prioritizeFollowedUsers: false,
      //   },
      // },
      // {
      //   params: {
      //     viewerDid: undefined,
      //     sort: 'hotness',
      //     prioritizeFollowedUsers: false,
      //   },
      // },
      // {
      //   params: {
      //     viewerDid: undefined,
      //     sort: 'most-likes',
      //     prioritizeFollowedUsers: false,
      //   },
      // },
      // // with prioritizeFollowedUsers
      // {
      //   params: {
      //     viewerDid: undefined,
      //     sort: 'newest',
      //     prioritizeFollowedUsers: true,
      //   },
      // },
      // {
      //   params: {
      //     viewerDid: undefined,
      //     sort: 'oldest',
      //     prioritizeFollowedUsers: true,
      //   },
      // },
      // {
      //   params: {
      //     viewerDid: undefined,
      //     sort: 'hotness',
      //     prioritizeFollowedUsers: true,
      //   },
      // },
      // {
      //   params: {
      //     viewerDid: undefined,
      //     sort: 'most-likes',
      //     prioritizeFollowedUsers: true,
      //   },
      // },
    ]

    it.each(cases)(`root viewed by op - %j`, async ({ params }) => {
      const anchorUri = baseSeed.posts.root.ref.uriStr

      const { data: dataV1 } = await agent.app.bsky.feed.getPostThread(
        { uri: anchorUri },
        {
          headers: await network.serviceHeaders(
            baseSeed.users.op.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )
      // @TODO: temporarily we're comparing the v2 output with what
      // the v1 output looks like after it is processed in the client.
      const clientDataV1 = mockClientData(dataV1.thread, {
        ...params,
      })

      const { data: dataV2 } = await agent.app.bsky.feed.getPostThreadV2(
        { uri: anchorUri },
        {
          headers: await network.serviceHeaders(
            baseSeed.users.op.did,
            ids.AppBskyFeedGetPostThreadV2,
          ),
        },
      )

      assert(clientDataV1)
      assert(dataV2)
      // assert(v1.highlightedPost.type === 'post')
      // assert(v2.highlightedPost.$type === 'post')
      // expect(v1.highlightedPost.post.record).toEqual(
      //   v2.highlightedPost.post.record,
      // )
      // expect(v1.highlightedPost.parent?.uri).toEqual(
      //   v2.highlightedPost.parent?.uri,
      // )
      // // expect(v1.highlightedPost.ctx.isHighlightedPost).toEqual(
      // //   v2.highlightedPost.isHighlighted,
      // // )
      // expect(v1.highlightedPost.ctx.depth).toEqual(v2.highlightedPost.depth)
      // expect(v1.highlightedPost.hasOPLike).toEqual(v2.highlightedPost.hasOPLike)
      // expect(v1.replies.length).toEqual(v2.replies.length)

      // for (let i = 0; i < v1.replies.length; i++) {
      //   const v1node = v1.replies[i]
      //   const v2node = v2.replies[i]

      //   if (!('type' in v1node) || !('$type' in v2node)) continue

      //   expect(v1node.uri).toEqual(v2node.uri)

      //   if (v1node.ctx.isSelfThread) {
      //     assert(v2node.$type === 'post')
      //     expect(v2node.isOPThread).toBe(true)
      //   }
      // }
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

  describe.skip(`annotateOPThread`, () => {
    let seed: Awaited<ReturnType<typeof seeds.annotateOPThreadSeed>>

    beforeAll(async () => {
      seed = await seeds.annotateOPThreadSeed(sc)
    })

    it(`annotates all OP threads correctly`, async () => {
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

      annotateSelfThread(v1)
      annotateOPThread(v2)

      assert(v1)
      assert(v2)
      assert(v1.type === 'post')
      assert(v2.$type === 'post')

      assert(v1.replies)
      assert(v2.replies)

      const root_op1 = v2.replies.find(
        (r) => r.uri === seed.posts.root_op1.ref.uriStr,
      )
      assert(root_op1)
      assert(root_op1.$type === 'post')
      expect(root_op1.isOPThread).toEqual(true)
      assert(root_op1.replies)
      const root_op1_op1 = root_op1.replies.find(
        (r) => r.uri === seed.posts.root_op1_op1.ref.uriStr,
      )
      assert(root_op1_op1)
      assert(root_op1_op1.$type === 'post')
      expect(root_op1_op1.isOPThread).toEqual(true)
      assert(root_op1_op1.replies)
      const root_op1_op1_op1 = root_op1_op1.replies.find(
        (r) => r.uri === seed.posts.root_op1_op1_op1.ref.uriStr,
      )
      assert(root_op1_op1_op1)
      assert(root_op1_op1_op1.$type === 'post')
      expect(root_op1_op1_op1.isOPThread).toEqual(true)

      const root_op2 = v2.replies.find(
        (r) => r.uri === seed.posts.root_op2.ref.uriStr,
      )
      assert(root_op2)
      assert(root_op2.$type === 'post')
      expect(root_op2.isOPThread).toEqual(true)
    })
  })

  describe.skip('getPostHotness', () => {
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
        // isHighlighted: false,
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

    it('snapshot of various hotness values', () => {
      // This test creates a range of posts with different properties and captures
      // their hotness values as a snapshot for regression testing
      const now = Date.now()

      const testCases = [
        {
          hoursAgo: 0,
          likes: 0,
          hasOPLike: false,
          label: 'brand new, no likes',
        },
        {
          hoursAgo: 0,
          likes: 100,
          hasOPLike: false,
          label: 'brand new, many likes',
        },
        {
          hoursAgo: 0,
          likes: 10,
          hasOPLike: true,
          label: 'brand new, some likes, with OP like',
        },
        {
          hoursAgo: 12,
          likes: 5,
          hasOPLike: false,
          label: '12 hours old, few likes',
        },
        {
          hoursAgo: 12,
          likes: 5,
          hasOPLike: true,
          label: '12 hours old, few likes, with OP like',
        },
        {
          hoursAgo: 48,
          likes: 1000,
          hasOPLike: false,
          label: '2 days old, very popular',
        },
        {
          hoursAgo: 48,
          likes: 1000,
          hasOPLike: true,
          label: '2 days old, very popular, with OP like',
        },
        {
          hoursAgo: 168,
          likes: 10,
          hasOPLike: false,
          label: '1 week old, some likes',
        },
        {
          hoursAgo: 168,
          likes: 10,
          hasOPLike: true,
          label: '1 week old, some likes, with OP like',
        },
      ]

      const results = testCases.map(({ label, ...rest }) => {
        const post = createThreadItem(rest)
        const hotness = getPostHotness(post, now)
        return { label, hotness }
      })

      // This creates a snapshot that can be used for regression testing
      expect(results).toMatchSnapshot()
    })
  })
})
