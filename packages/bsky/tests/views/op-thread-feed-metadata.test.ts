import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ids } from '@atproto/api'
import { type RecordRef, type SeedClient, TestNetwork } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { Gate } from '../../src/feature-gates/gates.js'

type FeedItemWithOpThreadMetadata = {
  post: { uri: string }
  opThreadPostIndex?: number
  opThreadPostCount?: number
}

describe('OP thread feed metadata', () => {
  let network: TestNetwork
  let sc: SeedClient<TestNetwork>
  let op: DidString
  let viewer: DidString
  let posts: RecordRef[]
  let list: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_op_thread_feed_metadata',
    })
    sc = network.getSeedClient()
    await sc.createAccount('threadop', {
      handle: 'threadop.test',
      email: 'threadop@test.com',
      password: 'threadop-pass',
    })
    await sc.createAccount('viewer', {
      handle: 'viewer.test',
      email: 'viewer@test.com',
      password: 'viewer-pass',
    })
    op = sc.dids.threadop
    viewer = sc.dids.viewer
    await sc.follow(viewer, op)
    list = await sc.createList(viewer, 'OPs', 'curate')
    await sc.addToList(viewer, op, list)
    const root = await sc.post(op, 'root')
    const first = await sc.reply(op, root.ref, root.ref, 'first')
    const second = await sc.reply(op, root.ref, first.ref, 'second')
    posts = [root.ref, first.ref, second.ref]
    for (const post of posts) {
      await sc.like(viewer, post)
    }
    await network.processAll()
  })

  afterAll(async () => network?.close())

  it('exposes canonical numbering on DID-targeted feed requests', async () => {
    using scope = vi
      .spyOn(network.bsky.ctx.featureGatesClient, 'scope')
      .mockImplementation((userContext) => {
        const enabled = userContext.did === viewer
        return {
          Gate,
          checkGate: (gate) => enabled && gate === Gate.OpThreadMetadataEnable,
          checkGates: (gates) =>
            new Map(
              gates.map((gate) => [
                gate,
                enabled && gate === Gate.OpThreadMetadataEnable,
              ]),
            ),
        }
      })

    const agent = network.bsky.getAgent()
    const [authorFeed, timeline, listFeed, actorLikes] = await Promise.all([
      agent.api.app.bsky.feed.getAuthorFeed(
        { actor: op },
        {
          headers: await network.serviceHeaders(
            viewer,
            ids.AppBskyFeedGetAuthorFeed,
          ),
        },
      ),
      agent.api.app.bsky.feed.getTimeline(
        {},
        {
          headers: await network.serviceHeaders(
            viewer,
            ids.AppBskyFeedGetTimeline,
          ),
        },
      ),
      agent.api.app.bsky.feed.getListFeed(
        { list: list.uriStr },
        {
          headers: await network.serviceHeaders(
            viewer,
            ids.AppBskyFeedGetListFeed,
          ),
        },
      ),
      agent.api.app.bsky.feed.getActorLikes(
        { actor: viewer },
        {
          headers: await network.serviceHeaders(
            viewer,
            ids.AppBskyFeedGetActorLikes,
          ),
        },
      ),
    ])

    expect(scope.mock.calls.map(([context]) => context.did)).toEqual([
      viewer,
      viewer,
      viewer,
      viewer,
    ])

    for (const [name, response] of Object.entries({
      authorFeed,
      timeline,
      listFeed,
      actorLikes,
    })) {
      const byUri = new Map(
        response.data.feed.map((item) => [
          item.post.uri,
          item as FeedItemWithOpThreadMetadata,
        ]),
      )
      expect(
        posts.map((post) => {
          const item = byUri.get(post.uriStr)
          return [item?.opThreadPostIndex, item?.opThreadPostCount]
        }),
        name,
      ).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ])
    }
    expect(scope).toHaveBeenCalledTimes(4)
  })
})
