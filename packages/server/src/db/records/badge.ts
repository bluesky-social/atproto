import { AdxUri } from '@adxp/common'
import { Badge } from '@adxp/microblog'
import { TagAssertion } from '@adxp/microblog/src/types/Badge'
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

const schemaId = 'blueskyweb.xyz:Badge'
const collection = 'bsky/badges'
const tableName = collectionToTableName(collection)

@Entity({ name: tableName })
export class BadgeIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  @ManyToOne(() => UserDid, (user) => user.did)
  creator: string

  @Column('varchar')
  subject: string

  @Column('varchar')
  assertionType: string

  @Column({ type: 'varchar', nullable: true })
  assertionTag?: string

  @Column('datetime')
  createdAt: string

  @UpdateDateColumn()
  indexedAt: Date
}

const getFn =
  (repo: Repository<BadgeIndex>) =>
  async (uri: AdxUri): Promise<Badge.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    return found === null ? null : translateDbObj(found)
  }

const validator = schemas.createRecordValidator(schemaId)
const isValidSchema = (obj: unknown): obj is Badge.Record => {
  return validator.isValid(obj)
}

const setFn =
  (repo: Repository<BadgeIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${schemaId}`)
    }
    const badge = new BadgeIndex()
    badge.uri = uri.toString()
    badge.creator = uri.host
    badge.subject = obj.subject
    badge.assertionType = obj.assertion.type
    badge.assertionTag = (obj.assertion as TagAssertion).tag
    badge.createdAt = obj.createdAt
    await repo.save(badge)
  }

const deleteFn =
  (repo: Repository<BadgeIndex>) =>
  async (uri: AdxUri): Promise<void> => {
    await repo.delete({ uri: uri.toString() })
  }

const translateDbObj = (dbObj: BadgeIndex): Badge.Record => {
  const badge = {
    assertion: {
      type: dbObj.assertionType,
      tag: dbObj.assertionTag,
    },
    subject: dbObj.subject,
    createdAt: dbObj.createdAt,
  }
  if (badge.assertion.type === 'tag') {
    badge.assertion.tag = dbObj.assertionTag
  }
  return badge
}

export const makePlugin = (
  db: DataSource,
): DbRecordPlugin<Badge.Record, BadgeIndex> => {
  const repository = db.getRepository(BadgeIndex)
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
