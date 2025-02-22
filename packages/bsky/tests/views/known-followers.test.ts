import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { knownFollowersSeed } from '../seed/known-followers'

describe('known followers (social proof)', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let seedClient: SeedClient

  let dids: Record<string, string>

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_known_followers',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    seedClient = network.getSeedClient()

    await knownFollowersSeed(seedClient)

    dids = seedClient.dids

    /*
     * First-party block
     */
    await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dids.fp_block_view },
      { createdAt: new Date().toISOString(), subject: dids.fp_block_res_1 },
      seedClient.getHeaders(dids.fp_block_view),
    )

    /*
     * Second-party block
     */
    await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dids.sp_block_sub },
      { createdAt: new Date().toISOString(), subject: dids.sp_block_res_1 },
      seedClient.getHeaders(dids.sp_block_sub),
    )

    /*
     * Mix of blocks and non
     */
    await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dids.mix_view },
      { createdAt: new Date().toISOString(), subject: dids.mix_fp_block_res },
      seedClient.getHeaders(dids.mix_view),
    )
    await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dids.mix_sub_1 },
      { createdAt: new Date().toISOString(), subject: dids.mix_sp_block_res },
      seedClient.getHeaders(dids.mix_sub_1),
    )

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  /*
   * Note that this test arbitrarily uses `getFollows` bc atm it returns
   * `ProfileViewBasic`. This method could be updated one day to return
   * `knownFollowers`, in which case this test would begin failing.
   */
  it('basic profile views do not return knownFollowers', async () => {
    const { data } = await agent.api.app.bsky.graph.getFollows(
      { actor: dids.base_res_1 },
      {
        headers: await network.serviceHeaders(
          dids.base_view,
          ids.AppBskyGraphGetFollows,
        ),
      },
    )
    const follow = data.follows[0]

    expect(follow.viewer?.knownFollowers).toBeFalsy()
  })

  it('getKnownFollowers: returns data', async () => {
    const { data } = await agent.api.app.bsky.graph.getKnownFollowers(
      { actor: dids.base_sub },
      {
        headers: await network.serviceHeaders(
          dids.base_view,
          ids.AppBskyGraphGetKnownFollowers,
        ),
      },
    )

    expect(data.subject.did).toBe(dids.base_sub)
    expect(data.followers.length).toBe(1)
    expect(data.followers[0].did).toBe(dids.base_res_1)
  })

  it('getProfile: returns knownFollowers', async () => {
    const { data } = await agent.api.app.bsky.actor.getProfile(
      { actor: dids.base_sub },
      {
        headers: await network.serviceHeaders(
          dids.base_view,
          ids.AppBskyActorGetProfile,
        ),
      },
    )

    const knownFollowers = data.viewer?.knownFollowers
    expect(knownFollowers?.count).toBe(1)
    expect(knownFollowers?.followers).toHaveLength(1)
    expect(knownFollowers?.followers[0].did).toBe(dids.base_res_1)
  })

  it('getProfile: filters 1st-party blocks', async () => {
    const { data } = await agent.api.app.bsky.actor.getProfile(
      { actor: dids.fp_block_sub },
      {
        headers: await network.serviceHeaders(
          dids.fp_block_view,
          ids.AppBskyActorGetProfile,
        ),
      },
    )

    const knownFollowers = data.viewer?.knownFollowers
    expect(knownFollowers?.count).toBe(1)
    expect(knownFollowers?.followers).toHaveLength(0)
  })

  it('getProfile: filters second-party blocks', async () => {
    const result = await agent.api.app.bsky.actor.getProfile(
      { actor: dids.sp_block_sub },
      {
        headers: await network.serviceHeaders(
          dids.sp_block_view,
          ids.AppBskyActorGetProfile,
        ),
      },
    )

    const knownFollowers = result.data.viewer?.knownFollowers
    expect(knownFollowers?.count).toBe(1)
    expect(knownFollowers?.followers).toHaveLength(0)
  })

  it('getProfiles: filters second-party blocks', async () => {
    const result = await agent.api.app.bsky.actor.getProfiles(
      { actors: [dids.sp_block_sub] },
      {
        headers: await network.serviceHeaders(
          dids.sp_block_view,
          ids.AppBskyActorGetProfiles,
        ),
      },
    )

    expect(result.data.profiles).toHaveLength(1)
    const profile = result.data.profiles[0]
    const knownFollowers = profile.viewer?.knownFollowers
    expect(knownFollowers?.count).toBe(1)
    expect(knownFollowers?.followers).toHaveLength(0)
  })

  it('getProfiles: mix of results', async () => {
    const result = await agent.api.app.bsky.actor.getProfiles(
      { actors: [dids.mix_sub_1, dids.mix_sub_2, dids.mix_sub_3] },
      {
        headers: await network.serviceHeaders(
          dids.mix_view,
          ids.AppBskyActorGetProfiles,
        ),
      },
    )

    expect(result.data.profiles).toHaveLength(3)

    const [sub_1, sub_2, sub_3] = result.data.profiles

    const sub_1_kf = sub_1.viewer?.knownFollowers
    expect(sub_1_kf?.count).toBe(3)
    expect(sub_1_kf?.followers).toHaveLength(1)

    const sub_2_kf = sub_2.viewer?.knownFollowers
    expect(sub_2_kf?.count).toBe(3)
    expect(sub_2_kf?.followers).toHaveLength(2)

    const sub_3_kf = sub_3.viewer?.knownFollowers
    expect(sub_3_kf?.count).toBe(3)
    expect(sub_3_kf?.followers).toHaveLength(2)
  })
})
