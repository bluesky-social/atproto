import { Kysely } from 'kysely'
import { AdxUri } from '@adxp/uri'
import * as Post from '../../lexicon/types/app/bsky/post'
import { DbRecordPlugin, Notification } from '../types'
import schemas from '../schemas'

const type = 'app.bsky.post'
const tableName = 'app_bsky_post'

export interface AppBskyPost {
  uri: string
  creator: string
  text: string
  replyRoot: string | null
  replyParent: string | null
  createdAt: string
  indexedAt: string
}

const supportingTableName = 'app_bsky_post_entity'
export interface AppBskyPostEntity {
  postUri: string
  startIndex: number
  endIndex: number
  type: string
  value: string
}

export const createTable = async (db: Kysely<PartialDB>): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('text', 'varchar', (col) => col.notNull())
    .addColumn('replyRoot', 'varchar')
    .addColumn('replyParent', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable(supportingTableName)
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('startIndex', 'integer', (col) => col.notNull())
    .addColumn('endIndex', 'integer', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('value', 'varchar', (col) => col.notNull())
    .execute()
}

export type PartialDB = {
  [tableName]: AppBskyPost
  [supportingTableName]: AppBskyPostEntity
}

const validator = schemas.createRecordValidator(type)
const isValidSchema = (obj: unknown): obj is Post.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: AppBskyPost): Post.Record => {
  const reply = dbObj.replyRoot
    ? {
        root: dbObj.replyRoot,
        parent: dbObj.replyParent ?? undefined,
      }
    : undefined
  return {
    text: dbObj.text,
    reply: reply,
    createdAt: dbObj.createdAt,
  }
}

const getFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri): Promise<Post.Record | null> => {
    const postQuery = db
      .selectFrom('app_bsky_post')
      .selectAll()
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    const entitiesQuery = db
      .selectFrom('app_bsky_post_entity')
      .selectAll()
      .where('postUri', '=', uri.toString())
      .execute()
    const [post, entities] = await Promise.all([postQuery, entitiesQuery])
    if (!post) return null
    const record = translateDbObj(post)
    record.entities = entities.map((row) => ({
      index: [row.startIndex, row.endIndex],
      type: row.type,
      value: row.value,
    }))
    return record
  }

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    const entities = (obj.entities || []).map((entity) => ({
      postUri: uri.toString(),
      startIndex: entity.index[0],
      endIndex: entity.index[1],
      type: entity.type,
      value: entity.value,
    }))
    const post = {
      uri: uri.toString(),
      creator: uri.host,
      text: obj.text,
      createdAt: obj.createdAt,
      replyRoot: obj.reply?.root,
      replyParent: obj.reply?.parent,
      indexedAt: new Date().toISOString(),
    }
    const promises = [db.insertInto('app_bsky_post').values(post).execute()]
    if (entities.length > 0) {
      promises.push(
        db.insertInto('app_bsky_post_entity').values(entities).execute(),
      )
    }
    await Promise.all(promises)
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AdxUri): Promise<void> => {
    await Promise.all([
      db.deleteFrom('app_bsky_post').where('uri', '=', uri.toString()),
      db
        .deleteFrom('app_bsky_post_entity')
        .where('postUri', '=', uri.toString()),
    ])
  }

const notifsForRecord = (uri: AdxUri, obj: unknown): Notification[] => {
  if (!isValidSchema(obj)) {
    throw new Error(`Record does not match schema: ${type}`)
  }
  const notifs: Notification[] = []
  for (const entity of obj.entities || []) {
    if (entity.type === 'mention') {
      notifs.push({
        userDid: entity.value,
        author: uri.host,
        recordUri: uri.toString(),
        reason: 'mention',
      })
    }
  }
  if (obj.reply?.parent) {
    const parentUri = new AdxUri(obj.reply.parent)
    notifs.push({
      userDid: parentUri.host,
      author: uri.host,
      recordUri: uri.toString(),
      reason: 'reply',
      reasonSubject: parentUri.toString(),
    })
  }
  return notifs
}

export const makePlugin = (
  db: Kysely<PartialDB>,
): DbRecordPlugin<Post.Record, AppBskyPost> => {
  return {
    collection: type,
    tableName,
    validateSchema,
    translateDbObj,
    get: getFn(db),
    insert: insertFn(db),
    delete: deleteFn(db),
    notifsForRecord,
  }
}

export default makePlugin
