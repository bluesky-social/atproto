import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Confirmation from '../../lexicon/types/app/bsky/graph/confirmation'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'

const type = schemas.ids.AppBskyGraphConfirmation
const tableName = 'app_bsky_confirmation'

export interface AppBskyConfirmation {
  uri: string
  cid: string
  creator: string
  originatorDid: string
  originatorDeclarationCid: string // @TODO do we need originator info?
  assertionUri: string
  assertionCid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: AppBskyConfirmation }

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
  ): Promise<void> => {
    if (!matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    await db
      .insertInto(tableName)
      .values({
        uri: uri.toString(),
        cid: cid.toString(),
        creator: uri.host,
        originatorDid: obj.originator.did,
        originatorDeclarationCid: obj.originator.declarationCid,
        assertionUri: obj.assertion.uri,
        assertionCid: obj.assertion.cid,
        createdAt: obj.createdAt,
        indexedAt: timestamp || new Date().toISOString(),
      })
      .execute()
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<void> => {
    await db.deleteFrom(tableName).where('uri', '=', uri.toString()).execute()
  }

const notifsForRecord = (
  _uri: AtUri,
  _cid: CID,
  _obj: unknown,
): Notification[] => {
  return []
}

export type PluginType = DbRecordPlugin<Confirmation.Record>

export const makePlugin = (db: Kysely<PartialDB>): PluginType => {
  return {
    collection: type,
    validateSchema,
    matchesSchema,
    insert: insertFn(db),
    delete: deleteFn(db),
    notifsForRecord,
  }
}

export default makePlugin
