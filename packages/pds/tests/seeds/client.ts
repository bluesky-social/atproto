import { APP_BSKY_GRAPH, ServiceClient } from '@atproto/api'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'

// Makes it simple to create data via the XRPC client,
// and keeps track of all created data in memory for convenience.

export class RecordRef {
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

export class ActorRef {
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
      ref: ActorRef
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
  votes: {
    up: Record<string, Record<string, AtUri>>
    down: Record<string, Record<string, AtUri>>
  }
  replies: Record<string, { text: string; ref: RecordRef }[]>
  reposts: Record<string, RecordRef[]>
  trends: Record<string, RecordRef[]>
  scenes: Record<
    string,
    { did: string; handle: string; creator: string; ref: ActorRef }
  >
  sceneInvites: Record<string, Record<string, RecordRef>>
  sceneAccepts: Record<string, Record<string, RecordRef>>
  dids: Record<string, string>

  constructor(public client: ServiceClient) {
    this.accounts = {}
    this.profiles = {}
    this.follows = {}
    this.posts = {}
    this.votes = { up: {}, down: {} }
    this.replies = {}
    this.reposts = {}
    this.trends = {}
    this.scenes = {}
    this.sceneInvites = {}
    this.sceneAccepts = {}
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
    const { data: account } = await this.client.com.atproto.account.create(
      params,
    )
    const { data: profile } = await this.client.app.bsky.actor.getProfile(
      {
        actor: params.handle,
      },
      { headers: SeedClient.getHeaders(account.accessJwt) },
    )
    this.dids[shortName] = account.did
    this.accounts[account.did] = {
      ...account,
      email: params.email,
      password: params.password,
      ref: new ActorRef(account.did, profile.declaration.cid),
    }
    return this.accounts[shortName]
  }

  async createProfile(
    by: string,
    displayName: string,
    description: string,
    fromUser?: string,
  ) {
    const res = await this.client.app.bsky.actor.profile.create(
      { did: by },
      { displayName, description },
      this.getHeaders(fromUser || by),
    )
    this.profiles[by] = {
      displayName,
      description,
      ref: new RecordRef(res.uri, res.cid),
    }
    return this.profiles[by]
  }

  async follow(from: string, to: ActorRef) {
    const res = await this.client.app.bsky.graph.follow.create(
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
    const res = await this.client.app.bsky.feed.post.create(
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

  async deletePost(by: string, uri: AtUri) {
    await this.client.app.bsky.feed.post.delete(
      {
        did: by,
        rkey: uri.rkey,
      },
      this.getHeaders(by),
    )
  }

  async vote(direction: 'up' | 'down', by: string, subject: RecordRef) {
    const res = await this.client.app.bsky.feed.vote.create(
      { did: by },
      { direction, subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.votes[direction][by] ??= {}
    this.votes[direction][by][subject.uriStr] = new AtUri(res.uri)
    return this.votes[direction][by][subject.uriStr]
  }

  async reply(by: string, root: RecordRef, parent: RecordRef, text: string) {
    const res = await this.client.app.bsky.feed.post.create(
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
    const res = await this.client.app.bsky.feed.repost.create(
      { did: by },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.reposts[by] ??= []
    const repost = new RecordRef(res.uri, res.cid)
    this.reposts[by].push(repost)
    return repost
  }

  async trend(by: string, scene: string, subject: RecordRef) {
    const res = await this.client.app.bsky.feed.trend.create(
      { did: scene },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.trends[by] ??= []
    const trend = new RecordRef(res.uri, res.cid)
    this.trends[by].push(trend)
    return trend
  }

  async createScene(creator: string, handle: string) {
    const res = await this.client.app.bsky.actor.createScene(
      {
        handle,
      },
      {
        headers: this.getHeaders(creator),
        encoding: 'application/json',
      },
    )
    const scene = {
      did: res.data.did,
      handle: res.data.handle,
      creator,
      ref: new ActorRef(res.data.did, res.data.declaration.cid),
    }
    this.dids[handle] = res.data.did
    this.scenes[res.data.handle] = scene
    return scene
  }

  async inviteToScene(handle: string, user: ActorRef) {
    const scene = this.scenes[handle]
    if (!scene) {
      throw new Error(`Scene does not exist: ${handle}`)
    }
    const res = await this.client.app.bsky.graph.assertion.create(
      { did: scene.did },
      {
        assertion: APP_BSKY_GRAPH.AssertMember,
        subject: user.raw,
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(scene.creator),
    )
    const invite = new RecordRef(res.uri, res.cid)
    this.sceneInvites[handle] ??= {}
    this.sceneInvites[handle][user.did] = invite
    return invite
  }

  async acceptSceneInvite(
    user: string,
    sceneHandle: string,
    invite: RecordRef,
  ) {
    const scene = this.scenes[sceneHandle]
    if (!scene) {
      throw new Error(`Scene does not exist: ${sceneHandle}`)
    }
    const res = await this.client.app.bsky.graph.confirmation.create(
      { did: user },
      {
        originator: scene.ref.raw,
        assertion: invite.raw,
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(user),
    )
    const accept = new RecordRef(res.uri, res.cid)
    this.sceneAccepts[sceneHandle] ??= {}
    this.sceneAccepts[sceneHandle][user] = accept
    return accept
  }

  actorRef(did: string): ActorRef {
    return this.accounts[did].ref
  }

  getHeaders(did: string) {
    return SeedClient.getHeaders(this.accounts[did].accessJwt)
  }

  static getHeaders(jwt: string) {
    return { authorization: `Bearer ${jwt}` }
  }
}
