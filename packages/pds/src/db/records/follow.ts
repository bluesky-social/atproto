import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Follow from '../../lexicon/types/app/bsky/graph/follow'
import { DbRecordPlugin } from '../types'
import * as schemas from '../schemas'
import * as messages from '../message-queue/messages'
import { Message } from '../message-queue/messages'

const type = schemas.ids.AppBskyGraphFollow
const tableName = 'follow'
export interface BskyFollow {
  uri: string
  cid: string
  creator: string
  subjectDid: string
  subjectDeclarationCid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: BskyFollow }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Follow.Record => {
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
    const val = {
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      subjectDid: obj.subject.did,
      subjectDeclarationCid: obj.subject.declarationCid,
      createdAt: obj.createdAt,
      indexedAt: timestamp || new Date().toISOString(),
    }
    await db.insertInto(tableName).values(val).execute()
    return [
      messages.createNotification({
        userDid: obj.subject.did,
        author: uri.host,
        recordUri: uri.toString(),
        recordCid: cid.toString(),
        reason: 'follow',
      }),
    ]
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<Message[]> => {
    await db.deleteFrom(tableName).where('uri', '=', uri.toString()).execute()
    return [messages.deleteNotifications(uri.toString())]
  }

export type PluginType = DbRecordPlugin<Follow.Record>

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
