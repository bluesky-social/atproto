import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getBlobTakedown(req) {
    const { actorDid, cid } = req
    const res = await db.db
      .selectFrom('blob_takedown')
      .where('did', '=', actorDid)
      .where('cid', '=', cid)
      .selectAll()
      .executeTakeFirst()
    return {
      takenDown: !!res,
    }
  },

  async updateTakedown(req) {
    const { actorDid, recordUri, blobCid, takenDown } = req
    if (actorDid && !blobCid) {
      if (takenDown) {
        await db.db
          .updateTable('actor')
          .set({ takedownRef: 'TAKEDOWN' })
          .where('did', '=', actorDid)
          .execute()
      } else {
        await db.db
          .updateTable('actor')
          .set({ takedownRef: null })
          .where('did', '=', actorDid)
          .execute()
      }
    }

    if (actorDid && blobCid) {
      if (takenDown) {
        await db.db
          .insertInto('blob_takedown')
          .values({
            did: actorDid,
            cid: blobCid,
            takedownRef: 'TAKEDOWN',
          })
          .execute()
      } else {
        await db.db
          .deleteFrom('blob_takedown')
          .where('did', '=', actorDid)
          .where('cid', '=', blobCid)
          .executeTakeFirst()
      }
    }

    if (recordUri) {
      if (takenDown) {
        await db.db
          .updateTable('record')
          .set({ takedownRef: 'TAKEDOWN' })
          .where('uri', '=', recordUri)
          .execute()
      } else {
        await db.db
          .updateTable('record')
          .set({ takedownRef: null })
          .where('uri', '=', recordUri)
          .execute()
      }
    }
  },
})
