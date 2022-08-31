import { AdxUri } from '@adxp/common'
import * as microblog from '@adxp/microblog'
import { Like } from '@adxp/microblog'
import {
  DataSource,
  Entity,
  Column,
  PrimaryColumn,
  Repository,
  In,
  UpdateDateColumn,
} from 'typeorm'
import { DbPlugin } from '../types'
import { collectionToTableName } from '../util'

const collection = 'bsky/likes'
const tableName = collectionToTableName(collection)

@Entity({ name: tableName })
export class LikeIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  subject: string

  @Column('datetime')
  createdAt: string

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  indexedAt: Date
}

const getFn =
  (repo: Repository<LikeIndex>) =>
  async (uri: AdxUri): Promise<Like.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    return found === null ? null : translateDbObj(found)
  }

const getManyFn =
  (repo: Repository<LikeIndex>) =>
  async (uris: AdxUri[] | string[]): Promise<Like.Record[]> => {
    const uriStrs = uris.map((u) => u.toString())
    const found = await repo.findBy({ uri: In(uriStrs) })
    return found.map(translateDbObj)
  }

const setFn =
  (repo: Repository<LikeIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!microblog.isLike(obj)) {
      throw new Error('Not a valid like record')
    }
    const like = new LikeIndex()
    like.uri = uri.toString()
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
): DbPlugin<Like.Record, LikeIndex> => {
  const repository = db.getRepository(LikeIndex)
  return {
    collection,
    tableName,
    get: getFn(repository),
    getMany: getManyFn(repository),
    set: setFn(repository),
    delete: deleteFn(repository),
    translateDbObj,
  }
}

export default makePlugin
