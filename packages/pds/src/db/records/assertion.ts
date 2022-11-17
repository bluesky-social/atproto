import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Assertion from '../../lexicon/types/app/bsky/graph/assertion'
import { Assertion as IndexedAssertion } from '../tables/assertion'
import * as schemas from '../schemas'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'
import DatabaseSchema from '../database-schema'
import RecordProcessor from '../record-processor'

const schemaId = schemas.ids.AppBskyGraphAssertion

const insertFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  cid: CID,
  obj: Assertion.Record,
  timestamp?: string,
): Promise<IndexedAssertion | null> => {
  const inserted = await db
    .insertInto('assertion')
    .values({
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      assertion: obj.assertion,
      subjectDid: obj.subject.did,
      subjectDeclarationCid: obj.subject.declarationCid,
      createdAt: obj.createdAt,
      indexedAt: timestamp || new Date().toISOString(),
      confirmUri: null,
      confirmCid: null,
      confirmCreated: null,
      confirmIndexed: null,
    })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .executeTakeFirst()
  return inserted || null
}

const findDuplicate = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
  obj: Assertion.Record,
): Promise<AtUri | null> => {
  const found = await db
    .selectFrom('assertion')
    .where('creator', '=', uri.host)
    .where('subjectDid', '=', obj.subject.did)
    .where('assertion.assertion', '=', obj.assertion)
    .selectAll()
    .executeTakeFirst()
  return found ? new AtUri(found.uri) : null
}

const eventsForInsert = (obj: IndexedAssertion): Message[] => {
  const notif = messages.createNotification({
    userDid: obj.subjectDid,
    author: obj.creator,
    recordUri: obj.uri,
    recordCid: obj.cid,
    reason: 'assertion',
    reasonSubject: obj.creator,
  })
  return [notif]
}

const deleteFn = async (
  db: Kysely<DatabaseSchema>,
  uri: AtUri,
): Promise<IndexedAssertion | null> => {
  const deleted = await db
    .deleteFrom('assertion')
    .where('uri', '=', uri.toString())
    .returningAll()
    .executeTakeFirst()
  return deleted || null
}

const eventsForDelete = (
  deleted: IndexedAssertion,
  replacedBy: IndexedAssertion | null,
): Message[] => {
  const events: Message[] = []
  events.push(messages.deleteNotifications(deleted.uri))
  if (deleted?.confirmUri) {
    events.push(messages.removeMember(deleted.creator, deleted.subjectDid))
  }
  if (replacedBy) {
    eventsForInsert(replacedBy).forEach((evt) => events.push(evt))
  }
  return events
}

export type PluginType = RecordProcessor<Assertion.Record, IndexedAssertion>

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
