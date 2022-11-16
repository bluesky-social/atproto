import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Confirmation from '../../lexicon/types/app/bsky/graph/confirmation'
import { Assertion as IndexedAssertion } from '../tables/assertion'
import * as schemas from '../schemas'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'
import { APP_BSKY_GRAPH } from '../../lexicon'
import DatabaseSchema from '../database-schema'
import RecordProcessor from '../record-processor'

const schemaId = schemas.ids.AppBskyGraphConfirmation

const insertFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  cid: CID,
  obj: Confirmation.Record,
  timestamp?: string,
): Promise<IndexedAssertion | null> => {
  const updated = await db
    .updateTable('assertion')
    .where('uri', '=', obj.assertion.uri)
    .where('cid', '=', obj.assertion.cid)
    .where('confirmUri', 'is', null)
    .set({
      confirmUri: uri.toString(),
      confirmCid: cid.toString(),
      confirmCreated: obj.createdAt,
      confirmIndexed: timestamp || new Date().toISOString(),
    })
    .returningAll()
    .executeTakeFirst()
  return updated || null
}

const findDuplicate = async (
  db: Kysely<DatabaseSchema>,
  _uri: AtUri,
  obj: Confirmation.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('assertion')
    .where('uri', '=', obj.assertion.uri)
    .where('cid', '=', obj.assertion.cid)
    .where('assertion.confirmUri', 'is not', null)
    .selectAll()
    .executeTakeFirst()
  return found?.confirmUri ? new AtUri(found.confirmUri) : null
}

const eventsForInsert = (obj: IndexedAssertion): Message[] => {
  if (obj.confirmUri && obj.assertion === APP_BSKY_GRAPH.AssertMember) {
    return [messages.addMember(obj.creator, obj.subjectDid)]
  }
  return []
}

const deleteFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
): Promise<IndexedAssertion | null> => {
  const updated = await db
    .updateTable('assertion')
    .where('confirmUri', '=', uri.toString())
    .set({
      confirmUri: null,
      confirmCid: null,
      confirmCreated: null,
      confirmIndexed: null,
    })
    .returningAll()
    .executeTakeFirst()
  return updated || null
}

const eventsForDelete = (
  deleted: IndexedAssertion,
  replacedBy: IndexedAssertion | null,
): Message[] => {
  if (deleted.confirmUri && !replacedBy?.confirmUri) {
    return [messages.removeMember(deleted.creator, deleted.subjectDid)]
  }
  return []
}

export type PluginType = RecordProcessor<Confirmation.Record, IndexedAssertion>

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
