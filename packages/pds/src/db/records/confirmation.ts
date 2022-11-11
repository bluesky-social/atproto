import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Confirmation from '../../lexicon/types/app/bsky/graph/confirmation'
import * as assertionTable from '../tables/assertion'
import * as didHandleTable from '../tables/did-handle'
import { DbRecordPlugin } from '../types'
import * as schemas from '../schemas'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'
import { APP_BSKY_GRAPH } from '../../lexicon'

const type = schemas.ids.AppBskyGraphConfirmation

export type PartialDB = assertionTable.PartialDB & didHandleTable.PartialDB

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Confirmation.Record => {
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
    const updated = await db
      .updateTable('assertion')
      .where('uri', '=', obj.assertion.uri)
      .where('cid', '=', obj.assertion.cid)
      .set({
        confirmUri: uri.toString(),
        confirmCid: cid.toString(),
        confirmCreated: obj.createdAt,
        confirmIndexed: timestamp || new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirst()

    if (updated?.assertion === APP_BSKY_GRAPH.AssertMember) {
      return [messages.addMember(updated.creator, updated.subjectDid)]
    }
    return []
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<Message[]> => {
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

    return updated
      ? [messages.removeMember(updated.creator, updated.subjectDid)]
      : []
  }

export type PluginType = DbRecordPlugin<Confirmation.Record>

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
