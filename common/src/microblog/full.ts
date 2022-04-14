import Repo from '../repo/index.js'

import {
  Post,
  Like,
  schema,
  flattenLike,
  flattenPost,
  MicroblogClient,
} from './types.js'
import TID from '../repo/tid.js'
import MicroblogReader from './reader.js'
import { NAMESPACE } from './const.js'
import Namespace from '../repo/namespace.js'

export class MicroblogFull extends MicroblogReader implements MicroblogClient {
  namespace = NAMESPACE
  repo: Repo
  pushOnUpdate: boolean

  constructor(repo: Repo, url: string, pushOnUpdate = true) {
    super(url, repo.did)
    this.repo = repo
    this.pushOnUpdate = pushOnUpdate
  }

  async register(name: string): Promise<void> {
    return this.repo.register(this.url, name)
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
      tid,
      namespace: this.namespace,
      text,
      author: this.repo.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.repo.put(flattenPost(post))
    await this.runOnNamespace(async (namespace) => {
      await namespace.posts.addEntry(tid, postCid)
    })
    if (this.pushOnUpdate) {
      await this.push()
    }
    return post
  }

  async editPost(tid: TID, text: string): Promise<void> {
    const post: Post = {
      tid,
      namespace: this.namespace,
      text,
      author: this.repo.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.repo.put(flattenPost(post))
    await this.runOnNamespace(async (namespace) => {
      await namespace.posts.editEntry(tid, postCid)
    })
    if (this.pushOnUpdate) {
      await this.push()
    }
  }

  async deletePost(tid: TID): Promise<void> {
    await this.runOnNamespace(async (namespace) => {
      await namespace.posts.deleteEntry(tid)
    })
    if (this.pushOnUpdate) {
      await this.push()
    }
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

  async followUser(nameOrDid: string): Promise<void> {
    const { did, username } = await this.resolveUser(nameOrDid)
    await this.repo.relationships.follow(did, username)
    if (this.pushOnUpdate) {
      await this.push()
    }
  }

  async unfollowUser(nameOrDid: string): Promise<void> {
    const did = await this.resolveDid(nameOrDid)
    await this.repo.relationships.unfollow(did)
    if (this.pushOnUpdate) {
      await this.push()
    }
  }

  async likePost(postAuthorNameOrDid: string, postTid: TID): Promise<Like> {
    const postAuthor = await this.resolveDid(postAuthorNameOrDid)
    const tid = TID.next()
    const like: Like = {
      tid,
      namespace: this.namespace,
      author: this.repo.did,
      time: new Date().toISOString(),
      post_tid: postTid,
      post_author: postAuthor,
      post_namespace: this.namespace,
    }
    const likeCid = await this.repo.put(flattenLike(like))
    await this.runOnNamespace(async (namespace) => {
      await namespace.interactions.addEntry(tid, likeCid)
    })
    if (this.pushOnUpdate) {
      await this.push()
    }
    return like
  }

  async deleteLike(tid: TID): Promise<void> {
    await this.runOnNamespace(async (namespace) => {
      await namespace.interactions.deleteEntry(tid)
    })
    if (this.pushOnUpdate) {
      await this.push()
    }
  }

  async unlikePost(authorNameOrDid: string, postTid: TID): Promise<void> {
    const like = await this.getLikeByPost(authorNameOrDid, postTid)
    if (like === null) {
      throw new Error('Like does not exist')
    }
    await this.deleteLike(like.tid)
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

  async push(): Promise<void> {
    await this.repo.push(this.url)
  }

  async pull(): Promise<void> {
    await this.repo.pull(this.url)
  }

  async runOnNamespace<T>(
    fn: (namespace: Namespace) => Promise<T>,
  ): Promise<T> {
    return this.repo.runOnNamespace(this.namespace, fn)
  }
}

export default MicroblogFull
