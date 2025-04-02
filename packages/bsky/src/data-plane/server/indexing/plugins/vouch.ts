import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import * as lex from '../../../../lexicon/lexicons'
import * as Vouch from '../../../../lexicon/types/app/bsky/graph/vouch'
import { BackgroundQueue } from '../../background'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { RecordProcessor } from '../processor'

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
  obj: Vouch.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('vouch')
    .where('creator', '=', uri.host)
    .where('subject', '=', obj.subject)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

// @TODO: revisit.
const notifsForInsert = (_obj: IndexedVouch) => {
  return []
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

// @TODO: revisit.
const notifsForDelete = (
  _deleted: IndexedVouch,
  _replacedBy: IndexedVouch | null,
) => {
  return { notifs: [], toDelete: [] }
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
