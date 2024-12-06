import { sql } from 'kysely'
import { ConnectRouter } from '@connectrpc/connect'
import { Service } from '../proto/bsync_connect'
import AppContext from '../context'
import addMuteOperation from './add-mute-operation'
import scanMuteOperations from './scan-mute-operations'
import addNotifOperation from './add-notif-operation'
import scanNotifOperations from './scan-notif-operations'
import addPurchaseOperation from './add-purchase-operation'
import getSubscriptions from './get-subscriptions'
import getSubscriptionGroup from './get-subscription-group'

export default (ctx: AppContext) => (router: ConnectRouter) => {
  return router.service(Service, {
    ...addMuteOperation(ctx),
    ...scanMuteOperations(ctx),
    ...addNotifOperation(ctx),
    ...scanNotifOperations(ctx),
    ...addPurchaseOperation(ctx),
    ...getSubscriptions(ctx),
    ...getSubscriptionGroup(ctx),
    async ping() {
      const { db } = ctx
      await sql`select 1`.execute(db.db)
      return {}
    },
  })
}
