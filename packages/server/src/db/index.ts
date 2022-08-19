import { Like, Post } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { DbPlugin } from './types'
import postPlugin from './posts'
import { AdxUri } from '@adxp/common'

export class DB {
  db: DataSource
  records: {
    posts: DbPlugin<Post.Record>
    likes: DbPlugin<Like.Record>
  }

  constructor(db: DataSource) {
    this.db = db
    this.records = {
      posts: postPlugin(db),
      likes: {} as any,
    }
    this.db.synchronize()
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
    const found = Object.values(this.records).find(
      (plugin) => plugin.collection === collection,
    )
    if (!found) {
      throw new Error('Could not find table for collection')
    }
    return found
  }
}
