import { sql } from 'kysely'
import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect'
import { Service } from '../gen/bsky_sync_connect'
import {
  AddMuteOperationResponse,
  MuteOperation_Type,
} from '../gen/bsky_sync_pb'
import { Database } from '../db'

export default (db: Database) => (router: ConnectRouter) => {
  return router.service(Service, {
    async addMuteOperation(req) {
      const { type, actorDid, subject } = validMuteOp(req)
      const { ref } = db.db.dynamic
      const id = await db.transaction(async (txn) => {
        const { id } = await txn.db
          .insertInto('mute_op')
          .values({
            type,
            actorDid,
            subject,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
        if (type === MuteOperation_Type.ADD) {
          await txn.db
            .insertInto('mute_item')
            .values({
              actorDid,
              subject,
              fromId: id,
            })
            .onConflict((oc) =>
              oc
                .constraint('mute_op_pkey')
                .doUpdateSet({ fromId: sql`${ref('excluded.fromId')}` }),
            )
            .execute()
        } else if (type === MuteOperation_Type.REMOVE) {
          await txn.db
            .deleteFrom('mute_item')
            .where('actorDid', '=', actorDid)
            .where('subject', '=', subject)
            .execute()
        } else if (type === MuteOperation_Type.CLEAR) {
          await txn.db
            .deleteFrom('mute_item')
            .where('actorDid', '=', actorDid)
            .execute()
        } else {
          const exhaustiveCheck: never = type
          throw new Error(`unreachable: ${exhaustiveCheck}`)
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
      await sql`select 1`.execute(db.db)
      return {}
    },
  })
}

const validMuteOp = <T extends MuteOpFields>(op: T): T => {
  if (!Object.values(MuteOperation_Type).includes(op.type)) {
    throw new ConnectError('bad mute operation type', Code.InvalidArgument)
  }
  if (op.type === MuteOperation_Type.CLEAR) {
    if (op.subject !== '') {
      throw new ConnectError(
        'subject must not be set on a clear op',
        Code.InvalidArgument,
      )
    }
  } else {
    // @TODO validate with syntax package, check collection type
    if (!op.subject.startsWith('at://') && !op.subject.startsWith('did:')) {
      throw new ConnectError(
        'subject must be a did or aturi on add or remove op',
        Code.InvalidArgument,
      )
    }
  }
  return op
}

type MuteOpFields = {
  id?: string
  type: MuteOperation_Type
  actorDid: string
  subject: string
}
