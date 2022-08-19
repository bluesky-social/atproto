import { Follow, Like, Post } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { DbPlugin } from './types'
import postPlugin, { PostIndex } from './records/posts'
import likePlugin, { LikeIndex } from './records/likes'
import followPlugin, { FollowIndex } from './records/follows'
import { AdxUri } from '@adxp/common'

export class Database {
  db: DataSource
  records: {
    posts: DbPlugin<Post.Record>
    likes: DbPlugin<Like.Record>
    follows: DbPlugin<Follow.Record>
  }

  constructor(db: DataSource) {
    this.db = db
    this.records = {
      posts: postPlugin(db),
      likes: likePlugin(db),
      follows: followPlugin(db),
    }
    this.db.synchronize()
  }

  static async sqlite(location: string): Promise<Database> {
    const db = new DataSource({
      type: 'sqlite',
      database: location,
      entities: [PostIndex, LikeIndex, FollowIndex],
    })
    await db.initialize()
    return new Database(db)
  }

  async addRecord(uri: AdxUri, obj: unknown) {
    const table = this.findTableForCollection(uri.collection)
    await table.set(uri, obj)
  }

  async deleteRecord(uri: AdxUri) {
    const table = this.findTableForCollection(uri.collection)
    await table.delete(uri)
  }

  findTableForCollection(collection: string) {
    console.log(Object.values(this.records))
    console.log(collection)
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
