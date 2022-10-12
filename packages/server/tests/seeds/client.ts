import { ServiceClient } from '@adxp/api'
import { AdxUri } from '@adxp/uri'

// Makes it simple to create data via the XRPC client,
// and keeps track of all created data in memory for convenience.

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
    { displayName: string; description: string; uriRaw: string; uri: AdxUri }
  >
  follows: Record<string, Record<string, AdxUri>>
  posts: Record<string, { text: string; uriRaw: string; uri: AdxUri }[]>
  likes: Record<string, Record<string, AdxUri>>
  replies: Record<string, { text: string; uriRaw: string; uri: AdxUri }[]>
  reposts: Record<string, AdxUri[]>
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
      uriRaw: res.uri,
      uri: new AdxUri(res.uri),
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
    this.follows[from][to] = new AdxUri(res.uri)
    return this.follows[from][to]
  }

  async post(by: string, text: string, entities?: any) {
    const res = await this.client.app.bsky.post.create(
      { did: by },
      { text: text, entities, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.posts[by] ??= []
    this.posts[by].push({ text, uriRaw: res.uri, uri: new AdxUri(res.uri) })
    return this.posts[by].at(-1)
  }

  async like(by: string, subject: string) {
    const res = await this.client.app.bsky.like.create(
      { did: by },
      { subject, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.likes[by] ??= {}
    this.likes[by][subject] = new AdxUri(res.uri)
    return this.likes[by][subject]
  }

  async reply(by: string, root: AdxUri, parent: AdxUri, text: string) {
    const res = await this.client.app.bsky.post.create(
      { did: by },
      {
        text: text,
        reply: {
          root: root.toString(),
          parent: parent.toString(),
        },
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(by),
    )
    this.replies[by] ??= []
    this.replies[by].push({ text, uriRaw: res.uri, uri: new AdxUri(res.uri) })
    return this.replies[by].at(-1)
  }

  async repost(by: string, subject: string) {
    const res = await this.client.app.bsky.repost.create(
      { did: by },
      { subject, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.reposts[by] ??= []
    this.reposts[by].push(new AdxUri(res.uri))
    return this.reposts[by].at(-1)
  }

  getHeaders(did: string) {
    return { authorization: `Bearer ${this.accounts[did].jwt}` }
  }
}
