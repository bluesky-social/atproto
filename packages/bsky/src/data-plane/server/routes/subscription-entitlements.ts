import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async setSubscriptionEntitlement(req) {
    const { subscriptionEntitlement } = req

    if (!subscriptionEntitlement) {
      return {}
    }

    const { did, entitlements } = subscriptionEntitlement

    if (!did) {
      return {}
    }

    if (!entitlements?.length) {
      await db.db
        .deleteFrom('subscription_entitlement')
        .where('did', '=', did)
        .execute()

      return {}
    }

    await db.db
      .insertInto('subscription_entitlement')
      .values({ did, entitlements: JSON.stringify(entitlements) })
      .onConflict((oc) =>
        oc
          .column('did')
          .doUpdateSet({ entitlements: JSON.stringify(entitlements) }),
      )
      .execute()

    return {}
  },
})
