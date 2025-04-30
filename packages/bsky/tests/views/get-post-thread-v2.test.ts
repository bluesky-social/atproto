import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'

import {
  seed as getPostThreadV2Seed,
  Seed,
} from '../seed/get-post-thread-v2.seed'
import { mockClientData, ThreadPost } from './get-post-thread-v2.util'
import { ids } from '../../src/lexicon/lexicons'

describe('appview thread views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  let seed: Seed

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_get_post_thread_v_two',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()

    try {
      seed = await getPostThreadV2Seed(sc)
    } catch (e) {
      console.error('Error seeding data:', e)
      throw e
    }
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches deep post thread', async () => {
    const { data } = await agent.app.bsky.feed.getPostThread(
      { uri: seed.posts.root.ref.uriStr },
      {
        headers: await network.serviceHeaders(
          seed.users.opp.did,
          ids.AppBskyFeedGetPostThread,
        ),
      },
    )

    const v1Skeleton = mockClientData(data.thread, {
      viewerDid: seed.users.opp.did,
      sort: 'hotness',
      prioritizeFollowedUsers: true,
    })

    const selfThreadPosts = (v1Skeleton?.replies || []).filter(
      (r) => 'type' in r && r.type === 'post' && r.ctx.isSelfThread,
    ) as ThreadPost[]
    expect(selfThreadPosts).toHaveLength(2)
  })
})
