import { AdxUri } from '@adxp/uri'
import * as Post from '../../lexicon/types/todo/social/post'
import { DataSource, Entity, Column, PrimaryColumn, ManyToOne } from 'typeorm'
import { DbRecordPlugin } from '../types'
import { User } from '../user'
import schemas from '../schemas'
import { collectionToTableName } from '../util'

const type = 'todo.social.post'
const tableName = collectionToTableName(type)

@Entity({ name: tableName })
export class PostIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  @ManyToOne(() => User, (user) => user.did)
  creator: string

  @Column('text')
  text: string

  @Column({ type: 'varchar', nullable: true })
  replyRoot?: string

  @Column({ type: 'varchar', nullable: true })
  replyParent?: string

  @Column('datetime')
  createdAt: string

  @Column('varchar')
  indexedAt: string
}

@Entity({ name: `${tableName}_entities` })
export class PostEntityIndex {
  @PrimaryColumn('varchar')
  post_uri: string

  @Column('int')
  startIndex: number

  @Column('int')
  endIndex: number

  @Column('varchar')
  type: string

  @Column('varchar')
  value: string
}

const getFn =
  (db: DataSource) =>
  async (uri: AdxUri): Promise<Post.Record | null> => {
    const found = await db
      .getRepository(PostIndex)
      .findOneBy({ uri: uri.toString() })
    if (found === null) return null
    const obj = translateDbObj(found)
    const entities = await db
      .getRepository(PostEntityIndex)
      .findBy({ post_uri: uri.toString() })
    obj.entities = entities.map((row) => ({
      index: [row.startIndex, row.endIndex],
      type: row.type,
      value: row.value,
    }))
    return obj
  }

const validator = schemas.createRecordValidator(type)
const isValidSchema = (obj: unknown): obj is Post.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const setFn =
  (db: DataSource) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    const entities = (obj.entities || []).map((entity) => {
      const entry = new PostEntityIndex()
      entry.post_uri = uri.toString()
      entry.startIndex = entity.index[0]
      entry.endIndex = entity.index[1]
      entry.type = entity.type
      entry.value = entity.value
      entry.post_uri = uri.toString()
      return entry
    })
    await db.getRepository(PostEntityIndex).save(entities)

    const post = new PostIndex()
    post.uri = uri.toString()
    post.creator = uri.host
    post.text = obj.text
    post.createdAt = obj.createdAt
    post.replyRoot = obj.reply?.root
    post.replyParent = obj.reply?.parent
    post.indexedAt = new Date().toISOString()

    await db.getRepository(PostIndex).save(post)
  }

const deleteFn =
  (db: DataSource) =>
  async (uri: AdxUri): Promise<void> => {
    await db.getRepository(PostIndex).delete({ uri: uri.toString() })
    await db.getRepository(PostEntityIndex).delete({ post_uri: uri.toString() })
  }

const translateDbObj = (dbObj: PostIndex): Post.Record => {
  const reply = dbObj.replyRoot
    ? {
        root: dbObj.replyRoot,
        parent: dbObj.replyParent,
      }
    : undefined
  return {
    text: dbObj.text,
    reply: reply,
    createdAt: dbObj.createdAt,
  }
}

export const makePlugin = (
  db: DataSource,
): DbRecordPlugin<Post.Record, PostIndex> => {
  const repository = db.getRepository(PostIndex)
  return {
    collection: type,
    tableName,
    get: getFn(db),
    validateSchema,
    set: setFn(db),
    delete: deleteFn(db),
    translateDbObj,
  }
}

export default makePlugin
