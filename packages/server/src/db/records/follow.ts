import { AdxUri } from '@adxp/common'
import { Follow } from '@adxp/microblog'
import {
  DataSource,
  Entity,
  Column,
  PrimaryColumn,
  Repository,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm'
import { DbRecordPlugin } from '../types'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { collectionToTableName } from '../util'

const schemaId = 'blueskyweb.xyz:Follow'
const collection = 'bsky/follows'
const tableName = collectionToTableName(collection)

@Entity({ name: tableName })
export class FollowIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  @ManyToOne(() => UserDid, (user) => user.did)
  creator: string

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

const validator = schemas.createRecordValidator(schemaId)
const isValidSchema = (obj: unknown): obj is Follow.Record => {
  return validator.isValid(obj)
}

const setFn =
  (repo: Repository<FollowIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${schemaId}`)
    }
    const follow = new FollowIndex()
    follow.uri = uri.toString()
    follow.creator = uri.host
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
): DbRecordPlugin<Follow.Record, FollowIndex> => {
  const repository = db.getRepository(FollowIndex)
  return {
    collection,
    tableName,
    get: getFn(repository),
    isValidSchema,
    set: setFn(repository),
    delete: deleteFn(repository),
    translateDbObj,
  }
}

export default makePlugin
