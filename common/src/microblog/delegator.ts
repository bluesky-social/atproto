import axios, { AxiosResponse } from 'axios'
import TID from '../repo/tid.js'

import { Post, Like, schema } from './types.js'
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

  async addPost(text: string): Promise<TID> {
    const tid = TID.next()
    const post: Post = {
      tid: tid.toString(),
      program: this.programName,
      author: this.did,
      text,
      time: new Date().toISOString(),
    }
    try {
      await axios.post(`${this.url}/data/post`, post)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
    return tid
  }

  async editPost(tid: TID, text: string): Promise<void> {
    const updated: Post = {
      tid: tid.toString(),
      program: this.programName,
      author: this.did,
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
    const data = {
      tid: tid.toString(),
      did: this.did,
      program: this.programName,
    }
    try {
      await axios.delete(`${this.url}/data/post`, { data })
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

  async followUser(did: string): Promise<void> {
    const data = { creator: this.did, target: did }
    try {
      await axios.post(`${this.url}/data/relationships`, data)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async unfollowUser(did: string): Promise<void> {
    const data = { creator: this.did, target: did }
    try {
      await axios.delete(`${this.url}/data/relationships`, { data })
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  // async listFollows(): Promise<Follow[]> {
  //   const cids = await this.runOnProgram(async (program) => {
  //     return program.relationships.getEntries()
  //   })
  //   const follows = await Promise.all(
  //     cids.map((c) => this.store.get(c, schema.follow)),
  //   )
  //   return follows
  // }

  async likePost(post: Post): Promise<TID> {
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
    return tid
  }

  async unlikePost(likeTid: TID): Promise<void> {
    const data = {
      tid: likeTid.toString(),
      did: this.did,
      program: this.programName,
    }
    try {
      await axios.delete(`${this.url}/data/interaction`, { data })
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
