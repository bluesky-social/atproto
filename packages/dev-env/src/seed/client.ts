import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CID } from 'multiformats/cid'
import type { AtpAgent } from '@atproto/api'
import {
  type BlobRef,
  type CidString,
  type Client,
  type EncodingString,
  type LexMap,
  currentDatetimeString,
} from '@atproto/lex'
import {
  AtUri,
  type AtUriString,
  type DidString,
  type HandleString,
} from '@atproto/syntax'
import { app, com } from '../lexicons/index.js'
import type { TestNetworkNoAppView } from '../network-no-appview.js'

type CreateReportInput = com.atproto.moderation.createReport.$InputBody

/**
 * `createReport` takes an open union that only closes over `repoRef` and
 * `strongRef`. Anything else — chat convo & message refs, or a subject a test
 * builds by hand — lands in the `Unknown$Type` branch, which needs a cast. Keep
 * that cast here rather than at every call site.
 */
type ReportSubject =
  | CreateReportInput['subject']
  | { $type: string; [k: string]: unknown }
  | { $type: string }

// Makes it simple to create data via the XRPC client,
// and keeps track of all created data in memory for convenience.

let AVATAR_IMG: Uint8Array | undefined

// AVATAR_PATH is defined in a non-CWD-dependant way, so this works
// for any consumer of this package, even outside the atproto repo.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AVATAR_PATH = path.resolve(
  __dirname,
  '../../assets/key-portrait-small.jpg',
)

export type ImageRef = {
  image: BlobRef
  alt: string
}

export class RecordRef {
  uri: AtUri
  cid: CID

  constructor(uri: AtUri | string, cid: CID | string) {
    this.uri = new AtUri(uri.toString())
    this.cid = CID.parse(cid.toString())
  }

  get raw(): { uri: AtUriString; cid: CidString } {
    return {
      uri: this.uri.toString(),
      cid: this.cid.toString(),
    }
  }

  get uriStr(): AtUriString {
    return this.uri.toString()
  }

  get cidStr(): CidString {
    return this.cid.toString()
  }
}

export type Account = {
  did: DidString
  accessJwt: string
  refreshJwt: string
  handle: HandleString
  email: string
  password: string
}

export class SeedClient<
  Network extends TestNetworkNoAppView = TestNetworkNoAppView,
