import { Kysely } from 'kysely'
import { AdxUri } from '@adxp/uri'
import { CID } from 'multiformats/cid'
import * as BadgeAccept from '../../lexicon/types/app/bsky/badgeAccept'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'

const type = schemas.ids.AppBskyBadgeAccept
const tableName = 'app_bsky_badge_accept'

export interface AppBskyBadgeAccept {
  uri: string
  cid: string
  creator: string
  badgeUri: string
  badgeCid: string
  offerUri: string
  offerCid: string
  createdAt: string
  indexedAt: string
}

export const createTable = async (db: Kysely<PartialDB>): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('badgeUri', 'varchar', (col) => col.notNull())
    .addColumn('badgeCid', 'varchar', (col) => col.notNull())
    .addColumn('offerUri', 'varchar', (col) => col.notNull())
    .addColumn('offerCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
}

export type PartialDB = { [tableName]: AppBskyBadgeAccept }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is BadgeAccept.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: AppBskyBadgeAccept): BadgeAccept.Record => {
  return {
    badge: {
      uri: dbObj.badgeUri,
      cid: dbObj.badgeCid,
    },
    offer: {
      uri: dbObj.offerUri,
      cid: dbObj.offerCid,
    },
    createdAt: dbObj.createdAt,
  }
}

const getFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri): Promise<BadgeAccept.Record | null> => {
    const found = await db
      .selectFrom(tableName)
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
      .insertInto(tableName)
      .values({
        uri: uri.toString(),
        cid: cid.toString(),
        creator: uri.host,
        badgeUri: obj.badge.uri,
        badgeCid: obj.badge.cid,
        offerUri: obj.offer.uri,
        offerCid: obj.offer.cid,
        createdAt: obj.createdAt,
        indexedAt: new Date().toISOString(),
      })
      .execute()
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri): Promise<void> => {
    await db.deleteFrom(tableName).where('uri', '=', uri.toString())
  }

const notifsForRecord = (
  _uri: AdxUri,
  _cid: CID,
  _obj: unknown,
): Notification[] => {
  return []
}

export const makePlugin = (
  db: Kysely<PartialDB>,
): DbRecordPlugin<BadgeAccept.Record, AppBskyBadgeAccept> => {
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
