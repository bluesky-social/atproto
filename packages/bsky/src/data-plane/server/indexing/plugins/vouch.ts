import { Selectable } from 'kysely'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { CID } from 'multiformats/cid'
import * as Vouch from '../../../../lexicon/types/app/bsky/graph/vouch'
import * as lex from '../../../../lexicon/lexicons'
import RecordProcessor from '../processor'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { BackgroundQueue } from '../../background'

const lexId = lex.ids.AppBskyGraphVouch
type IndexedVouch = Selectable<DatabaseSchemaType['vouch']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: Vouch.Record,
  timestamp: string,
): Promise<IndexedVouch | null> => {
  const inserted = await db
    .insertInto('vouch')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectDid: obj.subject,
      relationship: obj.relationship,
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
  obj: Vouch.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('vouch')
    .where('creator', '=', uri.host)
    .where('subjectDid', '=', obj.subject)
    .where('relationship', '=', obj.relationship)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const notifsForInsert = (obj: IndexedVouch) => {
  return [
    {
      did: obj.subjectDid,
      author: obj.creator,
      recordUri: obj.uri,
      recordCid: obj.cid,
      reason: 'vouch' as const,
      reasonSubject: null,
      sortAt: obj.sortAt,
    },
  ]
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedVouch | null> => {
  const deleted = await db
    .deleteFrom('vouch')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = (
  deleted: IndexedVouch,
  replacedBy: IndexedVouch | null,
) => {
  const toDelete = replacedBy ? [] : [deleted.uri]
  return { notifs: [], toDelete }
}

export type PluginType = RecordProcessor<Vouch.Record, IndexedVouch>

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
