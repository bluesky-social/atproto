import { ConnectRouter } from '@connectrpc/connect'
import { Service } from '../gen/bsky_sync_connect'
import { Database } from '../db'
import {
  AddMuteOperationResponse,
  MuteOperation_Type,
} from '../gen/bsky_sync_pb'

export default (db: Database) => (router: ConnectRouter) =>
  router.service(Service, {
    async addMuteOperation(req) {
      const id = await db.transaction(async (txn) => {
        const { id } = await txn.db
          .insertInto('mute_op')
          .values({
            op: opTypeProtoToDb(req.type),
            did: req.actorDid,
            subject: req.subject, // @ TODO empty for clear op
          })
          .returning('id')
          .executeTakeFirstOrThrow()
        if (req.type === MuteOperation_Type.ADD) {
          await txn.db
            .insertInto('mute_item')
            .values({
              did: req.actorDid,
              subject: req.subject,
              fromId: id,
            })
            .onConflict((oc) => oc.doNothing()) // @TODO update fromId
            .execute()
        } else if (req.type === MuteOperation_Type.REMOVE) {
          await txn.db
            .deleteFrom('mute_item')
            .where('did', '=', req.actorDid)
            .where('subject', '=', req.subject)
            .execute()
        } else if (req.type === MuteOperation_Type.CLEAR) {
          await txn.db
            .deleteFrom('mute_item')
            .where('did', '=', req.actorDid)
            .execute()
        } else {
          throw new Error('TODO')
        }
        return id
      })
      return new AddMuteOperationResponse({
        operation: {
          id: String(id),
          type: req.type,
          actorDid: req.actorDid,
          subject: req.subject,
        },
      })
    },
    async scanMuteOperations() {
      throw new Error('unimplemented')
    },
    async ping() {
      return {}
    },
  })

const opTypeProtoToDb = (type: MuteOperation_Type) => {
  if (type === MuteOperation_Type.ADD) {
    return 'add'
  } else if (type === MuteOperation_Type.REMOVE) {
    return 'remove'
  } else if (type === MuteOperation_Type.CLEAR) {
    return 'clear'
  } else {
    throw new Error('unreachable') // @TODO
  }
}
