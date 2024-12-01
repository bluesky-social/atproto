import { AtUri, AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

describe('subscriptions views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_subscriptions',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns features for user with subscription', async () => {
    await network.bsky.db.db
      .insertInto('subscription_entitlement')
      .values({ did: alice, entitlements: JSON.stringify(['core']) })
      .execute()

    const {
      data: { features },
    } = await agent.app.bsky.subscription.getSubscriptionFeatures(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskySubscriptionGetSubscriptionFeatures,
        ),
      },
    )

    expect(features).toStrictEqual({ customProfileColor: true })
  })

  it('returns features for user without subscription', async () => {
    const {
      data: { features },
    } = await agent.app.bsky.subscription.getSubscriptionFeatures(
      {},
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskySubscriptionGetSubscriptionFeatures,
        ),
      },
    )

    expect(features).toStrictEqual({ customProfileColor: false })
  })
})
