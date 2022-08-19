import { AdxUri } from '@adxp/common'
import * as microblog from '@adxp/microblog'
import { Follow } from '@adxp/microblog'
import { DataSource, Entity, Column, PrimaryColumn, Repository } from 'typeorm'
import { DbPlugin } from '../types'
import { collectionToTableName } from '../util'

const collection = 'bsky/follows'
const tableName = collectionToTableName(collection)

@Entity({ name: tableName })
export class FollowIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  subject: string

  @Column({ type: 'varchar', nullable: true })
  subjectName?: string

  @Column('datetime')
  createdAt: string
}

const getFn =
  (repo: Repository<FollowIndex>) =>
  async (uri: AdxUri): Promise<Follow.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    if (found === null) return null
    return {
      subject: {
        did: found.subject,
        name: found.subjectName,
      },
      createdAt: found.createdAt,
    }
  }

const setFn =
  (repo: Repository<FollowIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!microblog.isFollow(obj)) {
      throw new Error('Not a valid follow record')
    }
    const follow = new FollowIndex()
    follow.uri = uri.toString()
    follow.subject = obj.subject.did
    follow.subjectName = obj.subject.name
    follow.createdAt = obj.createdAt
    await repo.save(follow)
  }

const deleteFn =
  (repo: Repository<FollowIndex>) =>
  async (uri: AdxUri): Promise<void> => {
    await repo.delete({ uri: uri.toString() })
  }

export const makePlugin = (db: DataSource): DbPlugin<Follow.Record> => {
  const repository = db.getRepository(FollowIndex)
  return {
    collection,
    tableName,
    get: getFn(repository),
    set: setFn(repository),
    delete: deleteFn(repository),
  }
}

export default makePlugin
