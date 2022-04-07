import Repo from '../repo/index.js'
import NamespaceImpl from '../repo/namespace-impl.js'

import { Post, Like, schema } from './types.js'
import TID from '../repo/tid.js'

export class Microblog extends NamespaceImpl {
  constructor(repo: Repo) {
    super('did:bsky:microblog', repo)
  }

  async getPost(id: TID): Promise<Post | null> {
    const postCid = await this.runOnNamespace(async (namespace) => {
      return namespace.posts.getEntry(id)
    })
    if (postCid === null) return null
    const post = await this.repo.get(postCid, schema.post)
    return post
  }

  async addPost(text: string): Promise<Post> {
    const tid = TID.next()
    const post: Post = {
      tid: tid.toString(),
      namespace: this.name,
      text,
      author: this.repo.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.repo.put(post)
    await this.runOnNamespace(async (namespace) => {
      await namespace.posts.addEntry(tid, postCid)
    })
    return post
  }

  async editPost(tid: TID, text: string): Promise<void> {
    const post: Post = {
      tid: tid.toString(),
      namespace: this.name,
      text,
      author: this.repo.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.repo.put(post)
    await this.runOnNamespace(async (namespace) => {
      await namespace.posts.editEntry(tid, postCid)
    })
  }

  async deletePost(tid: TID): Promise<void> {
    await this.runOnNamespace(async (namespace) => {
      await namespace.posts.deleteEntry(tid)
    })
  }

  async listPosts(count: number, from?: TID): Promise<Post[]> {
    const entries = await this.runOnNamespace(async (namespace) => {
      return namespace.posts.getEntries(count, from)
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
      namespace: this.name,
      author: this.repo.did,
      time: new Date().toISOString(),
      post_tid: postTid.toString(),
      post_author: postAuthor,
      post_namespace: this.name,
    }
    const likeCid = await this.repo.put(like)
    await this.runOnNamespace(async (namespace) => {
      await namespace.interactions.addEntry(tid, likeCid)
    })
    return tid
  }

  async deleteLike(tid: TID): Promise<void> {
    await this.runOnNamespace(async (namespace) => {
      await namespace.interactions.deleteEntry(tid)
    })
  }

  async listLikes(count: number, from?: TID): Promise<Like[]> {
    const entries = await this.runOnNamespace(async (namespace) => {
      return namespace.interactions.getEntries(count, from)
    })
    const likes = await Promise.all(
      entries.map((entry) => this.repo.get(entry.cid, schema.like)),
    )
    return likes
  }
}

export default Microblog
