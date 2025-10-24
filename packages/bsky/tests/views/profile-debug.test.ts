import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

describe('profile views w/ debug field', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_profile_debug',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterEach(() => {
    network.bsky.ctx.cfg.debugFieldAllowedDids.clear()
  })

  afterAll(async () => {
    await network.close()
  })

  it(`does not include debug field for unauthed requests`, async () => {
    network.bsky.ctx.cfg.debugFieldAllowedDids.add(sc.dids.bob)

    const { data: profile } = await agent.api.app.bsky.actor.getProfile({
      actor: sc.dids.alice,
    })

    expect(profile.debug).not.toBeDefined()
  })

  it(`includes debug field for configured user`, async () => {
    network.bsky.ctx.cfg.debugFieldAllowedDids.add(sc.dids.bob)

    const { data: profile } = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyActorGetProfile,
        ),
      },
    )

    expect(profile.debug).toBeDefined()
    expect(typeof profile.debug).toBe('object')
  })

  it(`doesn't include debug field for other users`, async () => {
    network.bsky.ctx.cfg.debugFieldAllowedDids.add(sc.dids.carol)

    const { data: profile } = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyActorGetProfile,
        ),
      },
    )

    expect(profile.debug).not.toBeDefined()
  })
})
