import axios, { AxiosError, AxiosResponse } from 'axios'
import TID from '../user-store/tid.js'

import { Post, Follow, Like, schema } from './types.js'
import { DID } from '../common/types.js'
import * as check from '../common/check.js'
import { assureAxiosError } from '../network/util.js'
import IpldStore from '../blockstore/ipld-store.js'

export class MicroblogDelegator {
  programName = 'did:bsky:microblog'
  blockstore: IpldStore

  constructor(public url: string, public did: string) {
    // ephemeral used for quick block storage & getting CIDs
    this.blockstore = IpldStore.createInMemory()
  }

  async getPost(tid: TID): Promise<Post | null> {
    const params = {
      tid: tid.toString(),
      did: this.did,
      program: this.programName,
    }
    let res: AxiosResponse
    try {
      res = await axios.get(`${this.url}/data/post`, { params })
    } catch (e) {
      const err = assureAxiosError(e)
      if (err.response?.status === 404) {
        return null
      }
      throw new Error(err.message)
    }
    if (!check.is(res.data, schema.post)) {
      throw new Error('Did not receive a valid post object')
    }
    return res.data
  }

  async addPost(text: string): Promise<void> {
    const tid = TID.next()
    const post: Post = {
      tid: tid.toString(),
      program: this.programName,
      text,
      author: this.did,
      time: new Date().toISOString(),
    }
    try {
      await axios.post(`${this.url}/data/post`, post)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async editPost(post: Post, text: string): Promise<void> {
    const updated: Post = {
      tid: post.tid,
      program: post.program,
      author: post.author,
      text,
      time: new Date().toISOString(),
    }
    try {
      await axios.put(`${this.url}/data/post`, updated)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async deletePost(tid: TID): Promise<void> {
    const params = {
      tid: tid.toString(),
      did: this.did,
      program: this.programName,
    }
    try {
      await axios.delete(`${this.url}/data/post`, { params })
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  // async listPosts(count: number, from?: TID): Promise<Post[]> {
  //   const entries = await this.runOnProgram(async (program) => {
  //     return program.posts.getEntries(count, from)
  //   })
  //   const posts = await Promise.all(
  //     entries.map((entry) => this.store.get(entry.cid, schema.post)),
  //   )
  //   return posts
  // }

  // async getFollow(did: DID): Promise<Follow | null> {
  //   const cid = await this.runOnProgram(async (program) => {
  //     return program.relationships.getEntry(did)
  //   })
  //   if (cid === null) return null
  //   return this.store.get(cid, schema.follow)
  // }

  // async isFollowing(did: DID): Promise<boolean> {
  //   return this.runOnProgram(async (program) => {
  //     return program.relationships.hasEntry(did)
  //   })
  // }

  // async followUser(username: string, did: string): Promise<void> {
  //   const follow: Follow = { username, did }
  //   const cid = await this.store.put(follow)
  //   await this.runOnProgram(async (program) => {
  //     await program.relationships.addEntry(did, cid)
  //   })
  // }

  // async unfollowUser(did: string): Promise<void> {
  //   await this.runOnProgram(async (program) => {
  //     await program.relationships.deleteEntry(did)
  //   })
  // }

  // async listFollows(): Promise<Follow[]> {
  //   const cids = await this.runOnProgram(async (program) => {
  //     return program.relationships.getEntries()
  //   })
  //   const follows = await Promise.all(
  //     cids.map((c) => this.store.get(c, schema.follow)),
  //   )
  //   return follows
  // }

  async likePost(post: Post): Promise<void> {
    const postCid = await this.blockstore.put(post)
    const tid = TID.next()
    const like: Like = {
      tid: tid.toString(),
      program: this.programName,
      author: this.did,
      time: new Date().toISOString(),
      post_tid: post.tid,
      post_author: post.author,
      post_program: post.program,
      post_cid: postCid,
    }
    try {
      await axios.post(`${this.url}/data/interaction`, like)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async unlikePost(likeTid: TID): Promise<void> {
    const params = {
      tid: likeTid.toString(),
      did: this.did,
      program: this.programName,
    }
    try {
      await axios.delete(`${this.url}/data/interaction`, { params })
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  // async listLikes(count: number, from?: TID): Promise<Like[]> {
  //   const entries = await this.runOnProgram(async (program) => {
  //     return program.interactions.getEntries(count, from)
  //   })
  //   const likes = await Promise.all(
  //     entries.map((entry) => this.store.get(entry.cid, schema.like)),
  //   )
  //   return likes
  // }
}

export default MicroblogDelegator
