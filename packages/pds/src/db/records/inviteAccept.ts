import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as InviteAccept from '../../lexicon/types/app/bsky/graph/inviteAccept'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'

const type = schemas.ids.AppBskyGraphInviteAccept
const tableName = 'app_bsky_invite_accept'

export interface AppBskyInviteAccept {
  uri: string
  cid: string
  creator: string
  groupDid: string
  groupDeclarationCid: string
  inviteUri: string
  inviteCid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: AppBskyInviteAccept }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is InviteAccept.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: AppBskyInviteAccept): InviteAccept.Record => {
  return {
    group: {
      did: dbObj.groupDid,
      declarationCid: dbObj.groupDeclarationCid,
    },
    invite: {
      uri: dbObj.inviteUri,
      cid: dbObj.inviteCid,
    },
    createdAt: dbObj.createdAt,
  }
}

const getFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<InviteAccept.Record | null> => {
    const found = await db
      .selectFrom(tableName)
      .selectAll()
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    return !found ? null : translateDbObj(found)
  }

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
        groupDid: obj.group.did,
        groupDeclarationCid: obj.group.declarationCid,
        inviteUri: obj.invite.uri,
        inviteCid: obj.invite.cid,
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

export const makePlugin = (
  db: Kysely<PartialDB>,
): DbRecordPlugin<InviteAccept.Record, AppBskyInviteAccept> => {
  return {
    collection: type,
    tableName,
    validateSchema,
    matchesSchema,
    translateDbObj,
    get: getFn(db),
    insert: insertFn(db),
    delete: deleteFn(db),
    notifsForRecord,
  }
}

export default makePlugin
