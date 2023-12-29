import { sql } from 'kysely'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../db'
import { didFromUri } from '../../../hydration/util'

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

  async updateTakedown(req) {
    const { actorDid, recordUri, blobCid, takenDown } = req
    const now = new Date()
    if (actorDid && !blobCid) {
      if (takenDown) {
        const { id } = await db.db
          .insertInto('moderation_event')
          .values({
            action: 'com.atproto.admin.defs#modEventTakedown',
            subjectDid: actorDid,
            subjectType: 'com.atproto.admin.defs#repoRef',
            createdAt: now.toISOString(),
            createdBy: 'admin',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
        await db.db
          .updateTable('actor')
          .set({ takedownId: id })
          .where('did', '=', actorDid)
          .execute()
      } else {
        await db.db
          .updateTable('actor')
          .set({ takedownId: null })
          .where('did', '=', actorDid)
          .execute()
      }
    }

    if (actorDid && blobCid) {
      if (takenDown) {
        await db.db
          .insertInto('moderation_subject_status')
          .values({
            did: actorDid,
            blobCids: [blobCid],
            recordPath: '',
            takendown: true,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            reviewState: 'com.atproto.admin.defs#reviewOpen',
          })
          .execute()
      } else {
        await db.db
          .deleteFrom('moderation_subject_status')
          .where('did', '=', actorDid)
          .where(
            'blobCids',
            '@>',
            sql`CAST(${JSON.stringify([blobCid])} AS JSONB)`,
          )
          .executeTakeFirst()
      }
    }

    if (recordUri) {
      if (takenDown) {
        const { id } = await db.db
          .insertInto('moderation_event')
          .values({
            action: 'com.atproto.admin.defs#modEventTakedown',
            subjectDid: didFromUri(recordUri),
            subjectUri: recordUri,
            subjectType: 'com.atproto.repo.strongRef',
            createdAt: now.toISOString(),
            createdBy: 'admin',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
        await db.db
          .updateTable('record')
          .set({ takedownId: id })
          .where('uri', '=', recordUri)
          .execute()
      } else {
        await db.db
          .updateTable('record')
          .set({ takedownId: null })
          .where('uri', '=', recordUri)
          .execute()
      }
    }
  },
})
