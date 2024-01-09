import { sql } from 'kysely'
import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect'
import { Service } from '../gen/bsky_sync_connect'
import {
  AddMuteOperationResponse,
  MuteOperation_Type,
  ScanMuteOperationsResponse,
} from '../gen/bsky_sync_pb'
import AppContext from '../context'
import { createMuteOpChannel } from '../db/schema/mute_op'
import { authWithApiKey } from './auth'
import { once } from 'node:events'

export default (ctx: AppContext) => (router: ConnectRouter) => {
  return router.service(Service, {
    async addMuteOperation(req, handlerCtx) {
      authWithApiKey(ctx, handlerCtx)
      const { db } = ctx
      const { type, actorDid, subject } = validMuteOp(req)
      const { ref } = db.db.dynamic
      const id = await db.transaction(async (txn) => {
        // log op
        const { id } = await txn.db
          .insertInto('mute_op')
          .values({
            type,
            actorDid,
            subject,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
        // update mute state
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
        // notify
        await sql`notify ${createMuteOpChannel}`.execute(txn.db)
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
    async scanMuteOperations(req, handlerCtx) {
      authWithApiKey(ctx, handlerCtx)
      const { db, events } = ctx
      const limit = req.limit || 1000
      const cursor = validCursor(req.cursor)
      const nextMuteOpPromise = once(events, createMuteOpChannel, {
        signal: AbortSignal.timeout(10000),
      })
      nextMuteOpPromise.catch(() => null) // ensure timeout is always handled

      const nextMuteOpPageQb = db.db
        .selectFrom('mute_op')
        .selectAll()
        .where('id', '>', cursor ?? -1)
        .orderBy('id', 'asc')
        .limit(limit)

      let ops = await nextMuteOpPageQb.execute()

      if (!ops.length) {
        // if there were no ops on the page, wait for an event then try again.
        try {
          await nextMuteOpPromise
        } catch (err) {
          return new ScanMuteOperationsResponse({
            operations: [],
            cursor: req.cursor,
          })
        }
        ops = await nextMuteOpPageQb.execute()
        if (!ops.length) {
          return new ScanMuteOperationsResponse({
            operations: [],
            cursor: req.cursor,
          })
        }
      }

      const lastOp = ops[ops.length - 1]

      return new ScanMuteOperationsResponse({
        operations: ops.map((op) => ({
          id: op.id.toString(),
          type: op.type,
          actorDid: op.actorDid,
          subject: op.subject,
        })),
        cursor: lastOp.id.toString(),
      })
    },
    async ping() {
      const { db } = ctx
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

const validCursor = (cursor: string): number | null => {
  if (cursor === '') return null
  const int = parseInt(cursor, 10)
  if (isNaN(int) || int < 0) {
    throw new ConnectError('invalid cursor', Code.InvalidArgument)
  }
  return int
}

type MuteOpFields = {
  id?: string
  type: MuteOperation_Type
  actorDid: string
  subject: string
}
