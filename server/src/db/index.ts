import { Like, Post } from '@bluesky-demo/common'
import { Follow } from '@bluesky-demo/common/dist/repo/types'
import knex from 'knex'
import { CID } from 'multiformats'
import * as schema from './schema.js'
import { KnexDB } from './types'

export class Database {
  private db: KnexDB

  constructor(db: KnexDB) {
    this.db = db
  }

  static sqlite(location: string): Database {
    const db = knex({
      client: 'sqlite3',
      connection: {
        filename: location,
      },
    })
    return new Database(db)
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
  }

  async createTables(): Promise<void> {
    await schema.createTables(this.db)
  }

  async dropTables(): Promise<void> {
    await schema.dropAll(this.db)
  }

  // USER DIDS
  // -----------

  async registerDid(username: string, did: string): Promise<void> {
    await this.db.insert({ username, did }).into('user_dids')
  }

  async getDidForUser(username: string): Promise<string | null> {
    const row = await this.db
      .select('did')
      .from('user_dids')
      .where({ username })
    if (row.length < 1) return null
    return row[0].did
  }

  async getUsername(did: string): Promise<string | null> {
    const row = await this.db
      .select('username')
      .from('user_dids')
      .where({ did })
    if (row.length < 1) return null
    return row[0].username
  }

  // REPO ROOTS
  // -----------

  async createRepoRoot(did: string, cid: CID): Promise<void> {
    await this.db.insert({ did, root: cid.toString() }).into('repo_roots')
  }

  async updateRepoRoot(did: string, cid: CID): Promise<void> {
    await this.db('repo_roots').where({ did }).update({ root: cid.toString() })
  }

  async getRepoRoot(did: string): Promise<CID | null> {
    const row = await this.db
      .select('root')
      .from('repo_roots')
      .where('did', did)
    return row.length < 1 ? null : CID.parse(row[0].root)
  }

  // POSTS
  // -----------

  async getPost(
    tid: string,
    author: string,
    program: string,
  ): Promise<Post | null> {
    const row = await this.db('microblog_posts')
      .select('*')
      .where({ tid, author, program })
    if (row.length < 1) return null
    return row[0]
  }

  async createPost(post: Post, cid: CID): Promise<void> {
    await this.db('microblog_posts').insert({
      ...post,
      cid: cid.toString(),
    })
  }

  async updatePost(post: Post, cid: CID): Promise<void> {
    const { tid, author, program, text, time } = post
    await this.db('microblog_posts')
      .where({ tid, author, program })
      .update({ text, time, cid: cid.toString() })
  }

  async deletePost(
    tid: string,
    author: string,
    program: string,
  ): Promise<void> {
    await this.db('microblog_posts').where({ tid, author, program }).delete()
  }

  // LIKES
  // -----------

  async getLike(
    tid: string,
    author: string,
    program: string,
  ): Promise<Post | null> {
    const row = await this.db('microblog_interactions')
      .select('*')
      .where({ tid, author, program })
    if (row.length < 1) return null
    return row[0]
  }

  async createLike(like: Like, cid: CID): Promise<void> {
    await this.db('microblog_interactions').insert({
      ...like,
      cid: cid.toString(),
    })
  }

  async deleteLike(
    tid: string,
    author: string,
    program: string,
  ): Promise<void> {
    await this.db('microblog_interactions')
      .where({ tid, author, program })
      .delete()
  }

  // FOLLOWS
  // -----------

  async listFollows(creator: string): Promise<Follow[]> {
    const list = await this.db('follows')
      .join('user_dids', 'follows.target', '=', 'user_dids.did')
      .select('follows.target', 'user_dids.username')
      .where('follows.creator', creator)
    return list.map((f) => ({ did: f.target, username: f.username }))
  }

  async createFollow(creator: string, target: string): Promise<void> {
    await this.db('follows').insert({
      creator,
      target,
    })
  }

  async deleteFollow(creator: string, target: string): Promise<void> {
    await this.db('follows')
      .where({
        creator,
        target,
      })
      .delete()
  }
}

export default Database
