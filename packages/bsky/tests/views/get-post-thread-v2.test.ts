import assert from 'node:assert'
import { AtpAgent, AppBskyFeedDefs } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'

import * as seeds from '../seed/get-post-thread-v2.seed'
import {
  mockClientData,
  responseToThreadNodes,
} from './get-post-thread-v2-util/mock-v1-client'
import { run, postThreadView } from './get-post-thread-v2-util/v2-sandbox'
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
            baseSeed.users.op.did,
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
            baseSeed.users.op.did,
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

  describe.only(`postThreadView`, () => {
    let seed: Awaited<ReturnType<typeof seeds.threadViewSeed>>

    beforeAll(async () => {
      seed = await seeds.threadViewSeed(sc)
    })

    describe(`not found posts`, () => {
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
