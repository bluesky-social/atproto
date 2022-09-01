import { AdxUri } from '@adxp/common'
import * as microblog from '@adxp/microblog'
import { Follow } from '@adxp/microblog'
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

  @UpdateDateColumn()
  indexedAt: Date
}

const getFn =
  (repo: Repository<FollowIndex>) =>
  async (uri: AdxUri): Promise<Follow.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    return found === null ? null : translateDbObj(found)
  }

const getManyFn =
  (repo: Repository<FollowIndex>) =>
  async (uris: AdxUri[] | string[]): Promise<Follow.Record[]> => {
    const uriStrs = uris.map((u) => u.toString())
    const found = await repo.findBy({ uri: In(uriStrs) })
    return found.map(translateDbObj)
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

const translateDbObj = (dbObj: FollowIndex): Follow.Record => {
  return {
    subject: {
      did: dbObj.subject,
      name: dbObj.subjectName,
    },
    createdAt: dbObj.createdAt,
  }
}

export const makePlugin = (
  db: DataSource,
): DbPlugin<Follow.Record, FollowIndex> => {
  const repository = db.getRepository(FollowIndex)
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
