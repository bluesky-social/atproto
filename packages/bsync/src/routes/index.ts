import { sql } from 'kysely'
import { ConnectRouter } from '@connectrpc/connect'
import { Service } from '../gen/bsync_connect'
import AppContext from '../context'
import addMuteOperation from './add-mute-operation'
import scanMuteOperations from './scan-mute-operations'

export default (ctx: AppContext) => (router: ConnectRouter) => {
  return router.service(Service, {
    ...addMuteOperation(ctx),
    ...scanMuteOperations(ctx),
    async ping() {
      const { db } = ctx
      await sql`select 1`.execute(db.db)
      return {}
    },
  })
}
