import { Selectable } from 'kysely'
import { Cid as Cid } from '@atproto/lex-data'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { app } from '../../../../lexicons'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

type IndexedVerification = Selectable<DatabaseSchemaType['verification']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: Cid,
  obj: app.bsky.graph.verification.Main,
  timestamp: string,
): Promise<IndexedVerification | null> => {
  const inserted = await db
    .insertInto('verification')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      rkey: uri.rkey,
      creator: uri.host,
      subject: obj.subject,
      handle: obj.handle,
      displayName: obj.displayName,
      createdAt: normalizeDatetimeAlways(obj.createdAt),
      indexedAt: timestamp,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (
  db: DatabaseSchema,
  uri: AtUri,
  obj: app.bsky.graph.verification.Main,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('verification')
    .where('subject', '=', obj.subject)
    .where('creator', '=', uri.host)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const notifsForInsert = (obj: IndexedVerification) => {
  return [
    {
      did: obj.subject,
      author: obj.creator,
      recordUri: obj.uri,
      recordCid: obj.cid,
      reason: 'verified' as const,
      reasonSubject: null,
      sortAt: obj.sortedAt,
    },
  ]
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedVerification | null> => {
  const deleted = await db
    .deleteFrom('verification')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = (
  deleted: IndexedVerification,
  _replacedBy: IndexedVerification | null,
) => {
  return {
    notifs: [
      {
        did: deleted.subject,
        author: deleted.creator,
        recordUri: deleted.uri,
        recordCid: deleted.cid,
        reason: 'unverified' as const,
        reasonSubject: null,
        sortAt: new Date().toISOString(),
      },
    ],
    toDelete: [],
  }
}

export type PluginType = ReturnType<typeof makePlugin>
export const makePlugin = (db: Database, background: BackgroundQueue) => {
  return new RecordProcessor(db, background, {
    schema: app.bsky.graph.verification.main,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
