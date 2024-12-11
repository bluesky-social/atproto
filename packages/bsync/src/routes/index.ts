import { sql } from 'kysely'
import { ConnectRouter } from '@connectrpc/connect'
import { Service } from '../proto/bsync_connect'
import AppContext from '../context'
import addMuteOperation from './add-mute-operation'
import scanMuteOperations from './scan-mute-operations'
import addNotifOperation from './add-notif-operation'
import scanNotifOperations from './scan-notif-operations'
import getSubscriptions from './get-subscriptions'
import getSubscriptionGroup from './get-subscription-group'
import refreshPurchases from './refresh-purchases'
import scanPurchaseOperations from './scan-purchase-operations'

export default (ctx: AppContext) => (router: ConnectRouter) => {
  return router.service(Service, {
    ...addMuteOperation(ctx),
    ...scanMuteOperations(ctx),
    ...addNotifOperation(ctx),
    ...scanNotifOperations(ctx),
    ...getSubscriptions(ctx),
    ...getSubscriptionGroup(ctx),
    ...refreshPurchases(ctx),
    ...scanPurchaseOperations(ctx),
    async ping() {
      const { db } = ctx
      await sql`select 1`.execute(db.db)
      return {}
    },
  })
}
