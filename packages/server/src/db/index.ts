import {
  Like,
  Post,
  Timeline,
  AccountInfo,
  TimelinePost,
  Follow,
} from '@adxp/common'
import knex from 'knex'
import { CID } from 'multiformats'
import * as schema from './schema'
import { KnexDB } from './types'
import { ServerError } from '../error'

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

  async close(): Promise<void> {
    await this.db.destroy()
  }

  // DID NETWORK
  // -----------

  async registerOnDidNetwork(
    username: string,
    did: string,
    host: string,
  ): Promise<void> {
    await this.db.insert({ username, did, host }).into('did_network')
  }

  async getUsernameFromDidNetwork(did: string): Promise<string | null> {
    const row = await this.db.select('*').from('did_network').where({ did })
    if (row.length < 1) return null
    return `${row[0].username}@${row[0].host}`
  }

  // USER DIDS
  // -----------

  async registerDid(
    username: string,
    did: string,
    host: string,
  ): Promise<void> {
    await this.db
      .insert({ username, did, host })
      .into('user_dids')
      .onConflict()
      .ignore()
  }

  async getDidForUser(username: string, host: string): Promise<string | null> {
    const row = await this.db
      .select('did')
      .from('user_dids')
      .where({ username, host })
    if (row.length < 1) return null
    return row[0].did
  }

  async getUsername(did: string): Promise<string | null> {
    const row = await this.db.select('*').from('user_dids').where({ did })
    if (row.length < 1) return null
    return `${row[0].username}@${row[0].host}`
  }

  async isDidRegistered(did: string): Promise<boolean> {
    const un = await this.getUsername(did)
    return un !== null
  }

  async isNameRegistered(username: string, host: string): Promise<boolean> {
    const did = await this.getDidForUser(username, host)
    return did !== null
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

  // SERVER SUBSCRIPTIONS
  // -----------

  async createSubscription(host: string, user: string): Promise<void> {
    await this.db.insert({ host, user }).into('subscriptions')
  }

  async getSubscriptionsForUser(user: string): Promise<string[]> {
    const res = await this.db
      .select('host')
      .from('subscriptions')
      .where({ user })
    return res.map((row) => row.host)
  }

  // POSTS
  // -----------

  async getPost(
    tid: string,
    author: string,
    namespace: string,
  ): Promise<Post | null> {
    const row = await this.db('posts')
      .select('*')
      .where({ tid, author, namespace })
    if (row.length < 1) return null
    return row[0]
  }

  async createPost(post: Post, cid: CID): Promise<void> {
    await this.db('posts').insert({
      ...post,
      cid: cid.toString(),
    })
  }

  async updatePost(post: Post, cid: CID): Promise<void> {
    const { tid, author, namespace, text, time } = post
    await this.db('posts')
      .where({ tid, author, namespace })
      .update({ text, time, cid: cid.toString() })
  }

  async deletePost(
    tid: string,
    author: string,
    namespace: string,
  ): Promise<void> {
    await this.db('posts').where({ tid, author, namespace }).del()
  }

  async postCount(author: string): Promise<number> {
    const res = await this.db('posts').count('*').where({ author })
    const count = (res[0] || {})['count(*)']
    if (typeof count !== 'number') {
      throw new ServerError(500, 'Unable to retrieve post count')
    }
    return count
  }

  // LIKES
  // -----------

  async getLike(
    tid: string,
    author: string,
    namespace: string,
  ): Promise<Like | null> {
    const row = await this.db('likes')
      .select('*')
      .where({ tid, author, namespace })
    if (row.length < 1) return null
    return row[0]
  }

  async getLikeByPost(
    author: string,
    post_tid: string,
    post_author: string,
    post_namespace: string,
  ): Promise<Like | null> {
    const row = await this.db('likes')
      .select('*')
      .where({ author, post_tid, post_author, post_namespace })
    if (row.length < 1) return null
    return row[0]
  }

  async createLike(like: Like, cid: CID): Promise<void> {
    await this.db('likes').insert({
      ...like,
      cid: cid.toString(),
    })
  }

  async deleteLike(
    tid: string,
    author: string,
    namespace: string,
  ): Promise<void> {
    await this.db('likes').where({ tid, author, namespace }).delete()
  }

  // FOLLOWS
  // -----------

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

  async listFollows(creator: string): Promise<Follow[]> {
    const list = await this.db('follows')
      .join('user_dids', 'follows.target', '=', 'user_dids.did')
      .select('follows.target', 'user_dids.username', 'user_dids.host')
      .where('follows.creator', creator)
    return list.map((f) => ({
      did: f.target,
      username: `${f.username}@${f.host}`,
    }))
  }

  async listFollowers(target: string): Promise<Follow[]> {
    const list = await this.db('follows')
      .join('user_dids', 'follows.creator', '=', 'user_dids.did')
      .select('follows.creator', 'user_dids.username', 'user_dids.host')
      .where('follows.target', target)
    return list.map((f) => ({
      did: f.creator,
      username: `${f.username}@${f.host}`,
    }))
  }

  async followCount(creator: string): Promise<number> {
    const res = await this.db('follows')
      .count('*')
      .where('follows.creator', creator)
    const count = (res[0] || {})['count(*)']
    if (typeof count !== 'number') {
      throw new ServerError(500, 'Unable to retrieve follows count')
    }
    return count
  }

  async followerCount(target: string): Promise<number> {
    const res = await this.db('follows')
      .count('*')
      .where('follows.target', target)
    const count = (res[0] || {})['count(*)']
    if (typeof count !== 'number') {
      throw new ServerError(500, 'Unable to retrieve followers count')
    }
    return count
  }

  // INDEXER
  // -----------

  async retrievePostInfo(
    tid: string,
    author: string,
    namespace: string,
  ): Promise<TimelinePost | null> {
    const row = await this.db('posts')
      .join('user_dids', 'posts.author', '=', 'user_dids.did')
      .select('*')
      .where({ tid, author, namespace })
    if (row.length < 1) return null
    const p = row[0]
    return {
      tid: p.tid,
      author: p.author,
      author_name: `${p.username}@${p.host}`,
      text: p.text,
      time: p.time,
      likes: await this.likeCount(p.author, p.namespace, p.tid),
    }
  }

  async retrieveFeed(
    user: string,
    count: number,
    from?: string,
  ): Promise<Timeline> {
    // fallback to a fake TID that is larger than any possible
    const username = await this.getUsername(user)
    if (!username) {
      throw new ServerError(404, `Could not find user ${user}`)
    }
    const olderThan = from || 'zzzzzzzzzzzzz'
    const feed = await this.db('posts')
      .where('posts.author', user)
      .where('posts.tid', '<', olderThan)
      .select('*')
      .orderBy('posts.tid', 'desc')
      .limit(count)

    return Promise.all(
      feed.map(async (p) => ({
        tid: p.tid,
        author: p.author,
        author_name: username,
        text: p.text,
        time: p.time,
        likes: await this.likeCount(p.author, p.namespace, p.tid),
      })),
    )
  }

  async retrieveTimeline(
    user: string,
    count: number,
    from?: string,
  ): Promise<Timeline> {
    // fallback to a fake TID that is larger than any possible
    const olderThan = from || 'zzzzzzzzzzzzz'
    const timeline = await this.db('posts')
      .join('user_dids', 'posts.author', '=', 'user_dids.did')
      .leftJoin('follows', 'posts.author', '=', 'follows.target')
      .where(function () {
        this.where('follows.creator', user).orWhere('posts.author', user)
      })
      .where('posts.tid', '<', olderThan)
      .select('posts.*', 'user_dids.username', 'user_dids.host')
      .orderBy('posts.tid', 'desc')
      .limit(count)
    return Promise.all(
      timeline.map(async (p) => ({
        tid: p.tid,
        author: p.author,
        author_name: `${p.username}@${p.host}`,
        text: p.text,
        time: p.time,
        likes: await this.likeCount(p.author, p.namespace, p.tid),
      })),
    )
  }

  async likeCount(
    author: string,
    namespace: string,
    tid: string,
  ): Promise<number> {
    const res = await this.db('likes').count('*').where({
      post_author: author,
      post_namespace: namespace,
      post_tid: tid,
    })
    const count = (res[0] || {})['count(*)']
    if (typeof count !== 'number') {
      throw new ServerError(500, 'Unable to retrieve like count on post')
    }
    return count
  }

  async getAccountInfo(did: string): Promise<AccountInfo> {
    const [username, postCount, followerCount, followCount] = await Promise.all(
      [
        this.getUsername(did),
        this.postCount(did),
        this.followerCount(did),
        this.followCount(did),
      ],
    )
    if (username === null) {
      throw new ServerError(404, 'Could not find user')
    }
    return {
      did,
      username,
      postCount,
      followerCount,
      followCount,
    }
  }
}

export default Database
