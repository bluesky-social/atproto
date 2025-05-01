import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'

import * as seeds from '../seed/get-post-thread-v2.seed'
import { mockClientData } from './get-post-thread-v2-util/mock-v1-client'
import { run } from './get-post-thread-v2-util/v2-sandbox'
import { ids } from '../../src/lexicon/lexicons'

describe('appview thread views', () => {
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

  describe(`basic test cases`, () => {
    let baseSeed: Awaited<ReturnType<typeof seeds.baseSeed>>

    beforeAll(async () => {
      baseSeed = await seeds.baseSeed(sc)
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

    it.each(cases)(`root viewed by op — %j`, async ({ params }) => {
      const { data } = await agent.app.bsky.feed.getPostThread(
        { uri: baseSeed.posts.root.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            baseSeed.users.opp.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      const v1 = mockClientData(data.thread, {
        ...params,
      })
      const v2 = run(data.thread, {
        // @ts-expect-error idk yet
        opDid: data.thread.post.author.did,
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
      expect(v1.highlightedPost.ctx.isHighlightedPost).toEqual(
        v2.highlightedPost.isHighlighted,
      )
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

    it.each(cases)(`root viewed by dan — %j`, async ({ params }) => {
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
        // @ts-expect-error idk yet
        opDid: data.thread.post.author.did,
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
      expect(v1.highlightedPost.ctx.isHighlightedPost).toEqual(
        v2.highlightedPost.isHighlighted,
      )
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

    it.each(cases)(`self thread viewed by op — %j`, async ({ params }) => {
      const { data } = await agent.app.bsky.feed.getPostThread(
        { uri: baseSeed.posts.op1_0.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            baseSeed.users.opp.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      const v1 = mockClientData(data.thread, {
        ...params,
      })
      const v2 = run(data.thread, {
        // @ts-expect-error idk yet
        opDid: data.thread.post.author.did,
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
      expect(v1.highlightedPost.ctx.isHighlightedPost).toEqual(
        v2.highlightedPost.isHighlighted,
      )
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
})
