import { AdxUri } from '@adxp/uri'
import * as Repost from '../../lexicon/types/todo/social/repost'
import {
  DataSource,
  Entity,
  Column,
  PrimaryColumn,
  Repository,
  ManyToOne,
} from 'typeorm'
import { DbRecordPlugin } from '../types'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { collectionToTableName } from '../util'
import { PostIndex } from './post'

const type = 'todo.social.repost'
const tableName = collectionToTableName(type)

@Entity({ name: tableName })
export class RepostIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  @ManyToOne(() => UserDid, (user) => user.did)
  creator: string

  @Column('varchar')
  @ManyToOne(() => PostIndex, (post) => post.uri)
  subject: string

  @Column('datetime')
  createdAt: string

  @Column('varchar')
  indexedAt: string
}

const getFn =
  (repo: Repository<RepostIndex>) =>
  async (uri: AdxUri): Promise<Repost.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    return found === null ? null : translateDbObj(found)
  }

const validator = schemas.createRecordValidator(type)
const isValidSchema = (obj: unknown): obj is Repost.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const setFn =
  (repo: Repository<RepostIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    const repost = new RepostIndex()
    repost.uri = uri.toString()
    repost.creator = uri.host
    repost.subject = obj.subject
    repost.createdAt = obj.createdAt
    repost.indexedAt = new Date().toISOString()

    await repo.save(repost)
  }

const deleteFn =
  (repo: Repository<RepostIndex>) =>
  async (uri: AdxUri): Promise<void> => {
    await repo.delete({ uri: uri.toString() })
  }

const translateDbObj = (dbObj: RepostIndex): Repost.Record => {
  return {
    subject: dbObj.subject,
    createdAt: dbObj.createdAt,
  }
}

export const makePlugin = (
  db: DataSource,
): DbRecordPlugin<Repost.Record, RepostIndex> => {
  const repository = db.getRepository(RepostIndex)
  return {
    collection: type,
    tableName,
    get: getFn(repository),
    validateSchema,
    set: setFn(repository),
    delete: deleteFn(repository),
    translateDbObj,
  }
}

export default makePlugin
