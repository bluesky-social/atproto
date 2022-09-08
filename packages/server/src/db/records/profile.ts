import { AdxUri } from '@adxp/common'
import { Profile } from '@adxp/microblog'
import {
  DataSource,
  Entity,
  Column,
  PrimaryColumn,
  Repository,
  In,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinTable,
} from 'typeorm'
import { DbRecordPlugin } from '../types'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { collectionToTableName } from '../util'
import { BadgeIndex } from './badge'

const schemaId = 'blueskyweb.xyz:Profile'
const collection = 'bsky/profile'
const tableName = collectionToTableName(collection)

@Entity({ name: tableName })
export class ProfileIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  @ManyToOne(() => UserDid, (user) => user.did)
  creator: string

  @Column('varchar')
  displayName: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @OneToMany(() => ProfileBadgeIndex, (badge) => badge.profile, {
    cascade: true,
  })
  @JoinTable()
  badges: ProfileBadgeIndex[]

  @UpdateDateColumn()
  indexedAt: Date
}

@Entity({ name: `${tableName}_badges` })
export class ProfileBadgeIndex {
  @ManyToOne(() => ProfileIndex, (profile) => profile.badges)
  @PrimaryColumn('varchar')
  profile: string

  @Column({ type: 'varchar', unique: true })
  badge: string
}

const getFn =
  (repo: Repository<ProfileIndex>) =>
  async (uri: AdxUri): Promise<Profile.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    return found === null ? null : translateDbObj(found)
  }

const validator = schemas.createRecordValidator(schemaId)
const isValidSchema = (obj: unknown): obj is Profile.Record => {
  return validator.isValid(obj)
}

const setFn =
  (repo: Repository<ProfileIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${schemaId}`)
    }
    const profile = new ProfileIndex()
    profile.uri = uri.toString()
    profile.creator = uri.host
    profile.displayName = obj.displayName
    profile.description = obj.description
    profile.badges = (obj.badges || []).map((ref) => {
      const badge = new ProfileBadgeIndex()
      badge.profile = uri.toString()
      badge.badge = ref.uri
      return badge
    })
    await repo.save(profile)
  }

const deleteFn =
  (repo: Repository<ProfileIndex>) =>
  async (uri: AdxUri): Promise<void> => {
    await repo.delete({ uri: uri.toString() })
  }

const translateDbObj = (dbObj: ProfileIndex): Profile.Record => {
  return {
    displayName: dbObj.displayName,
    description: dbObj.description,
    badges: dbObj.badges.map((badge) => ({ uri: badge.badge })),
  }
}

export const makePlugin = (
  db: DataSource,
): DbRecordPlugin<Profile.Record, ProfileIndex> => {
  const repository = db.getRepository(ProfileIndex)
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
