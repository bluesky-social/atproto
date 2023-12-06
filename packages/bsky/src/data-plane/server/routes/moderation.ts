import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'
import { sql } from 'kysely'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getBlobTakedown(req) {
    const { cid } = req
    const takedown = await db.db
      .selectFrom('moderation_subject_status')
      .select('id')
      .where('blobCids', '@>', sql`CAST(${JSON.stringify([cid])} AS JSONB)`)
      .where('takendown', 'is', true)
      .executeTakeFirst()
    return {
      takenDown: !!takedown,
    }
  },

  async updateTakedown(_req) {
    throw new Error('unimplemented')
  },
})
