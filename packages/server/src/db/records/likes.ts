import { AdxUri } from '@adxp/common'
import * as microblog from '@adxp/microblog'
import { Like } from '@adxp/microblog'
import { DataSource, Entity, Column, PrimaryColumn, Repository } from 'typeorm'
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
}

const getFn =
  (repo: Repository<LikeIndex>) =>
  async (uri: AdxUri): Promise<Like.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    if (found === null) return null
    return {
      subject: found.subject,
      createdAt: found.createdAt,
    }
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

export const makePlugin = (db: DataSource): DbPlugin<Like.Record> => {
  const repository = db.getRepository(LikeIndex)
  return {
    collection,
    tableName,
    get: getFn(repository),
    set: setFn(repository),
    delete: deleteFn(repository),
  }
}

export default makePlugin
