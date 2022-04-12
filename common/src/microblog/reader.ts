import axios, { AxiosResponse } from 'axios'
import TID from '../repo/tid.js'

import { z } from 'zod'
import { Post, Like, schema, AccountInfo, Timeline } from './types.js'
import { schema as repoSchema } from '../repo/types.js'
import * as check from '../common/check.js'
import { assureAxiosError } from '../network/util.js'
import { Follow } from '../repo/types.js'
import * as service from '../network/service.js'

export class MicroblogReader {
  namespace = 'did:bsky:microblog'

  async getServerDid(url: string): Promise<string> {
    return await service.getServerDid(url)
  }

  async resolveDid(nameOrDid: string): Promise<string> {
    if (nameOrDid.startsWith('did:')) return nameOrDid
    const did = await this.lookupDid(nameOrDid)
    if (!did) {
      throw new Error(`Coult not find user: ${nameOrDid}`)
    }
    return did
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

  async lookupDid(username: string): Promise<string | null> {
    const { name, hostUrl } = this.normalizeUsername(username)
    return service.lookupDid(hostUrl, name)
  }

  async getAccountInfo(username: string): Promise<AccountInfo | null> {
    const { hostUrl } = this.normalizeUsername(username)
    const did = await this.resolveDid(username)
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
    username: string,
    count: number,
    from?: TID,
  ): Promise<Timeline | null> {
    const { hostUrl } = this.normalizeUsername(username)
    const did = await this.resolveDid(username)
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

  async getPostFromUser(username: string, tid: TID): Promise<Post | null> {
    const { hostUrl } = this.normalizeUsername(username)
    const did = await this.resolveDid(username)
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

  async listPostsFromUser(
    username: string,
    count: number,
    from?: TID,
  ): Promise<Post[]> {
    const { hostUrl } = this.normalizeUsername(username)
    const did = await this.resolveDid(username)
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

  async listFollowsFromUser(username: string): Promise<Follow[]> {
    const { hostUrl } = this.normalizeUsername(username)
    const did = await this.resolveDid(username)
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

  async listFollowersForUser(username: string): Promise<Follow[]> {
    const { hostUrl } = this.normalizeUsername(username)
    const did = await this.resolveDid(username)
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

  async listLikesFromUser(
    username: string,
    count: number,
    from?: TID,
  ): Promise<Like[]> {
    const { hostUrl } = this.normalizeUsername(username)
    const did = await this.resolveDid(username)
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
