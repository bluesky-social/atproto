import UserStore from '../user-store/index.js'
import Program from '../user-store/program.js'

import { Post, Follow, Like, schema } from './types.js'
import { DID } from '../common/types.js'
import * as check from '../common/check.js'
import TID from '../user-store/tid.js'

export class Microblog extends Program {
  constructor(store: UserStore) {
    super('did:bsky:microblog', store)
  }

  async getPost(id: TID): Promise<Post | null> {
    const postCid = await this.runOnProgram(async (program) => {
      return program.posts.getEntry(id)
    })
    if (postCid === null) return null
    const post = await this.store.get(postCid, check.assure(schema.post))
    return post
  }

  async addPost(text: string): Promise<Post> {
    const tid = TID.next()
    const post: Post = {
      tid: tid.toString(),
      program: this.name,
      text,
      author: this.store.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.store.put(post)
    await this.runOnProgram(async (program) => {
      await program.posts.addEntry(tid, postCid)
    })
    return post
  }

  async editPost(tid: TID, text: string): Promise<void> {
    const post: Post = {
      tid: tid.toString(),
      program: this.name,
      text,
      author: this.store.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.store.put(post)
    await this.runOnProgram(async (program) => {
      await program.posts.editEntry(tid, postCid)
    })
  }

  async deletePost(tid: TID): Promise<void> {
    await this.runOnProgram(async (program) => {
      await program.posts.deleteEntry(tid)
    })
  }

  async listPosts(count: number, from?: TID): Promise<Post[]> {
    const entries = await this.runOnProgram(async (program) => {
      return program.posts.getEntries(count, from)
    })
    const posts = await Promise.all(
      entries.map((entry) =>
        this.store.get(entry.cid, check.assure(schema.post)),
      ),
    )
    return posts
  }

  async getFollow(did: DID): Promise<Follow | null> {
    const cid = await this.runOnProgram(async (program) => {
      return program.relationships.getEntry(did)
    })
    if (cid === null) return null
    return this.store.get(cid, check.assure(schema.follow))
  }

  async isFollowing(did: DID): Promise<boolean> {
    return this.runOnProgram(async (program) => {
      return program.relationships.hasEntry(did)
    })
  }

  async followUser(username: string, did: string): Promise<void> {
    const follow: Follow = { username, did }
    const cid = await this.store.put(follow)
    await this.runOnProgram(async (program) => {
      await program.relationships.addEntry(did, cid)
    })
  }

  async unfollowUser(did: string): Promise<void> {
    await this.runOnProgram(async (program) => {
      await program.relationships.deleteEntry(did)
    })
  }

  async listFollows(): Promise<Follow[]> {
    const cids = await this.runOnProgram(async (program) => {
      return program.relationships.getEntries()
    })
    const follows = await Promise.all(
      cids.map((c) => this.store.get(c, check.assure(schema.follow))),
    )
    return follows
  }

  async likePost(post: Post): Promise<TID> {
    const postCid = await this.store.put(post)
    const tid = TID.next()
    const like: Like = {
      tid: tid.toString(),
      program: this.name,
      author: this.store.did,
      time: new Date().toISOString(),
      post_tid: post.tid,
      post_author: post.author,
      post_program: post.program,
      post_cid: postCid,
    }
    const likeCid = await this.store.put(like)
    await this.runOnProgram(async (program) => {
      await program.interactions.addEntry(tid, likeCid)
    })
    return tid
  }

  async unlikePost(tid: TID): Promise<void> {
    await this.runOnProgram(async (program) => {
      await program.interactions.deleteEntry(tid)
    })
  }

  async listLikes(count: number, from?: TID): Promise<Like[]> {
    const entries = await this.runOnProgram(async (program) => {
      return program.interactions.getEntries(count, from)
    })
    const likes = await Promise.all(
      entries.map((entry) =>
        this.store.get(entry.cid, check.assure(schema.like)),
      ),
    )
    return likes
  }
}

export default Microblog
