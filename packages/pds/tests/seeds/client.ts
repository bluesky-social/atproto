import { ServiceClient } from '@atproto/api'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'

// Makes it simple to create data via the XRPC client,
// and keeps track of all created data in memory for convenience.

class RecordRef {
  uri: AtUri
  cid: CID

  constructor(uri: AtUri | string, cid: CID | string) {
    this.uri = new AtUri(uri.toString())
    this.cid = CID.parse(cid.toString())
  }

  get raw(): { uri: string; cid: string } {
    return {
      uri: this.uri.toString(),
      cid: this.cid.toString(),
    }
  }

  get uriStr(): string {
    return this.uri.toString()
  }

  get cidStr(): string {
    return this.cid.toString()
  }
}

class UserRef {
  did: string
  declarationCid: CID

  constructor(did: string, declarationCid: CID | string) {
    this.did = did
    this.declarationCid = CID.parse(declarationCid.toString())
  }

  get raw(): { did: string; declarationCid: string } {
    return {
      did: this.did.toString(),
      declarationCid: this.declarationCid.toString(),
    }
  }

  get declarationStr(): string {
    return this.declarationCid.toString()
  }
}

export class SeedClient {
  accounts: Record<
    string,
    {
      did: string
      accessJwt: string
      refreshJwt: string
      handle: string
      email: string
      password: string
      ref: UserRef
    }
  >
  profiles: Record<
    string,
    {
      displayName: string
      description: string
      ref: RecordRef
    }
  >
  follows: Record<string, Record<string, RecordRef>>
  posts: Record<string, { text: string; ref: RecordRef }[]>
  likes: Record<string, Record<string, AtUri>>
  replies: Record<string, { text: string; ref: RecordRef }[]>
  reposts: Record<string, RecordRef[]>
  dids: Record<string, string>

  constructor(public client: ServiceClient) {
    this.accounts = {}
    this.profiles = {}
    this.follows = {}
    this.posts = {}
    this.likes = {}
    this.replies = {}
    this.reposts = {}
    this.dids = {}
  }

  async createAccount(
    shortName: string,
    params: {
      handle: string
      email: string
      password: string
    },
  ) {
    const { data } = await this.client.com.atproto.createAccount(params)
    this.dids[shortName] = data.did
    this.accounts[data.did] = {
      ...data,
      email: params.email,
      password: params.password,
      ref: new UserRef(data.did, data.declarationCid),
    }
    return this.accounts[shortName]
  }

  async createProfile(by: string, displayName: string, description: string) {
    const res = await this.client.app.bsky.profile.create(
      { did: by },
      { displayName, description },
      this.getHeaders(by),
    )
    this.profiles[by] = {
      displayName,
      description,
      ref: new RecordRef(res.uri, res.cid),
    }
    return this.profiles[by]
  }

  async follow(from: string, to: UserRef) {
    const res = await this.client.app.bsky.follow.create(
      { did: from },
      {
        subject: to.raw,
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(from),
    )
    this.follows[from] ??= {}
    this.follows[from][to.did] = new RecordRef(res.uri, res.cid)
    return this.follows[from][to.did]
  }

  async post(by: string, text: string, entities?: any) {
    const res = await this.client.app.bsky.post.create(
      { did: by },
      { text: text, entities, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.posts[by] ??= []
    const post = {
      text,
      ref: new RecordRef(res.uri, res.cid),
    }
    this.posts[by].push(post)
    return post
  }

  async like(by: string, subject: RecordRef) {
    const res = await this.client.app.bsky.like.create(
      { did: by },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.likes[by] ??= {}
    this.likes[by][subject.uriStr] = new AtUri(res.uri)
    return this.likes[by][subject.uriStr]
  }

  async reply(by: string, root: RecordRef, parent: RecordRef, text: string) {
    const res = await this.client.app.bsky.post.create(
      { did: by },
      {
        text: text,
        reply: {
          root: root.raw,
          parent: parent.raw,
        },
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(by),
    )
    this.replies[by] ??= []
    const reply = {
      text,
      ref: new RecordRef(res.uri, res.cid),
    }
    this.replies[by].push(reply)
    return reply
  }

  async repost(by: string, subject: RecordRef) {
    const res = await this.client.app.bsky.repost.create(
      { did: by },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.reposts[by] ??= []
    const repost = new RecordRef(res.uri, res.cid)
    this.reposts[by].push(repost)
    return repost
  }

  userRef(did: string): UserRef {
    return this.accounts[did].ref
  }

  getHeaders(did: string) {
    return SeedClient.getHeaders(this.accounts[did].accessJwt)
  }

  static getHeaders(jwt: string) {
    return { authorization: `Bearer ${jwt}` }
  }
}
