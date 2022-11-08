import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Declaration from '../../lexicon/types/app/bsky/system/declaration'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'
import { PartialDB } from '../tables/did-handle'

const type = schemas.ids.AppBskySystemDeclaration

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Declaration.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (
    uri: AtUri,
    cid: CID,
    obj: unknown,
    _timestamp?: string,
  ): Promise<void> => {
    if (!matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    if (uri.rkey !== 'self') {
      throw new Error('Expected declarationrecord to be at rkey `self`')
    }
    await db
      .updateTable('did_handle')
      .where('did', '=', uri.host)
      .set({ declarationCid: cid.toString(), actorType: obj.actorType })
      .execute()
  }

const deleteFn =
  (_db: Kysely<PartialDB>) =>
  async (_uri: AtUri): Promise<void> => {
    throw new Error('Declaration alone can not be deleted')
  }

const notifsForRecord = (
  _uri: AtUri,
  _cid: CID,
  _obj: unknown,
): Notification[] => {
  return []
}

export type PluginType = DbRecordPlugin<Declaration.Record>

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
