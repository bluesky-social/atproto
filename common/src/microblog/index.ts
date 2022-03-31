import Repo from '../repo/index.js'
import Program from '../repo/program.js'

import { Post, Like, schema } from './types.js'
import TID from '../repo/tid.js'

export class Microblog extends Program {
  constructor(repo: Repo) {
    super('did:bsky:microblog', repo)
  }

  async getPost(id: TID): Promise<Post | null> {
    const postCid = await this.runOnProgram(async (program) => {
      return program.posts.getEntry(id)
    })
    if (postCid === null) return null
    const post = await this.repo.get(postCid, schema.post)
    return post
  }

  async addPost(text: string): Promise<Post> {
    const tid = TID.next()
    const post: Post = {
      tid: tid.toString(),
      program: this.name,
      text,
      author: this.repo.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.repo.put(post)
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
      author: this.repo.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.repo.put(post)
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
      entries.map((entry) => this.repo.get(entry.cid, schema.post)),
    )
    return posts
  }

  async likePost(postAuthor: string, postTid: TID): Promise<TID> {
    const tid = TID.next()
    const like: Like = {
      tid: tid.toString(),
      program: this.name,
      author: this.repo.did,
      time: new Date().toISOString(),
      post_tid: postTid.toString(),
      post_author: postAuthor,
      post_program: this.name,
    }
    const likeCid = await this.repo.put(like)
    await this.runOnProgram(async (program) => {
      await program.interactions.addEntry(tid, likeCid)
    })
    return tid
  }

  async deleteLike(tid: TID): Promise<void> {
    await this.runOnProgram(async (program) => {
      await program.interactions.deleteEntry(tid)
    })
  }

  async listLikes(count: number, from?: TID): Promise<Like[]> {
    const entries = await this.runOnProgram(async (program) => {
      return program.interactions.getEntries(count, from)
    })
    const likes = await Promise.all(
      entries.map((entry) => this.repo.get(entry.cid, schema.like)),
    )
    return likes
  }
}

export default Microblog
