import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import * as lex from '../../../../lexicon/lexicons'
import * as Verification from '../../../../lexicon/types/app/bsky/graph/verification'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

const lexId = lex.ids.AppBskyGraphVerification
type IndexedVerification = Selectable<DatabaseSchemaType['verification']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Verification.Record,
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
  obj: Verification.Record,
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

export type PluginType = RecordProcessor<
  Verification.Record,
  IndexedVerification
>

export const makePlugin = (
  db: Database,
  background: BackgroundQueue,
): PluginType => {
  return new RecordProcessor(db, background, {
    lexId,
    insertFn,
    findDuplicate,
    deleteFn,
    notifsForInsert,
    notifsForDelete,
  })
}

export default makePlugin
