import { ServiceClient } from '@adxp/api'
import { AdxUri } from '@adxp/uri'
import { CID } from 'multiformats/cid'

// Makes it simple to create data via the XRPC client,
// and keeps track of all created data in memory for convenience.

class Reference {
  uri: AdxUri
  cid: CID

  constructor(uri: AdxUri | string, cid: CID | string) {
    this.uri = new AdxUri(uri.toString())
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

export class SeedClient {
  accounts: Record<
    string,
    {
      did: string
      jwt: string
      username: string
      email: string
      password: string
    }
  >
  profiles: Record<
    string,
    {
      displayName: string
      description: string
      ref: Reference
    }
  >
  follows: Record<string, Record<string, Reference>>
  posts: Record<string, { text: string; ref: Reference }[]>
  likes: Record<string, Record<string, AdxUri>>
  replies: Record<string, { text: string; ref: Reference }[]>
  reposts: Record<string, Reference[]>
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
      username: string
      email: string
      password: string
    },
  ) {
    const { data } = await this.client.com.atproto.createAccount({}, params)
    this.dids[shortName] = data.did
    this.accounts[data.did] = {
      ...data,
      email: params.email,
      password: params.password,
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
      ref: new Reference(res.uri, res.cid),
    }
    return this.profiles[by]
  }

  async follow(from: string, to: string) {
    const res = await this.client.app.bsky.follow.create(
      { did: from },
      { subject: to, createdAt: new Date().toISOString() },
      this.getHeaders(from),
    )
    this.follows[from] ??= {}
    this.follows[from][to] = new Reference(res.uri, res.cid)
    return this.follows[from][to]
  }

  async post(by: string, text: string, entities?: any) {
    const res = await this.client.app.bsky.post.create(
      { did: by },
      { text: text, entities, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.posts[by] ??= []
    this.posts[by].push({
      text,
      ref: new Reference(res.uri, res.cid),
    })
    return this.posts[by].at(-1)
  }

  async like(by: string, subject: Reference) {
    const res = await this.client.app.bsky.like.create(
      { did: by },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.likes[by] ??= {}
    this.likes[by][subject.uriStr] = new AdxUri(res.uri)
    return this.likes[by][subject.uriStr]
  }

  async reply(by: string, root: Reference, parent: Reference, text: string) {
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
    this.replies[by].push({
      text,
      ref: new Reference(res.uri, res.cid),
    })
    return this.replies[by].at(-1)
  }

  async repost(by: string, subject: Reference) {
    const res = await this.client.app.bsky.repost.create(
      { did: by },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.reposts[by] ??= []
    this.reposts[by].push(new Reference(res.uri, res.cid))
    return this.reposts[by].at(-1)
  }

  getHeaders(did: string) {
    return { authorization: `Bearer ${this.accounts[did].jwt}` }
  }
}
