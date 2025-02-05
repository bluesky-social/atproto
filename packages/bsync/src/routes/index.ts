import { ConnectRouter } from '@connectrpc/connect'
import { sql } from 'kysely'
import { AppContext } from '../context'
import { Service } from '../proto/bsync_connect'
import addMuteOperation from './add-mute-operation'
import addNotifOperation from './add-notif-operation'
import scanMuteOperations from './scan-mute-operations'
import scanNotifOperations from './scan-notif-operations'

export default (ctx: AppContext) => (router: ConnectRouter) => {
  return router.service(Service, {
    ...addMuteOperation(ctx),
    ...scanMuteOperations(ctx),
    ...addNotifOperation(ctx),
    ...scanNotifOperations(ctx),
    async ping() {
      const { db } = ctx
      await sql`select 1`.execute(db.db)
      return {}
    },
  })
}
