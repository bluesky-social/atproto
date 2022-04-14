import axios, { AxiosResponse } from 'axios'
import TID from '../repo/tid.js'

import { z } from 'zod'
import {
  Post,
  Like,
  schema,
  AccountInfo,
  Timeline,
  TimelinePost,
  MicroblogReaderI,
} from './types.js'
import { schema as repoSchema } from '../repo/types.js'
import * as check from '../common/check.js'
import { assureAxiosError } from '../network/util.js'
import { Follow } from '../repo/types.js'
import * as service from '../network/service.js'

export class MicroblogReader implements MicroblogReaderI {
  namespace = 'did:bsky:microblog'

  url: string
  did?: string

  constructor(url: string, did?: string) {
    this.url = url
    this.did = did
  }

  ownDid(): string {
    if (this.did) {
      return this.did
    }
    throw new Error('No User DID provided')
  }

  // DIDs & Username
  // ----------------

  async getOwnServerDid(): Promise<string> {
    return this.getServerDid(this.url)
  }

  async getServerDid(url: string): Promise<string> {
    return await service.getServerDid(url)
  }

  async resolveUser(
    nameOrDid: string,
  ): Promise<{ username: string; did: string; hostUrl: string }> {
    let username, did
    if (nameOrDid.startsWith('did:')) {
      did = nameOrDid
      username = await this.resolveUsername(nameOrDid)
    } else {
      username = nameOrDid
      did = await this.resolveDid(nameOrDid)
    }
    const { hostUrl } = this.normalizeUsername(username)
    return {
      username,
      did,
      hostUrl,
    }
  }

  async resolveDid(nameOrDid: string): Promise<string> {
    if (nameOrDid.startsWith('did:')) return nameOrDid
    const did = await this.lookupDid(nameOrDid)
    if (!did) {
      throw new Error(`Coult not find user: ${nameOrDid}`)
    }
    return did
  }

  async resolveUsername(nameOrDid: string): Promise<string> {
    if (!nameOrDid.startsWith('did:')) return nameOrDid
    const username = await this.lookupUsername(nameOrDid)
    if (!username) {
      throw new Error(`Coult not find user: ${nameOrDid}`)
    }
    return username
  }

  async lookupDid(username: string): Promise<string | null> {
    const { name, hostUrl } = this.normalizeUsername(username)
    return service.lookupDid(hostUrl, name)
  }

  async lookupUsername(did: string): Promise<string | null> {
    return service.getUsernameFromDidNetwork(did)
  }

  normalizeUsername(username: string): { name: string; hostUrl: string } {
    const [name, host] = username.split('@')
    if (host) {
      return { name, hostUrl: 'http://' + host }
    } else {
      throw new Error(
        `Can't normalize username (${username}), host segment not found`,
      )
    }
  }

  // Indexed Data
  // ----------------

