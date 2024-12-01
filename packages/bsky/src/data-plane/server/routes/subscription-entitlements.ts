import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getSubscriptionEntitlement(req) {
    const { dids } = req

    return {
      subscriptionEntitlements: await db.db
        .selectFrom('subscription_entitlement')
        .selectAll()
        .where('did', 'in', dids ?? [])
        .execute(),
    }
  },

  async setSubscriptionEntitlement(req) {
    const { did, entitlements } = req

    if (!did || !entitlements) {
      return {}
    }

    await db.db
      .insertInto('subscription_entitlement')
      .values({
        did,
        entitlements: JSON.stringify(entitlements),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({
          entitlements: JSON.stringify(entitlements),
          updatedAt: new Date().toISOString(),
        }),
      )
      .execute()

    return {}
  },
})
