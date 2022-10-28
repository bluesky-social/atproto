import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as BadgeOffer from '../../lexicon/types/app/bsky/badgeOffer'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'

const type = schemas.ids.AppBskyBadgeOffer
const tableName = 'app_bsky_badge_offer'

export interface AppBskyBadgeOffer {
  uri: string
  cid: string
  creator: string
  subject: string
  badgeUri: string
  badgeCid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: AppBskyBadgeOffer }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is BadgeOffer.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: AppBskyBadgeOffer): BadgeOffer.Record => {
  return {
    subject: dbObj.subject,
    badge: {
      uri: dbObj.badgeUri,
      cid: dbObj.badgeCid,
    },
    createdAt: dbObj.createdAt,
  }
}

const getFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<BadgeOffer.Record | null> => {
    const found = await db
      .selectFrom('app_bsky_badge_offer')
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
      .insertInto('app_bsky_badge_offer')
      .values({
        uri: uri.toString(),
        cid: cid.toString(),
        creator: uri.host,
        subject: obj.subject,
        badgeUri: obj.badge.uri,
        badgeCid: obj.badge.cid,
        createdAt: obj.createdAt,
        indexedAt: timestamp || new Date().toISOString(),
      })
      .execute()
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<void> => {
    await db
      .deleteFrom('app_bsky_badge_offer')
      .where('uri', '=', uri.toString())
      .execute()
  }

const notifsForRecord = (
  uri: AtUri,
  cid: CID,
  obj: unknown,
): Notification[] => {
  if (!matchesSchema(obj)) {
    throw new Error(`Record does not match schema: ${type}`)
  }
  const notif = {
    userDid: obj.subject,
    author: uri.host,
    recordUri: uri.toString(),
    recordCid: cid.toString(),
    reason: 'badge',
    reasonSubject: obj.badge.uri,
  }
  return [notif]
}

export const makePlugin = (
  db: Kysely<PartialDB>,
): DbRecordPlugin<BadgeOffer.Record, AppBskyBadgeOffer> => {
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
