import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_pb.js'
import { Database } from '../db/index.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActorTakedown(req) {
    const { did } = req
    const res = await db.db
      .selectFrom('actor')
      .where('did', '=', did)
      .select('takedownRef')
      .executeTakeFirst()
    return {
      takenDown: !!res?.takedownRef,
      takedownRef: res?.takedownRef || undefined,
    }
  },

  async getBlobTakedown(req) {
    const { did, cid } = req
    const res = await db.db
      .selectFrom('blob_takedown')
      .where('did', '=', did)
      .where('cid', '=', cid)
      .select('takedownRef')
      .executeTakeFirst()
    return {
      takenDown: !!res,
      takedownRef: res?.takedownRef || undefined,
    }
  },

  async getRecordTakedown(req) {
    const { recordUri } = req
    const res = await db.db
      .selectFrom('record')
      .where('uri', '=', recordUri)
      .select('takedownRef')
      .executeTakeFirst()
    return {
      takenDown: !!res?.takedownRef,
      takedownRef: res?.takedownRef || undefined,
    }
  },

  async takedownActor(req) {
    const { did, ref } = req
    await db.db
      .updateTable('actor')
      .set({ takedownRef: ref || 'TAKEDOWN' })
      .where('did', '=', did)
      .execute()
    return {}
  },

  async takedownBlob(req) {
    const { did, cid, ref } = req
    await db.db
      .insertInto('blob_takedown')
      .values({
        did,
        cid,
        takedownRef: ref || 'TAKEDOWN',
      })
      .execute()
    return {}
  },

  async takedownRecord(req) {
    const { recordUri, ref } = req
    await db.db
      .updateTable('record')
      .set({ takedownRef: ref || 'TAKEDOWN' })
      .where('uri', '=', recordUri)
      .execute()
    return {}
  },

  async untakedownActor(req) {
    const { did } = req
    await db.db
      .updateTable('actor')
      .set({ takedownRef: null })
      .where('did', '=', did)
      .execute()
    return {}
  },

  async untakedownBlob(req) {
    const { did, cid } = req
    await db.db
      .deleteFrom('blob_takedown')
      .where('did', '=', did)
      .where('cid', '=', cid)
      .executeTakeFirst()
    return {}
  },

  async untakedownRecord(req) {
    const { recordUri } = req
    await db.db
      .updateTable('record')
      .set({ takedownRef: null })
      .where('uri', '=', recordUri)
      .execute()
    return {}
  },
})
