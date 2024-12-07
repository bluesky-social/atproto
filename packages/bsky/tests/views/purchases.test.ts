import { AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

describe('purchases', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_purchases',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()

    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  describe('purchase cached data', () => {
    it('returns false for features if user has no cached entitlements', async () => {
      const { data } = await agent.app.bsky.purchase.getFeatures(
        {},
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyPurchaseGetFeatures,
          ),
        },
      )

      expect(data).toStrictEqual({
        features: {
          customProfileColor: false,
        },
      })
    })

    it('refreshes the purchase cache and returns true for features if user has cached entitlement', async () => {
      await agent.app.bsky.purchase.refreshCache(
        { did: alice },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyPurchaseRefreshCache,
          ),
        },
      )

      const { data } = await agent.app.bsky.purchase.getFeatures(
        {},
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyPurchaseGetFeatures,
          ),
        },
      )

      expect(data).toStrictEqual({
        features: {
          customProfileColor: true,
        },
      })
    })

    it('returns the active subscriptions for the account', async () => {
      const { data } = await agent.app.bsky.purchase.getActiveSubscriptions(
        {},
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyPurchaseGetActiveSubscriptions,
          ),
        },
      )

      expect(data).toStrictEqual({
        subscriptions: [
          {
            status: 'active',
            renewalStatus: 'will_renew',
            group: 'core',
            platform: 'web',
            offering: 'coreMonthly',
            periodEndsAt: '2025-01-03T18:31:27.000Z',
            periodStartsAt: '2024-12-03T18:31:27.000Z',
            purchasedAt: '2024-12-03T18:31:27.000Z',
          },
        ],
      })
    })

    it('returns the subscription group for the group ID and platform', async () => {
      const { data } = await agent.app.bsky.purchase.getSubscriptionGroup(
        { group: 'core', platform: 'ios' },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyPurchaseGetSubscriptionGroup,
          ),
        },
      )

      expect(data).toStrictEqual({
        group: 'core',
        offerings: [
          {
            id: 'coreMonthly',
            platform: 'ios',
            product: 'bluesky_plus_core_v1_monthly',
          },
          {
            id: 'coreAnnual',
            platform: 'ios',
            product: 'bluesky_plus_core_v1_annual',
          },
        ],
      })
    })
  })
})
