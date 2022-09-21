import { AdxUri } from '@adxp/common'
import * as Like from '../../lexicon/types/todo/social/like'
import {
  DataSource,
  Entity,
  Column,
  PrimaryColumn,
  Repository,
  In,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm'
import { DbRecordPlugin } from '../types'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { collectionToTableName } from '../util'

const type = 'todo.social.like'
const tableName = collectionToTableName(type)

@Entity({ name: tableName })
export class LikeIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  @ManyToOne(() => UserDid, (user) => user.did)
  creator: string

  @Column('varchar')
  subject: string

  @Column('datetime')
  createdAt: string

  @UpdateDateColumn()
  indexedAt: Date
}

const getFn =
  (repo: Repository<LikeIndex>) =>
  async (uri: AdxUri): Promise<Like.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    return found === null ? null : translateDbObj(found)
  }

const validator = schemas.createRecordValidator(type)
const isValidSchema = (obj: unknown): obj is Like.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const setFn =
  (repo: Repository<LikeIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    const like = new LikeIndex()
    like.uri = uri.toString()
    like.creator = uri.host
    like.subject = obj.subject
    like.createdAt = obj.createdAt
    await repo.save(like)
  }

const deleteFn =
  (repo: Repository<LikeIndex>) =>
  async (uri: AdxUri): Promise<void> => {
    await repo.delete({ uri: uri.toString() })
  }

const translateDbObj = (dbObj: LikeIndex): Like.Record => {
  return {
    subject: dbObj.subject,
    createdAt: dbObj.createdAt,
  }
}

export const makePlugin = (
  db: DataSource,
): DbRecordPlugin<Like.Record, LikeIndex> => {
  const repository = db.getRepository(LikeIndex)
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
