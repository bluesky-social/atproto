import axios from 'axios'
import TID from '../repo/tid.js'

import { z } from 'zod'
import {
  Post,
  Like,
  flattenPost,
  flattenLike,
  MicroblogClient,
} from './types.js'
import * as check from '../common/check.js'
import { parseAxiosError, cleanHostUrl, authCfg } from '../network/util.js'
import * as ucan from 'ucans'
import { Collection } from '../repo/types.js'
import { Keypair } from '../common/types.js'
import * as auth from '../auth/index.js'
import * as service from '../network/service.js'
import MicroblogReader from './reader.js'

export class MicroblogDelegator
  extends MicroblogReader
  implements MicroblogClient
{
  namespace = 'did:bsky:microblog'
  keypair: Keypair | null
  ucanStore: ucan.Store | null
  did: string

  constructor(
    url: string,
    did: string,
    keypair?: Keypair,
    ucanStore?: ucan.Store,
  ) {
    super(url, did)
    this.did = did
    this.keypair = keypair || null
    this.ucanStore = ucanStore || null
  }

  async register(name: string): Promise<void> {
    if (!this.keypair) {
      throw new Error('No keypair or ucan store provided. Client is read-only.')
    }
    // register on data server
    const token = await this.maintenanceToken()
    await service.register(this.url, name, this.did, true, token)

    const host = cleanHostUrl(this.url)
    const username = `${name}@${host}`

    // register on did network
    await service.registerToDidNetwork(username, this.keypair)
  }

  async addPost(text: string): Promise<Post> {
    const tid = TID.next()
    const post: Post = {
      tid,
      namespace: this.namespace,
      author: this.did,
      text,
      time: new Date().toISOString(),
    }
    const token = await this.postToken('posts', tid)
    try {
      await axios.post(
        `${this.url}/data/post`,
        flattenPost(post),
        authCfg(token),
      )
    } catch (e) {
      const err = parseAxiosError(e)
      throw new Error(err.msg)
    }
    return post
  }

  async editPost(tid: TID, text: string): Promise<void> {
    const updated: Post = {
      tid,
      namespace: this.namespace,
      author: this.did,
      text,
      time: new Date().toISOString(),
    }
    const token = await this.postToken('posts', tid)
    try {
      await axios.put(
        `${this.url}/data/post`,
        flattenPost(updated),
        authCfg(token),
      )
    } catch (e) {
      const err = parseAxiosError(e)
      throw new Error(err.msg)
    }
  }

  async deletePost(tid: TID): Promise<void> {
    const data = {
      tid: tid.toString(),
      did: this.did,
      namespace: this.namespace,
    }
    const token = await this.postToken('posts', tid)
    try {
      await axios.delete(`${this.url}/data/post`, {
        data,
        ...authCfg(token),
      })
    } catch (e) {
      const err = parseAxiosError(e)
      throw new Error(err.msg)
    }
  }

  async followUser(nameOrDid: string): Promise<void> {
    const target = await this.resolveDid(nameOrDid)
    const data = { creator: this.did, target }
    const token = await this.relationshipToken()
    try {
      await axios.post(`${this.url}/data/relationship`, data, authCfg(token))
    } catch (e) {
      const err = parseAxiosError(e)
      throw new Error(err.msg)
    }
  }

  async unfollowUser(nameOrDid: string): Promise<void> {
    const target = await this.resolveDid(nameOrDid)
    const data = { creator: this.did, target: target }
    const token = await this.relationshipToken()
    try {
      await axios.delete(`${this.url}/data/relationship`, {
        data,
        ...authCfg(token),
      })
    } catch (e) {
      const err = parseAxiosError(e)
      throw new Error(err.msg)
    }
  }

  async likePost(postAuthorNameOrDid: string, postTid: TID): Promise<Like> {
    const postAuthor = await this.resolveDid(postAuthorNameOrDid)
    const tid = TID.next()
    const like: Like = {
      tid,
      namespace: this.namespace,
      author: this.did,
      time: new Date().toISOString(),
      post_tid: postTid,
      post_author: postAuthor,
      post_namespace: this.namespace,
    }
    const token = await this.postToken('interactions', tid)
    try {
      await axios.post(
        `${this.url}/data/interaction`,
        flattenLike(like),
        authCfg(token),
      )
    } catch (e) {
      const err = parseAxiosError(e)
      throw new Error(err.msg)
    }
    return like
  }

  async deleteLike(likeTid: TID): Promise<void> {
    const data = {
      tid: likeTid.toString(),
      did: this.did,
      namespace: this.namespace,
    }
    const token = await this.postToken('interactions', likeTid)
    try {
      await axios.delete(`${this.url}/data/interaction`, {
        data,
        ...authCfg(token),
      })
    } catch (e) {
      const err = parseAxiosError(e)
      throw new Error(err.msg)
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
    return this.listLikesFromUser(this.did, count, from)
  }

  async likeCount(author: string, tid: TID): Promise<number> {
    const params = {
      author,
      namespace: this.namespace,
      tid: tid.toString(),
    }
    try {
      const res = await axios.get(`${this.url}/indexer/count/likes`, {
        params,
      })
      return check.assure(z.number(), res.data.count)
    } catch (e) {
      const err = parseAxiosError(e)
      throw new Error(err.msg)
    }
  }

  async export(): Promise<Uint8Array> {
    const car = await service.pullRepo(this.url, this.did)
    if (car === null) {
      throw new Error(`Could not fetch repo ${this.did} from ${this.url}`)
    }
    return car
  }

  // UCAN Creators
  // --------------

  async maintenanceToken(): Promise<ucan.Chained> {
    if (this.keypair === null || this.ucanStore === null) {
      throw new Error('No keypair or ucan store provided. Client is read-only.')
    }
    const serverDid = await this.getOwnServerDid()
    return auth.delegateMaintenance(serverDid, this.keypair, this.ucanStore)
  }

  async relationshipToken(): Promise<ucan.Chained> {
    if (this.keypair === null || this.ucanStore === null) {
      throw new Error('No keypair or ucan store provided. Client is read-only.')
    }
    const serverDid = await this.getOwnServerDid()
    return auth.delegateForRelationship(
      serverDid,
      this.did,
      this.keypair,
      this.ucanStore,
    )
  }

  async postToken(collection: Collection, tid: TID): Promise<ucan.Chained> {
    if (this.keypair === null || this.ucanStore === null) {
      throw new Error('No keypair or ucan store provided. Client is read-only.')
    }
    const serverDid = await this.getOwnServerDid()
    return auth.delegateForPost(
      serverDid,
      this.did,
      this.namespace,
      collection,
      tid,
      this.keypair,
      this.ucanStore,
    )
  }
}

export default MicroblogDelegator
