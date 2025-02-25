import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { AppContext } from '../context'
import { Database } from '../db'
import { createNotifOpChannel } from '../db/schema/notif_op'
import { Service } from '../proto/bsync_connect'
import { AddNotifOperationResponse } from '../proto/bsync_pb'
import { authWithApiKey } from './auth'
import { isValidDid } from './util'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async addNotifOperation(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { db } = ctx
    const { actorDid, priority } = req
    if (!isValidDid(actorDid)) {
      throw new ConnectError(
        'actor_did must be a valid did',
        Code.InvalidArgument,
      )
    }
    const id = await db.transaction(async (txn) => {
      // create notif op
      const id = await createNotifOp(txn, actorDid, priority)
      // update notif state
      if (priority !== undefined) {
        await updateNotifItem(txn, id, actorDid, priority)
      }
      return id
    })
    return new AddNotifOperationResponse({
      operation: {
        id: String(id),
        actorDid,
        priority,
      },
    })
  },
})

const createNotifOp = async (
  db: Database,
  actorDid: string,
  priority: boolean | undefined,
) => {
  const { ref } = db.db.dynamic
  const { id } = await db.db
    .insertInto('notif_op')
    .values({
      actorDid,
      priority,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await sql`notify ${ref(createNotifOpChannel)}`.execute(db.db) // emitted transactionally
  return id
}

const updateNotifItem = async (
  db: Database,
  fromId: number,
  actorDid: string,
  priority: boolean,
) => {
  const { ref } = db.db.dynamic
  await db.db
    .insertInto('notif_item')
    .values({
      actorDid,
      priority,
      fromId,
    })
    .onConflict((oc) =>
      oc.column('actorDid').doUpdateSet({
        priority: sql`${ref('excluded.priority')}`,
        fromId: sql`${ref('excluded.fromId')}`,
      }),
    )
    .execute()
}
