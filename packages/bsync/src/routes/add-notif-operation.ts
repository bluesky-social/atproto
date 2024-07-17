import { sql } from 'kysely'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../proto/bsync_connect'
import {
  AddNotifOperationResponse,
  NotifOperation_Setting,
} from '../proto/bsync_pb'
import AppContext from '../context'
import { authWithApiKey } from './auth'
import Database from '../db'
import { createNotifOpChannel } from '../db/schema/notif_op'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async addNotifOperation(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { db } = ctx
    const { actorDid, setting } = req
    const id = await db.transaction(async (txn) => {
      // create notif op
      const id = await createNotifOp(txn, actorDid, setting)
      // update notif state
      if (
        [
          NotifOperation_Setting.UNFILTERED,
          NotifOperation_Setting.PRIORITY,
        ].includes(setting)
      ) {
        await updateNotifItem(txn, id, actorDid, setting)
      }
      return id
    })
    return new AddNotifOperationResponse({
      operation: {
        id: String(id),
        actorDid,
        setting,
      },
    })
  },
})

const createNotifOp = async (
  db: Database,
  actorDid: string,
  setting: NotifOperation_Setting,
) => {
  const { ref } = db.db.dynamic
  const { id } = await db.db
    .insertInto('notif_op')
    .values({
      actorDid,
      setting,
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
  setting: NotifOperation_Setting,
) => {
  const { ref } = db.db.dynamic
  await db.db
    .insertInto('notif_item')
    .values({
      actorDid,
      setting,
      fromId,
    })
    .onConflict((oc) =>
      oc
        .column('actorDid')
        .doUpdateSet({ fromId: sql`${ref('excluded.fromId')}` }),
    )
    .execute()
}
