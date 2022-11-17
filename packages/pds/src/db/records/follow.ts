import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Follow from '../../lexicon/types/app/bsky/graph/follow'
import { Follow as IndexedFollow } from '../tables/follow'
import * as schemas from '../schemas'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'
import DatabaseSchema from '../database-schema'
import RecordProcessor from '../record-processor'

const schemaId = schemas.ids.AppBskyGraphFollow

const insertFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  cid: CID,
  obj: Follow.Record,
  timestamp?: string,
): Promise<IndexedFollow | null> => {
  const inserted = await db
    .insertInto('follow')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectDid: obj.subject.did,
      subjectDeclarationCid: obj.subject.declarationCid,
      createdAt: obj.createdAt,
      indexedAt: timestamp || new Date().toISOString(),
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  obj: Follow.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('follow')
    .where('creator', '=', uri.host)
    .where('subjectDid', '=', obj.subject.did)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const eventsForInsert = (obj: IndexedFollow): Message[] => {
  return [
    messages.createNotification({
      userDid: obj.subjectDid,
      author: obj.creator,
      recordUri: obj.uri,
      recordCid: obj.cid,
      reason: 'follow',
    }),
  ]
}

const deleteFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
): Promise<IndexedFollow | null> => {
  const deleted = await db
    .deleteFrom('follow')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const eventsForDelete = (
  deleted: IndexedFollow,
  replacedBy: IndexedFollow | null,
): Message[] => {
  if (replacedBy) return []
  return [messages.deleteNotifications(deleted.uri)]
}

export type PluginType = RecordProcessor<Follow.Record, IndexedFollow>

export const makePlugin = (db: Kysely<DatabaseSchema>): PluginType => {
  return new RecordProcessor(db, {
    schemaId,
    insertFn,
    findDuplicate,
    deleteFn,
    eventsForInsert,
    eventsForDelete,
  })
}

export default makePlugin
