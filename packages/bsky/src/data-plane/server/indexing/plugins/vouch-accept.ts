import { Selectable } from 'kysely'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { CID } from 'multiformats/cid'
import * as VouchAccept from '../../../../lexicon/types/app/bsky/graph/vouchaccept'
import * as lex from '../../../../lexicon/lexicons'
import RecordProcessor from '../processor'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { BackgroundQueue } from '../../background'

const lexId = lex.ids.AppBskyGraphVouchaccept
type IndexedVouchAccept = Selectable<DatabaseSchemaType['vouch_accept']>

const insertFn = async (
  db: DatabaseSchema,
  uri: AtUri,
  cid: CID,
  obj: VouchAccept.Record,
  timestamp: string,
): Promise<IndexedVouchAccept | null> => {
  const inserted = await db
    .insertInto('vouch_accept')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      vouchUri: obj.vouch.uri,
      vouchCid: obj.vouch.cid,
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
  obj: VouchAccept.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('vouch_accept')
    .where('creator', '=', uri.host)
    .where('vouchUri', '=', obj.vouch.uri)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const notifsForInsert = () => {
  return []
}

const deleteFn = async (
  db: DatabaseSchema,
  uri: AtUri,
): Promise<IndexedVouchAccept | null> => {
  const deleted = await db
    .deleteFrom('vouch_accept')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const notifsForDelete = (
  deleted: IndexedVouchAccept,
  replacedBy: IndexedVouchAccept | null,
) => {
  const toDelete = replacedBy ? [] : [deleted.uri]
  return { notifs: [], toDelete }
}

export type PluginType = RecordProcessor<VouchAccept.Record, IndexedVouchAccept>

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
