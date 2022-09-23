import { AdxUri } from '@adxp/uri'
import * as Profile from '../../lexicon/types/todo/social/profile'
import { DataSource, Entity, Column, PrimaryColumn } from 'typeorm'
import { DbRecordPlugin } from '../types'
import schemas from '../schemas'
import { collectionToTableName } from '../util'

const type = 'todo.social.profile'
const tableName = collectionToTableName(type)

@Entity({ name: tableName })
export class ProfileIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column({ type: 'varchar', unique: true })
  creator: string

  @Column('varchar')
  displayName: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column('varchar')
  indexedAt: string
}

@Entity({ name: `${tableName}_badges` })
export class ProfileBadgeIndex {
  @PrimaryColumn('varchar')
  profile: string

  @Column({ type: 'varchar', unique: true })
  badge: string
}

const getFn =
  (db: DataSource) =>
  async (uri: AdxUri): Promise<Profile.Record | null> => {
    const found = await db
      .getRepository(ProfileIndex)
      .findOneBy({ uri: uri.toString() })
    if (found === null) return null
    const obj = translateDbObj(found)
    const badges = await db
      .getRepository(ProfileBadgeIndex)
      .findBy({ profile: uri.toString() })
    obj.badges = badges.map((row) => ({
      uri: row.badge,
    }))
    return obj
  }

const validator = schemas.createRecordValidator(type)
const isValidSchema = (obj: unknown): obj is Profile.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const setFn =
  (db: DataSource) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }

    const badges = (obj.badges || []).map((badge) => {
      const entry = new ProfileBadgeIndex()
      entry.badge = badge.uri
      entry.profile = uri.toString()
      return entry
    })
    await db.getRepository(ProfileBadgeIndex).save(badges)

    const profile = new ProfileIndex()
    profile.uri = uri.toString()
    profile.creator = uri.host
    profile.displayName = obj.displayName
    profile.description = obj.description
    profile.indexedAt = new Date().toISOString()
    await db.getRepository(ProfileIndex).save(profile)
  }

const deleteFn =
  (db: DataSource) =>
  async (uri: AdxUri): Promise<void> => {
    await db.getRepository(ProfileIndex).delete({ uri: uri.toString() })
    await db
      .getRepository(ProfileBadgeIndex)
      .delete({ profile: uri.toString() })
  }

const translateDbObj = (dbObj: ProfileIndex): Profile.Record => {
  return {
    displayName: dbObj.displayName,
    description: dbObj.description,
  }
}

export const makePlugin = (
  db: DataSource,
): DbRecordPlugin<Profile.Record, ProfileIndex> => {
  const repository = db.getRepository(ProfileIndex)
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
