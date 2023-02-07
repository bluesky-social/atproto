import fs from 'fs/promises'
import AtpAgent from '@atproto/api'
import { InputSchema as TakeActionInput } from '@atproto/api/src/client/types/com/atproto/admin/takeModerationAction'
import { InputSchema as CreateReportInput } from '@atproto/api/src/client/types/com/atproto/report/create'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import { adminAuth } from '../_util'

// Makes it simple to create data via the XRPC client,
// and keeps track of all created data in memory for convenience.

let AVATAR_IMG: Uint8Array | undefined

export type ImageRef = {
  image: { cid: string; mimeType: string }
  alt: string
}

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
      avatar: { cid: string; mimeType: string }
      ref: RecordRef
    }
  >
  follows: Record<string, Record<string, RecordRef>>
  posts: Record<string, { text: string; ref: RecordRef; images: ImageRef[] }[]>
  votes: {
    up: Record<string, Record<string, AtUri>>
    down: Record<string, Record<string, AtUri>>
  }
  replies: Record<string, { text: string; ref: RecordRef }[]>
  reposts: Record<string, RecordRef[]>
  dids: Record<string, string>

  constructor(public agent: AtpAgent) {
    this.accounts = {}
    this.profiles = {}
    this.follows = {}
    this.posts = {}
    this.votes = { up: {}, down: {} }
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
    const { data: account } = await this.agent.api.com.atproto.account.create(
      params,
    )
    const { data: profile } = await this.agent.api.app.bsky.actor.getProfile(
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
    return this.accounts[account.did]
  }

  async createProfile(
    by: string,
    displayName: string,
    description: string,
    fromUser?: string,
  ) {
    AVATAR_IMG ??= await fs.readFile(
      'tests/image/fixtures/key-portrait-small.jpg',
    )

    let avatarCid
    {
      const res = await this.agent.api.com.atproto.blob.upload(AVATAR_IMG, {
        encoding: 'image/jpeg',
        headers: this.getHeaders(fromUser || by),
      } as any)
      avatarCid = res.data.cid
    }

    {
      const res = await this.agent.api.app.bsky.actor.profile.create(
        { did: by },
        {
          displayName,
          description,
          avatar: { cid: avatarCid, mimeType: 'image/jpeg' },
        },
        this.getHeaders(fromUser || by),
      )
      this.profiles[by] = {
        displayName,
        description,
        avatar: { cid: avatarCid, mimeType: 'image/jpeg' },
        ref: new RecordRef(res.uri, res.cid),
      }
    }
    return this.profiles[by]
  }

  async follow(from: string, to: ActorRef) {
    const res = await this.agent.api.app.bsky.graph.follow.create(
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

  async post(by: string, text: string, entities?: any, images?: ImageRef[]) {
    const embed = images
      ? {
          $type: 'app.bsky.embed.images',
          images,
        }
      : undefined
    const res = await this.agent.api.app.bsky.feed.post.create(
      { did: by },
      {
        text: text,
        entities,
        embed,
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(by),
    )
    this.posts[by] ??= []
    const post = {
      text,
      ref: new RecordRef(res.uri, res.cid),
      images: images || [],
    }
    this.posts[by].push(post)
    return post
  }

  async deletePost(by: string, uri: AtUri) {
    await this.agent.api.app.bsky.feed.post.delete(
      {
        did: by,
        rkey: uri.rkey,
      },
      this.getHeaders(by),
    )
  }

  async uploadFile(
    by: string,
    filePath: string,
    encoding: string,
  ): Promise<ImageRef> {
    const file = await fs.readFile(filePath)
    const res = await this.agent.api.com.atproto.blob.upload(file, {
      headers: this.getHeaders(by),
      encoding,
    } as any)
    return { image: { cid: res.data.cid, mimeType: encoding }, alt: filePath }
  }

  async vote(direction: 'up' | 'down', by: string, subject: RecordRef) {
    const res = await this.agent.api.app.bsky.feed.vote.create(
      { did: by },
      { direction, subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.votes[direction][by] ??= {}
    this.votes[direction][by][subject.uriStr] = new AtUri(res.uri)
    return this.votes[direction][by][subject.uriStr]
  }

  async reply(
    by: string,
    root: RecordRef,
    parent: RecordRef,
    text: string,
    entities?: any,
    images?: ImageRef[],
  ) {
    const embed = images
      ? {
          $type: 'app.bsky.embed.images',
          images,
        }
      : undefined
    const res = await this.agent.api.app.bsky.feed.post.create(
      { did: by },
      {
        text: text,
        reply: {
          root: root.raw,
          parent: parent.raw,
        },
        entities,
        embed,
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
    const res = await this.agent.api.app.bsky.feed.repost.create(
      { did: by },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.reposts[by] ??= []
    const repost = new RecordRef(res.uri, res.cid)
    this.reposts[by].push(repost)
    return repost
  }

  actorRef(did: string): ActorRef {
    return this.accounts[did].ref
  }

  async takeModerationAction(opts: {
    action: TakeActionInput['action']
    subject: TakeActionInput['subject']
    reason?: string
    createdBy?: string
  }) {
    const { action, subject, reason = 'X', createdBy = 'Y' } = opts
    const result = await this.agent.api.com.atproto.admin.takeModerationAction(
      { action, subject, createdBy, reason },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    return result.data
  }

  async reverseModerationAction(opts: {
    id: number
    reason?: string
    createdBy?: string
  }) {
    const { id, reason = 'X', createdBy = 'Y' } = opts
    const result =
      await this.agent.api.com.atproto.admin.reverseModerationAction(
        { id, reason, createdBy },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    return result.data
  }

  async resolveReports(opts: {
    actionId: number
    reportIds: number[]
    createdBy?: string
  }) {
    const { actionId, reportIds, createdBy = 'Y' } = opts
    const result =
      await this.agent.api.com.atproto.admin.resolveModerationReports(
        { actionId, createdBy, reportIds },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    return result.data
  }

  async createReport(opts: {
    reasonType: CreateReportInput['reasonType']
    subject: CreateReportInput['subject']
    reason?: string
    reportedByDid: string
  }) {
    const { reasonType, subject, reason, reportedByDid } = opts
    const result = await this.agent.api.com.atproto.report.create(
      { reasonType, subject, reason },
      {
        encoding: 'application/json',
        headers: this.getHeaders(reportedByDid),
      },
    )
    return result.data
  }

  getHeaders(did: string) {
    return SeedClient.getHeaders(this.accounts[did].accessJwt)
  }

  static getHeaders(jwt: string) {
    return { authorization: `Bearer ${jwt}` }
  }
}
