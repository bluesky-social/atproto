import axios, { AxiosResponse } from 'axios'
import TID from '../repo/tid.js'

import { Post, Like, schema, Timeline } from './types.js'
import * as check from '../common/check.js'
import { assureAxiosError } from '../network/util.js'
import IpldStore from '../blockstore/ipld-store.js'
import * as ucan from 'ucans'
import { Follow } from '../repo/types.js'

export class MicroblogDelegator {
  programName = 'did:bsky:microblog'
  did: string
  blockstore: IpldStore

  constructor(
    public url: string,
    private keypair: ucan.Keypair & ucan.Didable,
  ) {
    // ephemeral used for quick block storage & getting CIDs
    this.did = keypair.did()
    this.blockstore = IpldStore.createInMemory()
  }

  async register(username: string): Promise<void> {
    const data = { username, did: this.did }
    try {
      await axios.post(`${this.url}/id/register`, data)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async lookupDid(username: string): Promise<string> {
    const params = { resource: username }
    try {
      const res = await axios.get(`${this.url}/.well-known/webfinger`, {
        params,
      })
      return res.data.id
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async retrieveTimeline(count: number, from?: TID): Promise<Timeline> {
    const params = { user: this.did, count, from: from?.toString() }
    try {
      const res = await axios.get(`${this.url}/indexer/timeline`, { params })
      return res.data
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async getPost(tid: TID): Promise<Post | null> {
    return this.getPostFromUser(this.did, tid)
  }

  async getPostFromUser(did: string, tid: TID): Promise<Post | null> {
    const params = {
      tid: tid.toString(),
      did: did,
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

  async addPost(text: string): Promise<Post> {
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
    return post
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

  async listPosts(count: number, from?: TID): Promise<Post[]> {
    return this.listPostsFromUser(this.did, count, from)
  }

  async listPostsFromUser(
    did: string,
    count: number,
    from?: TID,
  ): Promise<Post[]> {
    const params = {
      did,
      program: this.programName,
      count,
      from: from?.toString(),
    }
    try {
      const res = await axios.get(`${this.url}/data/post/list`, {
        params,
      })
      return res.data
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async followUser(did: string): Promise<void> {
    const data = { creator: this.did, target: did }
    try {
      await axios.post(`${this.url}/data/relationship`, data)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async unfollowUser(did: string): Promise<void> {
    const data = { creator: this.did, target: did }
    try {
      await axios.delete(`${this.url}/data/relationship`, { data })
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async listFollows(): Promise<Follow[]> {
    return this.listFollowsFromUser(this.did)
  }

  async listFollowsFromUser(did: string): Promise<Follow[]> {
    const params = { user: did || this.did }
    try {
      const res = await axios.get(`${this.url}/data/relationship/list`, {
        params,
      })
      return res.data
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async likePost(postAuthor: string, postTid: TID): Promise<Like> {
    const tid = TID.next()
    const like: Like = {
      tid: tid.toString(),
      program: this.programName,
      author: this.did,
      time: new Date().toISOString(),
      post_tid: postTid.toString(),
      post_author: postAuthor,
      post_program: this.programName,
    }
    try {
      await axios.post(`${this.url}/data/interaction`, like)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
    return like
  }

  async deleteLike(likeTid: TID): Promise<void> {
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

  async listLikes(count: number, from?: TID): Promise<Like[]> {
    return this.listLikesFromUser(this.did, count, from)
  }

  async listLikesFromUser(
    did: string,
    count: number,
    from?: TID,
  ): Promise<Like[]> {
    const params = {
      did,
      program: this.programName,
      count,
      from: from?.toString(),
    }
    try {
      const res = await axios.get(`${this.url}/data/interaction/list`, {
        params,
      })
      return res.data
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async likeCount(author: string, tid: TID): Promise<number> {
    const params = {
      author,
      program: this.programName,
      tid: tid.toString(),
    }
    try {
      const res = await axios.get(`${this.url}/indexer/count/likes`, {
        params,
      })
      return res.data.count
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }
}

export default MicroblogDelegator
