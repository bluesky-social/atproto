import AtpAgent, { AppBskyEmbedRecord } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { Users, postgatesSeed } from './seed/postgates'

describe('postgates', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let users: Users

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_tests_postgates',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()

    const result = await postgatesSeed(sc)
    users = result.users

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe(`quotee <-> quoter`, () => {
    it(`quotee detaches own post from quoter`, async () => {
      const quoteePost = await sc.post(users.quotee.did, `post`)
      const quoterPost = await sc.post(
        users.quoter.did,
        `quote post`,
        undefined,
        undefined,
        quoteePost.ref,
      )
      await pdsAgent.api.app.bsky.feed.postgate.create(
        {
          repo: users.quotee.did,
          rkey: quoteePost.ref.uri.rkey,
        },
        {
          post: quoteePost.ref.uriStr,
          createdAt: new Date().toISOString(),
          detachedEmbeddingUris: [quoterPost.ref.uriStr],
        },
        sc.getHeaders(users.quotee.did),
      )
      await network.processAll()

      const root = await agent.api.app.bsky.feed.getPostThread(
        { uri: quoterPost.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            users.viewer.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      expect(
        // @ts-ignore I know more than you
        AppBskyEmbedRecord.isViewDetached(root.data.thread.post.embed.record),
      ).toBe(true)
    })

    it(`postgate made by bystander has no effect`, async () => {
      const quoteePost = await sc.post(users.quotee.did, `post`)
      const quoterPost = await sc.post(
        users.quoter.did,
        `quote post`,
        undefined,
        undefined,
        quoteePost.ref,
      )
      await pdsAgent.api.app.bsky.feed.postgate.create(
        {
          repo: users.viewer.did,
          rkey: quoteePost.ref.uri.rkey,
        },
        {
          post: quoteePost.ref.uriStr,
          createdAt: new Date().toISOString(),
          detachedEmbeddingUris: [quoterPost.ref.uriStr],
        },
        sc.getHeaders(users.viewer.did),
      )
      await network.processAll()

      const root = await agent.api.app.bsky.feed.getPostThread(
        { uri: quoterPost.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            users.viewer.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      expect(
        // @ts-ignore I know more than you
        AppBskyEmbedRecord.isViewDetached(root.data.thread.post.embed.record),
      ).toBe(false)
    })
  })

  describe(`embeddingRules`, () => {
    it(`disables quoteposts`, async () => {
      const quoteePost = await sc.post(users.quotee.did, `post`)
      await pdsAgent.api.app.bsky.feed.postgate.create(
        {
          repo: users.quotee.did,
          rkey: quoteePost.ref.uri.rkey,
        },
        {
          post: quoteePost.ref.uriStr,
          createdAt: new Date().toISOString(),
          embeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
        },
        sc.getHeaders(users.quotee.did),
      )
      await network.processAll()

      const root = await agent.api.app.bsky.feed.getPostThread(
        { uri: quoteePost.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            users.viewer.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      expect(
        // @ts-ignore I know more than you
        root.data.thread.post.viewer.embeddingDisabled,
      ).toBe(true)
    })

    it(`quotepost created after quotes disabled hides embed`, async () => {
      const quoteePost = await sc.post(users.quotee.did, `post`)
      await pdsAgent.api.app.bsky.feed.postgate.create(
        {
          repo: users.quotee.did,
          rkey: quoteePost.ref.uri.rkey,
        },
        {
          post: quoteePost.ref.uriStr,
          createdAt: new Date().toISOString(),
          embeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
        },
        sc.getHeaders(users.quotee.did),
      )
      await network.processAll()

      const quoterPost = await sc.post(
        users.quoter.did,
        `quote post`,
        undefined,
        undefined,
        quoteePost.ref,
      )
      await network.processAll()

      const root = await agent.api.app.bsky.feed.getPostThread(
        { uri: quoterPost.ref.uriStr },
        {
          headers: await network.serviceHeaders(
            users.viewer.did,
            ids.AppBskyFeedGetPostThread,
          ),
        },
      )

      expect(
        // @ts-ignore I know more than you
        AppBskyEmbedRecord.isViewDetached(root.data.thread.post.embed.record),
      ).toBe(true)
    })
  })
})
