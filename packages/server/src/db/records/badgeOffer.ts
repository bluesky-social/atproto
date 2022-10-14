import { Kysely } from 'kysely'
import { AdxUri } from '@adxp/uri'
import { CID } from 'multiformats/cid'
import * as BadgeOffer from '../../lexicon/types/app/bsky/badgeOffer'
import { DbRecordPlugin, Notification } from '../types'
import schemas from '../schemas'

const type = 'app.bsky.badgeOffer'
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

export const createTable = async (db: Kysely<PartialDB>): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('badgeUri', 'varchar', (col) => col.notNull())
    .addColumn('badgeCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
}

export type PartialDB = { [tableName]: AppBskyBadgeOffer }

const validator = schemas.createRecordValidator(type)
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
  async (uri: AdxUri): Promise<BadgeOffer.Record | null> => {
    const found = await db
      .selectFrom('app_bsky_badge_offer')
      .selectAll()
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    return !found ? null : translateDbObj(found)
  }

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri, cid: CID, obj: unknown): Promise<void> => {
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
        indexedAt: new Date().toISOString(),
      })
      .execute()
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri): Promise<void> => {
    await db
      .deleteFrom('app_bsky_badge_offer')
      .where('uri', '=', uri.toString())
  }

const notifsForRecord = (
  uri: AdxUri,
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
