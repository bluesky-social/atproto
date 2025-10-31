import fs from 'node:fs/promises'
import path from 'node:path'
import { CID } from 'multiformats/cid'
import {
  AppBskyActorProfile,
  AppBskyFeedLike,
  AppBskyFeedPost,
  AppBskyFeedRepost,
  AppBskyGraphBlock,
  AppBskyGraphFollow,
  AppBskyGraphList,
  AppBskyGraphVerification,
  AppBskyRichtextFacet,
  AtpAgent,
  ComAtprotoModerationCreateReport,
} from '@atproto/api'
import { BlobRef } from '@atproto/lexicon'
import { AtUri } from '@atproto/syntax'
import { TestNetworkNoAppView } from '../network-no-appview'

// Makes it simple to create data via the XRPC client,
// and keeps track of all created data in memory for convenience.

let AVATAR_IMG: Uint8Array | undefined

// AVATAR_PATH is defined in a non-CWD-dependant way, so this works
// for any consumer of this package, even outside the atproto repo.
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

export class SeedClient<
  Network extends TestNetworkNoAppView = TestNetworkNoAppView,
> {
  accounts: Record<
    string,
    {
      did: string
      accessJwt: string
      refreshJwt: string
      handle: string
      email: string
      password: string
    }
  >
  profiles: Record<
    string,
    {
      displayName: string
      description: string
      avatar: { cid: string; mimeType: string }
      joinedViaStarterPack: RecordRef | undefined
      ref: RecordRef
    }
  >
  follows: Record<string, Record<string, RecordRef>>
  blocks: Record<string, Record<string, RecordRef>>
  mutes: Record<string, Set<string>>
  posts: Record<
    string,
    { text: string; ref: RecordRef; images: ImageRef[]; quote?: RecordRef }[]
  >
  likes: Record<string, Record<string, AtUri>>
  replies: Record<
    string,
    { text: string; ref: RecordRef; images: ImageRef[] }[]
  >
  reposts: Record<string, RecordRef[]>
  lists: Record<
    string,
    Record<string, { ref: RecordRef; items: Record<string, RecordRef> }>
  >
  feedgens: Record<
    string,
    Record<string, { ref: RecordRef; items: Record<string, RecordRef> }>
  >
  starterpacks: Record<
    string,
    Record<
      string,
      {
        ref: RecordRef
        name: string
        list: RecordRef
        feeds: string[]
      }
    >
  >

  verifications: Record<string, Record<string, AtUri>>

  dids: Record<string, string>

  constructor(
    public network: Network,
    public agent: AtpAgent,
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
      handle: string
      email: string
      password: string
      inviteCode?: string
    },
  ) {
    const { data: account } =
      await this.agent.com.atproto.server.createAccount(params)
    this.dids[shortName] = account.did
    this.accounts[account.did] = {
      ...account,
      email: params.email,
      password: params.password,
    }
    return this.accounts[account.did]
  }

  async updateHandle(by: string, handle: string) {
    await this.agent.com.atproto.identity.updateHandle(
      { handle },
      { encoding: 'application/json', headers: this.getHeaders(by) },
    )
  }

  async createProfile(
    by: string,
    displayName: string,
    description: string,
    selfLabels?: string[],
    joinedViaStarterPack?: RecordRef,
    overrides?: Partial<AppBskyActorProfile.Record>,
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
      const res = await this.agent.com.atproto.repo.uploadBlob(AVATAR_IMG, {
        encoding: 'image/jpeg',
        headers: this.getHeaders(by),
      } as any)
      avatarBlob = res.data.blob
    }

    {
      const res = await this.agent.app.bsky.actor.profile.create(
        { repo: by },
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
          createdAt: new Date().toISOString(),
          ...overrides,
        },
        this.getHeaders(by),
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

  async updateProfile(by: string, record: Record<string, unknown>) {
    const res = await this.agent.com.atproto.repo.putRecord(
      {
        repo: by,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record,
      },
      { headers: this.getHeaders(by), encoding: 'application/json' },
    )
    this.profiles[by] = {
      ...(this.profiles[by] ?? {}),
      ...record,
      ref: new RecordRef(res.data.uri, res.data.cid),
    }
    return this.profiles[by]
  }

  async follow(
    from: string,
    to: string,
    overrides?: Partial<AppBskyGraphFollow.Record>,
  ) {
    const res = await this.agent.app.bsky.graph.follow.create(
      { repo: from },
      {
        subject: to,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      this.getHeaders(from),
    )
    this.follows[from] ??= {}
    this.follows[from][to] = new RecordRef(res.uri, res.cid)
    return this.follows[from][to]
  }

  async unfollow(from: string, to: string) {
    const follow = this.follows[from][to]
    if (!follow) {
      throw new Error('follow does not exist')
    }
    await this.agent.app.bsky.graph.follow.delete(
      { repo: from, rkey: follow.uri.rkey },
      this.getHeaders(from),
    )
    delete this.follows[from][to]
  }

  async block(
    from: string,
    to: string,
    overrides?: Partial<AppBskyGraphBlock.Record>,
  ) {
    const res = await this.agent.app.bsky.graph.block.create(
      { repo: from },
      {
        subject: to,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      this.getHeaders(from),
    )
    this.blocks[from] ??= {}
    this.blocks[from][to] = new RecordRef(res.uri, res.cid)
    return this.blocks[from][to]
  }

  async unblock(from: string, to: string) {
    const block = this.blocks[from][to]
    if (!block) {
      throw new Error('block does not exist')
    }
    await this.agent.app.bsky.graph.block.delete(
      { repo: from, rkey: block.uri.rkey },
      this.getHeaders(from),
    )
    delete this.blocks[from][to]
  }

  async mute(from: string, to: string) {
    await this.agent.app.bsky.graph.muteActor(
      {
        actor: to,
      },
      { headers: this.getHeaders(from) },
    )
    this.mutes[from] ??= new Set()
    this.mutes[from].add(to)
    return this.mutes[from][to]
  }

  async post(
    by: string,
    text: string,
    facets?: AppBskyRichtextFacet.Main[],
    images?: ImageRef[],
    quote?: RecordRef,
    overrides?: Partial<AppBskyFeedPost.Record>,
  ) {
    const imageEmbed = images && {
      $type: 'app.bsky.embed.images',
      images,
    }
    const recordEmbed = quote && {
      record: { uri: quote.uriStr, cid: quote.cidStr },
    }
    const embed =
      imageEmbed && recordEmbed
        ? {
            $type: 'app.bsky.embed.recordWithMedia',
            record: recordEmbed,
            media: imageEmbed,
          }
        : recordEmbed
          ? { $type: 'app.bsky.embed.record', ...recordEmbed }
          : imageEmbed
    const res = await this.agent.app.bsky.feed.post.create(
      { repo: by },
      {
        text: text,
        facets,
        embed,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      this.getHeaders(by),
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

  async deletePost(by: string, uri: AtUri) {
    await this.agent.app.bsky.feed.post.delete(
      {
        repo: by,
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
    const res = await this.agent.com.atproto.repo.uploadBlob(file, {
      headers: this.getHeaders(by),
      encoding,
    } as any)
    return { image: res.data.blob, alt: filePath }
  }

  async like(
    by: string,
    subject: RecordRef,
    overrides?: Partial<AppBskyFeedLike.Record>,
  ) {
    const res = await this.agent.app.bsky.feed.like.create(
      { repo: by },
      {
        subject: subject.raw,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      this.getHeaders(by),
    )
    this.likes[by] ??= {}
    this.likes[by][subject.uriStr] = new AtUri(res.uri)
    return this.likes[by][subject.uriStr]
  }

  async reply(
    by: string,
    root: RecordRef,
    parent: RecordRef,
    text: string,
    facets?: AppBskyRichtextFacet.Main[],
    images?: ImageRef[],
    overrides?: Partial<AppBskyFeedPost.Record>,
  ) {
    const embed = images
      ? {
          $type: 'app.bsky.embed.images',
          images,
        }
      : undefined
    const res = await this.agent.app.bsky.feed.post.create(
      { repo: by },
      {
        text: text,
        reply: {
          root: root.raw,
          parent: parent.raw,
        },
        facets,
        embed,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      this.getHeaders(by),
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
    by: string,
    subject: RecordRef,
    overrides?: Partial<AppBskyFeedRepost.Record>,
  ) {
    const res = await this.agent.app.bsky.feed.repost.create(
      { repo: by },
      {
        subject: subject.raw,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      this.getHeaders(by),
    )
    this.reposts[by] ??= []
    const repost = new RecordRef(res.uri, res.cid)
    this.reposts[by].push(repost)
    return repost
  }

  async createList(
    by: string,
    name: string,
    purpose: 'mod' | 'curate' | 'reference',
    overrides?: Partial<AppBskyGraphList.Record>,
  ) {
    const res = await this.agent.app.bsky.graph.list.create(
      { repo: by },
      {
        name,
        purpose:
          purpose === 'mod'
            ? 'app.bsky.graph.defs#modlist'
            : purpose === 'curate'
              ? 'app.bsky.graph.defs#curatelist'
              : 'app.bsky.graph.defs#referencelist',
        createdAt: new Date().toISOString(),
        ...(overrides || {}),
      },
      this.getHeaders(by),
    )
    this.lists[by] ??= {}
    const ref = new RecordRef(res.uri, res.cid)
    this.lists[by][ref.uriStr] = {
      ref: ref,
      items: {},
    }
    return ref
  }

  async createFeedGen(by: string, feedDid: string, name: string) {
    const res = await this.agent.app.bsky.feed.generator.create(
      { repo: by },
      {
        did: feedDid,
        displayName: name,
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(by),
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
    by: string,
    name: string,
    actors: string[],
    feeds?: string[],
  ) {
    const list = await this.createList(by, 'n/a', 'reference')
    for (const did of actors) {
      await this.addToList(by, did, list)
    }
    const res = await this.agent.app.bsky.graph.starterpack.create(
      { repo: by },
      {
        name,
        list: list.uriStr,
        feeds: feeds?.map((uri) => ({ uri })),
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(by),
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

  async addToList(by: string, subject: string, list: RecordRef) {
    const res = await this.agent.app.bsky.graph.listitem.create(
      { repo: by },
      { subject, list: list.uriStr, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    const ref = new RecordRef(res.uri, res.cid)
    const found = (this.lists[by] ?? {})[list.uriStr]
    if (found) {
      found.items[subject] = ref
    }
    return ref
  }

  async rmFromList(by: string, subject: string, list: RecordRef) {
    const foundList = (this.lists[by] ?? {})[list.uriStr] ?? {}
    if (!foundList) return
    const foundItem = foundList.items[subject]
    if (!foundItem) return
    await this.agent.app.bsky.graph.listitem.delete(
      { repo: by, rkey: foundItem.uri.rkey },
      this.getHeaders(by),
    )
    delete foundList.items[subject]
  }

  async createReport(opts: {
    reasonType: ComAtprotoModerationCreateReport.InputSchema['reasonType']
    subject: ComAtprotoModerationCreateReport.InputSchema['subject']
    reason?: string
    reportedBy: string
  }) {
    const { reasonType, subject, reason, reportedBy } = opts
    const result = await this.agent.com.atproto.moderation.createReport(
      { reasonType, subject, reason },
      {
        encoding: 'application/json',
        headers: this.getHeaders(reportedBy),
      },
    )
    return result.data
  }

  async verify(
    by: string,
    subject: string,
    handle: string,
    displayName: string,
    overrides?: Partial<AppBskyGraphVerification.Record>,
  ) {
    const res = await this.agent.app.bsky.graph.verification.create(
      { repo: by },
      {
        subject,
        createdAt: new Date().toISOString(),
        handle,
        displayName,
        ...overrides,
      },
      this.getHeaders(by),
    )
    this.verifications[by] ??= {}
    this.verifications[by][subject] = new AtUri(res.uri)
    return this.verifications[by][subject]
  }

  async unverify(by: string, subject: string) {
    const verification = this.verifications[by]?.[subject]
    if (!verification) {
      throw new Error('verification does not exist')
    }

    await this.agent.app.bsky.graph.verification.delete(
      { repo: by, rkey: verification.rkey },
      this.getHeaders(by),
    )
    delete this.verifications[by][subject]
  }

  getHeaders(did: string) {
    return SeedClient.getHeaders(this.accounts[did].accessJwt)
  }

  static getHeaders(jwt: string) {
    return { authorization: `Bearer ${jwt}` }
  }
}
