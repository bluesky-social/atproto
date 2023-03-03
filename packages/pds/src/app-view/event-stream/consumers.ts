import AppContext from '../../context'
import Database from '../../db'
import {
  DeleteRecord,
  IndexRecord,
  DeleteRepo,
} from '../../event-stream/messages'

// Used w/ in-process PDS as alternative to the repo subscription
export const listen = (ctx: AppContext) => {
  ctx.messageDispatcher.listen('index_record', {
    async listener(input: { db: Database; message: IndexRecord }) {
      const { db, message } = input
      const indexingService = ctx.services.appView.indexing(db)
      await indexingService.indexRecord(
        message.uri,
        message.cid,
        message.obj,
        message.action,
        message.timestamp,
      )
    },
  })
  ctx.messageDispatcher.listen('delete_record', {
    async listener(input: { db: Database; message: DeleteRecord }) {
      const { db, message } = input
      const indexingService = ctx.services.appView.indexing(db)
      await indexingService.deleteRecord(message.uri, message.cascading)
    },
  })
  ctx.messageDispatcher.listen('delete_repo', {
    async listener(input: { db: Database; message: DeleteRepo }) {
      const { db, message } = input
      const indexingService = ctx.services.appView.indexing(db)
      await indexingService.deleteForUser(message.did)
    },
  })
}