  async getAccountInfo(nameOrDid: string): Promise<AccountInfo | null> {
    const { hostUrl, did } = await this.resolveUser(nameOrDid)
    const params = { did }
    try {
      const res = await axios.get(`${hostUrl}/indexer/account-info`, {
        params,
      })
      return check.assure(schema.accountInfo, res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      if (err.response?.status === 404) {
        return null
      }
      throw new Error(err.message)
    }
  }

  async retrieveFeed(
    nameOrDid: string,
    count: number,
    from?: TID,
  ): Promise<Timeline | null> {
    const { hostUrl, did } = await this.resolveUser(nameOrDid)
    const params = { user: did, count, from: from?.toString() }
    try {
      const res = await axios.get(`${hostUrl}/indexer/feed`, {
        params,
      })
      return check.assure(schema.timeline, res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      if (err.response?.status === 404) {
        return null
      }
      throw new Error(err.message)
    }
  }

  async retrieveTimeline(count: number, from?: TID): Promise<Timeline> {
    const params = { user: this.ownDid(), count, from: from?.toString() }
    try {
      const res = await axios.get(`${this.url}/indexer/timeline`, { params })
      return check.assure(schema.timeline, res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async getPostInfo(nameOrDid: string, tid: TID): Promise<TimelinePost | null> {
    const { hostUrl, did } = await this.resolveUser(nameOrDid)
    const params = { did, namespace: this.namespace, tid: tid.toString() }
    try {
      const res = await axios.get(`${hostUrl}/indexer/post-info`, {
        params,
      })
      return check.assure(schema.timelinePost, res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      if (err.response?.status === 404) {
        return null
      }
      throw new Error(err.message)
    }
  }

  async getPost(tid: TID): Promise<Post | null> {
    return this.getPostFromUser(this.ownDid(), tid)
  }

  async getPostFromUser(nameOrDid: string, tid: TID): Promise<Post | null> {
    const { hostUrl, did } = await this.resolveUser(nameOrDid)
    const params = {
      tid: tid.toString(),
      did: did,
      namespace: this.namespace,
    }
    let res: AxiosResponse
    try {
      res = await axios.get(`${hostUrl}/data/post`, { params })
      return check.assure(schema.post, res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      if (err.response?.status === 404) {
        return null
      }
      throw new Error(err.message)
    }
  }

  async listPosts(count: number, from?: TID): Promise<Post[]> {
    return this.listPostsFromUser(this.ownDid(), count, from)
  }

  async listPostsFromUser(
    nameOrDid: string,
    count: number,
    from?: TID,
  ): Promise<Post[]> {
    const { hostUrl, did } = await this.resolveUser(nameOrDid)
    const params = {
      did,
      namespace: this.namespace,
      count,
      from: from?.toString(),
    }
    try {
      const res = await axios.get(`${hostUrl}/data/post/list`, {
        params,
      })
      return check.assure(z.array(schema.post), res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async listFollows(): Promise<Follow[]> {
    return this.listFollowsFromUser(this.ownDid())
  }

  async listFollowsFromUser(nameOrDid: string): Promise<Follow[]> {
    const { hostUrl, did } = await this.resolveUser(nameOrDid)
    const params = { user: did }
    try {
      const res = await axios.get(`${hostUrl}/data/relationship/list`, {
        params,
      })
      return check.assure(z.array(repoSchema.follow), res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async listFollowers(): Promise<Follow[]> {
    return this.listFollowersForUser(this.ownDid())
  }

  async listFollowersForUser(nameOrDid: string): Promise<Follow[]> {
    const { hostUrl, did } = await this.resolveUser(nameOrDid)
    const params = { user: did }
    try {
      const res = await axios.get(`${hostUrl}/indexer/followers`, {
        params,
      })
      return check.assure(z.array(repoSchema.follow), res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }

  async getLikeByPost(
    authorNameOrDid: string,
    postTid: TID,
  ): Promise<Like | null> {
    return this.getLikeByPostForUser(this.ownDid(), authorNameOrDid, postTid)
  }

  async getLikeByPostForUser(
    userNameOrDid: string,
    authorNameOrDid: string,
    postTid: TID,
  ): Promise<Like | null> {
    const user = await this.resolveUser(userNameOrDid)
    const author = await this.resolveUser(authorNameOrDid)
    const params = {
      did: user.did,
      postAuthor: author.did,
      postNamespace: this.namespace,
      postTid: postTid.toString(),
    }
    try {
      const res = await axios.get(`${user.hostUrl}/data/interaction`, {
        params,
      })
      return check.assure(schema.like, res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      if (err.response?.status === 404) {
        return null
      }
      throw new Error(err.message)
    }
  }

  async listLikesFromUser(
    nameOrDid: string,
    count: number,
    from?: TID,
  ): Promise<Like[]> {
    const { hostUrl, did } = await this.resolveUser(nameOrDid)
    const params = {
      did,
      namespace: this.namespace,
      count,
      from: from?.toString(),
    }
    try {
      const res = await axios.get(`${hostUrl}/data/interaction/list`, {
        params,
      })
      return check.assure(z.array(schema.like), res.data)
    } catch (e) {
      const err = assureAxiosError(e)
      throw new Error(err.message)
    }
  }
}

export default MicroblogReader
