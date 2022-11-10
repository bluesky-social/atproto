import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Assertion from '../../lexicon/types/app/bsky/graph/assertion'
import { DbRecordPlugin } from '../types'
import { PartialDB } from '../tables/assertion'
import * as schemas from '../schemas'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'

const type = schemas.ids.AppBskyGraphAssertion

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Assertion.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (
    uri: AtUri,
    cid: CID,
    obj: unknown,
    timestamp?: string,
  ): Promise<Message[]> => {
    if (!matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    await db
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
      .execute()

    const notif = messages.createNotification({
      userDid: obj.subject.did,
      author: uri.host,
      recordUri: uri.toString(),
      recordCid: cid.toString(),
      reason: 'assertion',
      reasonSubject: uri.host,
    })
    return [notif]
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<Message[]> => {
    const deleted = await db
      .deleteFrom('assertion')
      .where('uri', '=', uri.toString())
      .returningAll()
      .executeTakeFirst()
    const events: Message[] = [messages.deleteNotifications(uri.toString())]
    if (deleted?.confirmUri) {
      events.push(messages.removeMember(deleted.creator, deleted.subjectDid))
    }
    return events
  }

export type PluginType = DbRecordPlugin<Assertion.Record>

export const makePlugin = (db: Kysely<PartialDB>): PluginType => {
  return {
    collection: type,
    validateSchema,
    matchesSchema,
    insert: insertFn(db),
    delete: deleteFn(db),
  }
}

export default makePlugin
