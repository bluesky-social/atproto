import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

jest.mock('../../dist/hydration/util.js', () => {
  const originalModule = jest.requireActual('../../src/hydration/util.ts')
  return {
    ...originalModule,
    isDebugFieldAllowed: jest.fn(() => true),
  }
})

describe('profile views w/ debug field', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_profile',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  it('does not include debug field for unauthed requests', async () => {
    const { data: profile } = await agent.api.app.bsky.actor.getProfile({
      actor: sc.dids.alice,
    })

    expect(profile.debug).not.toBeDefined()
  })

  it('includes debug field', async () => {
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
})
