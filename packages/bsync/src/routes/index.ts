import { ConnectRouter } from '@connectrpc/connect'
import { sql } from 'kysely'
import { AppContext } from '../context'
import { Service } from '../proto/bsync_connect'
import addMuteOperation from './add-mute-operation'
import addNotifOperation from './add-notif-operation'
import putOperation from './put-operation'
import scanMuteOperations from './scan-mute-operations'
import scanNotifOperations from './scan-notif-operations'
import scanOperations from './scan-operations'

export default (ctx: AppContext) => (router: ConnectRouter) => {
  return router.service(Service, {
    ...addMuteOperation(ctx),
    ...scanMuteOperations(ctx),
    ...addNotifOperation(ctx),
    ...scanNotifOperations(ctx),
    ...putOperation(ctx),
    ...scanOperations(ctx),
    async ping() {
      const { db } = ctx
      await sql`select 1`.execute(db.db)
      return {}
    },
  })
}
