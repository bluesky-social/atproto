import * as Badge from '../lexicon/types/todo/social/badge'
import * as Follow from '../lexicon/types/todo/social/follow'
import * as Like from '../lexicon/types/todo/social/like'
import * as Post from '../lexicon/types/todo/social/post'
import * as Profile from '../lexicon/types/todo/social/profile'
import * as Repost from '../lexicon/types/todo/social/repost'
import { DataSource } from 'typeorm'
import { ValidationResult, ValidationResultCode } from '@adxp/lexicon'
import { DbRecordPlugin } from './types'
import postPlugin, { PostEntityIndex, PostIndex } from './records/post'
import likePlugin, { LikeIndex } from './records/like'
import followPlugin, { FollowIndex } from './records/follow'
import badgePlugin, { BadgeIndex } from './records/badge'
import profilePlugin, {
  ProfileBadgeIndex,
  ProfileIndex,
} from './records/profile'
import repostPlugin, { RepostIndex } from './records/repost'
import { AdxUri } from '@adxp/common'
import { CID } from 'multiformats/cid'
import { RepoRoot } from './repo-root'
import { AdxRecord } from './record'
import { UserDid } from './user-dids'

export class Database {
  db: DataSource
  records: {
    posts: DbRecordPlugin<Post.Record, PostIndex>
    likes: DbRecordPlugin<Like.Record, LikeIndex>
    follows: DbRecordPlugin<Follow.Record, FollowIndex>
    badges: DbRecordPlugin<Badge.Record, BadgeIndex>
    profiles: DbRecordPlugin<Profile.Record, ProfileIndex>
    reposts: DbRecordPlugin<Repost.Record, RepostIndex>
  }

  constructor(db: DataSource) {
    this.db = db
    this.records = {
      posts: postPlugin(db),
      likes: likePlugin(db),
      follows: followPlugin(db),
      badges: badgePlugin(db),
      profiles: profilePlugin(db),
      reposts: repostPlugin(db),
    }
  }

  static async sqlite(location: string): Promise<Database> {
    const db = new DataSource({
      type: 'sqlite',
      database: location,
      entities: [
        RepoRoot,
        AdxRecord,
        PostIndex,
        PostEntityIndex,
        LikeIndex,
        FollowIndex,
        BadgeIndex,
        ProfileIndex,
        ProfileBadgeIndex,
        RepostIndex,
        UserDid,
      ],
      synchronize: true,
    })
    await db.initialize()
    return new Database(db)
  }

  static async memory(): Promise<Database> {
    return Database.sqlite(':memory:')
  }

  async close(): Promise<void> {
    await this.db.destroy()
  }

  async getRepoRoot(did: string): Promise<CID | null> {
    const table = this.db.getRepository(RepoRoot)
    const found = await table.findOneBy({ did })
    if (found === null) return null
    return CID.parse(found.root)
  }

  async setRepoRoot(did: string, root: CID) {
    const table = this.db.getRepository(RepoRoot)
    let newRoot = await table.findOneBy({ did })
    if (newRoot === null) {
      newRoot = new RepoRoot()
      newRoot.did = did
    }
    newRoot.root = root.toString()
    await table.save(newRoot)
  }

  async getUser(user: string): Promise<UserDid | null> {
    const table = this.db.getRepository(UserDid)
    if (user.startsWith('did:')) {
      return table.findOneBy({ did: user })
    } else {
      return table.findOneBy({ username: user })
    }
  }

  async registerUser(username: string, did: string) {
    const table = this.db.getRepository(UserDid)
    const user = new UserDid()
    user.username = username
    user.did = did
    await table.save(user)
  }

  validateRecord(collection: string, obj: unknown): ValidationResult {
    let table
    try {
      table = this.findTableForCollection(collection)
    } catch (e) {
      const result = new ValidationResult()
      result._t(ValidationResultCode.Incompatible, `Schema not found`)
      return result
    }
    return table.validateSchema(obj)
  }

  canIndexRecord(collection: string, obj: unknown): boolean {
    const table = this.findTableForCollection(collection)
    return table.validateSchema(obj).valid
  }

  async indexRecord(uri: AdxUri, obj: unknown) {
    const record = new AdxRecord()
    record.uri = uri.toString()

    record.did = uri.host
    if (!record.did.startsWith('did:')) {
      throw new Error('Expected indexed URI to contain DID')
    }
    record.collection = uri.collection
    if (record.collection.length < 1) {
      throw new Error('Expected indexed URI to contain a collection')
    }
    record.tid = uri.recordKey
    if (record.tid.length < 1) {
      throw new Error('Expected indexed URI to contain a record TID')
    }
    record.raw = JSON.stringify(obj)

    const recordTable = this.db.getRepository(AdxRecord)
    await recordTable.save(record)

    const table = this.findTableForCollection(uri.collection)
    await table.set(uri, obj)
  }

  async deleteRecord(uri: AdxUri) {
    const table = this.findTableForCollection(uri.collection)
    const recordTable = this.db.getRepository(AdxRecord)
    await Promise.all([table.delete(uri), recordTable.delete(uri.toString())])
  }

  async listCollectionsForDid(did: string): Promise<string[]> {
    const recordTable = await this.db
      .getRepository(AdxRecord)
      .createQueryBuilder('record')
      .select('record.collection')
      .where('record.did = :did', { did })
      .getRawMany()

    return recordTable
  }

  async listRecordsForCollection(
    did: string,
    collection: string,
    limit: number,
    reverse: boolean,
    before?: string,
    after?: string,
  ): Promise<{ uri: string; value: unknown }[]> {
    const builder = await this.db
      .createQueryBuilder()
      .select(['record.uri AS uri, record.raw AS raw'])
      .from(AdxRecord, 'record')
      .where('record.did = :did', { did })
      .andWhere('record.collection = :collection', { collection })
      .orderBy('record.tid', reverse ? 'DESC' : 'ASC')
      .limit(limit)

    if (before !== undefined) {
      builder.andWhere('record.tid < :before', { before })
    }
    if (after !== undefined) {
      builder.andWhere('record.tid > :after', { after })
    }

    const res = await builder.getRawMany()
    return res.map((row) => {
      return {
        uri: row.uri,
        value: JSON.parse(row.raw),
      }
    })
  }

  async getRecord(uri: AdxUri): Promise<unknown | null> {
    const record = await this.db
      .getRepository(AdxRecord)
      .findOneBy({ uri: uri.toString() })
    if (record === null) return null
    return JSON.parse(record.raw)
  }

  findTableForCollection(collection: string) {
    const found = Object.values(this.records).find(
      (plugin) => plugin.collection === collection,
    )
    if (!found) {
      throw new Error('Could not find table for collection')
    }
    return found
  }
}

export default Database
