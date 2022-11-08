import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Post from '../../lexicon/types/app/bsky/feed/post'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'

const type = schemas.ids.AppBskyFeedPost
const tableName = 'post'

export interface BskyPost {
  uri: string
  cid: string
  creator: string
  text: string
  replyRoot: string | null
  replyRootCid: string | null
  replyParent: string | null
  replyParentCid: string | null
  createdAt: string
  indexedAt: string
}

const supportingTableName = 'post_entity'
export interface BskyPostEntity {
  postUri: string
  startIndex: number
  endIndex: number
  type: string
  value: string
}

export type PartialDB = {
  [tableName]: BskyPost
  [supportingTableName]: BskyPostEntity
}

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Post.Record => {
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
    const entities = (obj.entities || []).map((entity) => ({
      postUri: uri.toString(),
      startIndex: entity.index.start,
      endIndex: entity.index.end,
      type: entity.type,
      value: entity.value,
    }))
    const post = {
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      text: obj.text,
      createdAt: obj.createdAt,
      replyRoot: obj.reply?.root?.uri || null,
      replyRootCid: obj.reply?.root?.cid || null,
      replyParent: obj.reply?.parent?.uri || null,
      replyParentCid: obj.reply?.parent?.cid || null,
      indexedAt: timestamp || new Date().toISOString(),
    }
    const promises = [db.insertInto(tableName).values(post).execute()]
    if (entities.length > 0) {
      promises.push(
        db.insertInto(supportingTableName).values(entities).execute(),
      )
    }
    await Promise.all(promises)
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<void> => {
    await Promise.all([
      db.deleteFrom(tableName).where('uri', '=', uri.toString()).execute(),
      db
        .deleteFrom(supportingTableName)
        .where('postUri', '=', uri.toString())
        .execute(),
    ])
  }

const notifsForRecord = (
  uri: AtUri,
  cid: CID,
  obj: unknown,
): Notification[] => {
  if (!matchesSchema(obj)) {
    throw new Error(`Record does not match schema: ${type}`)
  }
  const notifs: Notification[] = []
  for (const entity of obj.entities || []) {
    if (entity.type === 'mention') {
      notifs.push({
        userDid: entity.value,
        author: uri.host,
        recordUri: uri.toString(),
        recordCid: cid.toString(),
        reason: 'mention',
      })
    }
  }
  if (obj.reply?.parent) {
    const parentUri = new AtUri(obj.reply.parent.uri)
    notifs.push({
      userDid: parentUri.host,
      author: uri.host,
      recordUri: uri.toString(),
      recordCid: cid.toString(),
      reason: 'reply',
      reasonSubject: parentUri.toString(),
    })
  }
  return notifs
}

export type PluginType = DbRecordPlugin<Post.Record>

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
