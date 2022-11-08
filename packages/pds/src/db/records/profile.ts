import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Profile from '../../lexicon/types/app/bsky/actor/profile'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'

const type = schemas.ids.AppBskyActorProfile
const tableName = 'profile'

export interface BskyProfile {
  uri: string
  cid: string
  creator: string
  displayName: string
  description: string | null
  indexedAt: string
}
export type PartialDB = { [tableName]: BskyProfile }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Profile.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri, cid: CID, obj: unknown): Promise<void> => {
    if (!matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }

    const profile = {
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      displayName: obj.displayName,
      description: obj.description,
      indexedAt: new Date().toISOString(),
    }
    await db.insertInto(tableName).values(profile).execute()
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<void> => {
    await db.deleteFrom(tableName).where('uri', '=', uri.toString()).execute()
  }

const notifsForRecord = (_uri: AtUri, _obj: unknown): Notification[] => {
  return []
}

export type PluginType = DbRecordPlugin<Profile.Record>

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