> {
  accounts: Record<DidString, Account>
  profiles: Record<
    DidString,
    {
      displayName: string
      description: string
      avatar: { cid: string; mimeType: string }
      joinedViaStarterPack: RecordRef | undefined
      ref: RecordRef
    }
  >
  follows: Record<DidString, Record<DidString, RecordRef>>
  blocks: Record<DidString, Record<DidString, RecordRef>>
  mutes: Record<DidString, Set<DidString>>
  posts: Record<
    DidString,
    { text: string; ref: RecordRef; images: ImageRef[]; quote?: RecordRef }[]
  >
  likes: Record<DidString, Record<string, AtUri>>
  replies: Record<
    string,
    { text: string; ref: RecordRef; images: ImageRef[] }[]
  >
  reposts: Record<DidString, RecordRef[]>
  lists: Record<
    DidString,
    Record<
      AtUriString,
      {
        ref: RecordRef
        items: Record<DidString, RecordRef>
      }
    >
  >
  feedgens: Record<
    DidString,
    Record<
      AtUriString,
      {
        ref: RecordRef
        items: Record<string, RecordRef>
      }
    >
  >
  starterpacks: Record<
    DidString,
    Record<
      AtUriString,
      {
        ref: RecordRef
        name: string
        list: RecordRef
        feeds: readonly AtUriString[]
      }
    >
  >

  verifications: Record<DidString, Record<DidString, AtUri>>

  dids: Record<string, DidString>

  constructor(
    public network: Network,
    public agent: AtpAgent,
    public client: Client,
  ) {
    this.accounts = {}
    this.profiles = {}
    this.follows = {}
    this.blocks = {}
    this.mutes = {}
    this.posts = {}
    this.likes = {}
    this.replies = {}
    this.reposts = {}
    this.lists = {}
    this.feedgens = {}
    this.starterpacks = {}
    this.verifications = {}
    this.dids = {}
  }

  async createAccount(
    shortName: string,
    params: {
      handle: HandleString
      email: string
      password: string
      inviteCode?: string
    },
  ): Promise<Account> {
    const account = await this.client.call(
      com.atproto.server.createAccount,
      params,
    )
    const { did } = account
    this.dids[shortName] = did
    this.accounts[did] = {
      ...account,
      did,
      email: params.email,
      password: params.password,
    }
    return this.accounts[did]
  }

  async updateHandle(by: DidString, handle: HandleString) {
    await this.client.call(
      com.atproto.identity.updateHandle,
      { handle },
      { headers: this.getHeaders(by) },
    )
  }

  async createProfile(
    by: DidString,
    displayName: string,
    description: string,
    selfLabels?: readonly string[],
    joinedViaStarterPack?: RecordRef,
    overrides?: Partial<app.bsky.actor.profile.Main>,
  ): Promise<{
    displayName: string
    description: string
    avatar: { cid: string; mimeType: string }
    ref: RecordRef
    joinedViaStarterPack?: RecordRef
  }> {
    AVATAR_IMG ??= await fs.readFile(AVATAR_PATH)

    let avatarBlob
    {
      const res = await this.client.uploadBlob(AVATAR_IMG, {
        encoding: 'image/jpeg',
        headers: this.getHeaders(by),
      })
      avatarBlob = res.body.blob
    }

    {
      const res = await this.client.create(
        app.bsky.actor.profile,
        {
          displayName,
          description,
          avatar: avatarBlob,
          labels: selfLabels
            ? {
                $type: 'com.atproto.label.defs#selfLabels',
                values: selfLabels.map((val) => ({ val })),
              }
            : undefined,
          joinedViaStarterPack: joinedViaStarterPack?.raw,
          createdAt: currentDatetimeString(),
          ...overrides,
        },
        { repo: by, headers: this.getHeaders(by) },
      )
      this.profiles[by] = {
        displayName,
        description,
        avatar: avatarBlob,
        joinedViaStarterPack,
        ref: new RecordRef(res.uri, res.cid),
      }
    }
    return this.profiles[by]
  }

  async updateProfile(by: DidString, record: Record<string, unknown>) {
    const res = await this.client.call(
      com.atproto.repo.putRecord,
      {
        repo: by,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        // Callers pass partial/hand-built profiles, so this stays untyped and
        // is checked by the PDS rather than here.
        record: record as LexMap,
      },
      { headers: this.getHeaders(by) },
    )
    this.profiles[by] = {
      ...(this.profiles[by] ?? {}),
      ...record,
      ref: new RecordRef(res.uri, res.cid),
    }
    return this.profiles[by]
  }

  async follow(
    from: DidString,
    to: DidString,
    overrides?: Partial<app.bsky.graph.follow.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.graph.follow,
      {
        subject: to,
        createdAt: currentDatetimeString(),
        ...overrides,
      },
      { repo: from, headers: this.getHeaders(from) },
    )
    this.follows[from] ??= {}
    this.follows[from][to] = new RecordRef(res.uri, res.cid)
    return this.follows[from][to]
  }

  async unfollow(from: DidString, to: DidString) {
    const follow = this.follows[from][to]
    if (!follow) {
      throw new Error('follow does not exist')
    }
    await this.client.delete(app.bsky.graph.follow, {
      repo: from,
      rkey: follow.uri.rkey,
      headers: this.getHeaders(from),
    })
    delete this.follows[from][to]
  }

  async block(
    from: DidString,
    to: DidString,
    overrides?: Partial<app.bsky.graph.block.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.graph.block,
      {
        subject: to,
        createdAt: currentDatetimeString(),
        ...overrides,
      },
      { repo: from, headers: this.getHeaders(from) },
    )
    this.blocks[from] ??= {}
    this.blocks[from][to] = new RecordRef(res.uri, res.cid)
    return this.blocks[from][to]
  }

  async unblock(from: DidString, to: DidString) {
    const block = this.blocks[from][to]
    if (!block) {
      throw new Error('block does not exist')
    }
    await this.client.delete(app.bsky.graph.block, {
      repo: from,
      rkey: block.uri.rkey,
      headers: this.getHeaders(from),
    })
    delete this.blocks[from][to]
  }

  async mute(from: DidString, to: DidString) {
    await this.client.call(
      app.bsky.graph.muteActor,
      { actor: to },
      { headers: this.getHeaders(from) },
    )
    this.mutes[from] ??= new Set()
    this.mutes[from].add(to)
    return this.mutes[from][to]
  }

  async post(
    by: DidString,
    text: string,
    facets?: app.bsky.richtext.facet.Main[],
    images?: ImageRef[],
    quote?: RecordRef,
    overrides?: Partial<app.bsky.feed.post.Main>,
  ) {
    const imageEmbed = images && {
      $type: 'app.bsky.embed.images' as const,
      images,
    }
    const recordEmbed = quote && {
      record: { uri: quote.uriStr, cid: quote.cidStr },
    }
    const embed =
      imageEmbed && recordEmbed
        ? {
            $type: 'app.bsky.embed.recordWithMedia' as const,
            record: recordEmbed,
            media: imageEmbed,
          }
        : recordEmbed
          ? { $type: 'app.bsky.embed.record' as const, ...recordEmbed }
          : imageEmbed
    const res = await this.client.create(
      app.bsky.feed.post,
      {
        text: text,
        facets,
        embed,
        createdAt: currentDatetimeString(),
        ...overrides,
      },
      { repo: by, headers: this.getHeaders(by) },
    )
    this.posts[by] ??= []
    const post = {
      text,
      ref: new RecordRef(res.uri, res.cid),
      images: images ?? [],
      quote,
    }
    this.posts[by].push(post)
    return post
  }

  async deletePost(by: DidString, uri: AtUri) {
    await this.client.delete(app.bsky.feed.post, {
      repo: by,
      rkey: uri.rkey,
      headers: this.getHeaders(by),
    })
  }

  async uploadFile(
    by: DidString,
    filePath: string,
    encoding: EncodingString,
  ): Promise<ImageRef> {
    const file = await fs.readFile(filePath)
    const res = await this.client.uploadBlob(file, {
      headers: this.getHeaders(by),
      encoding,
    })
    return { image: res.body.blob, alt: filePath }
  }

  async like(
    by: DidString,
    subject: RecordRef,
    overrides?: Partial<app.bsky.feed.like.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.feed.like,
      {
        subject: subject.raw,
        createdAt: currentDatetimeString(),
        ...overrides,
      },
      { repo: by, headers: this.getHeaders(by) },
    )
    this.likes[by] ??= {}
    this.likes[by][subject.uriStr] = new AtUri(res.uri)
    return this.likes[by][subject.uriStr]
  }

  async reply(
    by: DidString,
    root: RecordRef,
    parent: RecordRef,
    text: string,
    facets?: app.bsky.richtext.facet.Main[],
    images?: ImageRef[],
    overrides?: Partial<app.bsky.feed.post.Main>,
  ) {
    const embed = images
      ? {
          $type: 'app.bsky.embed.images' as const,
          images,
        }
      : undefined
    const res = await this.client.create(
      app.bsky.feed.post,
      {
        text: text,
        reply: {
          root: root.raw,
          parent: parent.raw,
        },
        facets,
        embed,
        createdAt: currentDatetimeString(),
        ...overrides,
      },
      { repo: by, headers: this.getHeaders(by) },
    )
    this.replies[by] ??= []
    const reply = {
      text,
      ref: new RecordRef(res.uri, res.cid),
      images: images ?? [],
    }
    this.replies[by].push(reply)
    return reply
  }

  async repost(
    by: DidString,
    subject: RecordRef,
    overrides?: Partial<app.bsky.feed.repost.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.feed.repost,
      {
        subject: subject.raw,
        createdAt: currentDatetimeString(),
        ...overrides,
      },
      { repo: by, headers: this.getHeaders(by) },
    )
    this.reposts[by] ??= []
    const repost = new RecordRef(res.uri, res.cid)
    this.reposts[by].push(repost)
    return repost
  }

  async createList(
    by: DidString,
    name: string,
    purpose: 'mod' | 'curate' | 'reference',
    overrides?: Partial<app.bsky.graph.list.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.graph.list,
      {
        name,
        purpose:
          purpose === 'mod'
            ? 'app.bsky.graph.defs#modlist'
            : purpose === 'curate'
              ? 'app.bsky.graph.defs#curatelist'
              : 'app.bsky.graph.defs#referencelist',
        createdAt: currentDatetimeString(),
        ...(overrides || {}),
      },
      { repo: by, headers: this.getHeaders(by) },
    )
    this.lists[by] ??= {}
    const ref = new RecordRef(res.uri, res.cid)
    this.lists[by][ref.uriStr] = {
      ref: ref,
      items: {},
    }
    return ref
  }

  async createFeedGen(by: DidString, feedDid: DidString, name: string) {
    const res = await this.client.create(
      app.bsky.feed.generator,
      {
        did: feedDid,
        displayName: name,
        createdAt: currentDatetimeString(),
      },
      { repo: by, headers: this.getHeaders(by) },
    )
    this.feedgens[by] ??= {}
    const ref = new RecordRef(res.uri, res.cid)
    this.feedgens[by][ref.uriStr] = {
      ref: ref,
      items: {},
    }
    return ref
  }

  async createStarterPack(
    by: DidString,
    name: string,
    actors: readonly DidString[],
    feeds?: readonly AtUriString[],
  ) {
    const list = await this.createList(by, 'n/a', 'reference')
    for (const did of actors) {
      await this.addToList(by, did, list)
    }
    const res = await this.client.create(
      app.bsky.graph.starterpack,
      {
        name,
        list: list.uriStr,
        feeds: feeds?.map((uri) => ({ uri })),
        createdAt: currentDatetimeString(),
      },
      { repo: by, headers: this.getHeaders(by) },
    )
    this.starterpacks[by] ??= {}
    const ref = new RecordRef(res.uri, res.cid)
    this.starterpacks[by][ref.uriStr] = {
      ref: ref,
      list,
      feeds: feeds ?? [],
      name,
    }
    return ref
  }

  async addToList(by: DidString, subject: DidString, list: RecordRef) {
    const res = await this.client.create(
      app.bsky.graph.listitem,
      { subject, list: list.uriStr, createdAt: currentDatetimeString() },
      { repo: by, headers: this.getHeaders(by) },
    )
    const ref = new RecordRef(res.uri, res.cid)
    const found = (this.lists[by] ?? {})[list.uriStr]
    if (found) {
      found.items[subject] = ref
    }
    return ref
  }

  async rmFromList(by: DidString, subject: DidString, list: RecordRef) {
    const foundList = (this.lists[by] ?? {})[list.uriStr] ?? {}
    if (!foundList) return
    const foundItem = foundList.items[subject]
    if (!foundItem) return
    await this.client.delete(app.bsky.graph.listitem, {
      repo: by,
      rkey: foundItem.uri.rkey,
      headers: this.getHeaders(by),
    })
    delete foundList.items[subject]
  }

  // override public signature to add support for convos and messages
  async createReport(opts: {
    reasonType: CreateReportInput['reasonType']
    subject: ReportSubject
    reason?: string
    reportedBy: DidString
  }): Promise<
    com.atproto.moderation.createReport.$OutputBody & {
      subject: ReportSubject
    }
  > {
    const { reasonType, subject, reason, reportedBy } = opts
    return this.client.call(
      com.atproto.moderation.createReport,
      {
        reasonType,
        subject: subject as CreateReportInput['subject'],
        reason,
      },
      { headers: this.getHeaders(reportedBy) },
    )
  }

  async verify(
    by: DidString,
    subject: DidString,
    handle: HandleString,
    displayName: string,
    overrides?: Partial<app.bsky.graph.verification.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.graph.verification,
      {
        subject,
        createdAt: currentDatetimeString(),
        handle,
        displayName,
        ...overrides,
      },
      { repo: by, headers: this.getHeaders(by) },
    )
    this.verifications[by] ??= {}
    this.verifications[by][subject] = new AtUri(res.uri)
    return this.verifications[by][subject]
  }

  async unverify(by: DidString, subject: DidString) {
    const verification = this.verifications[by]?.[subject]
    if (!verification) {
      throw new Error('verification does not exist')
    }

    await this.client.delete(app.bsky.graph.verification, {
      repo: by,
      rkey: verification.rkey,
      headers: this.getHeaders(by),
    })
    delete this.verifications[by][subject]
  }

  getHeaders(did: DidString) {
    return SeedClient.getHeaders(this.accounts[did].accessJwt)
  }

  static getHeaders(jwt: string) {
    return { authorization: `Bearer ${jwt}` }
  }
}
