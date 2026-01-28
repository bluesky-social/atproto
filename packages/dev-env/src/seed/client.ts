import fs from 'node:fs/promises'
import path from 'node:path'
import { CID } from 'multiformats/cid'
import { $Typed, BlobRef, Client, Infer } from '@atproto/lex'
import { app, chat, com } from '@atproto/pds'
import {
  AtIdentifierString,
  AtUri,
  AtUriString,
  DidString,
  HandleString,
} from '@atproto/syntax'
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

export class RecordRef {
  uri: AtUri
  cid: CID

  constructor(uri: AtUri | string, cid: CID | string) {
    this.uri = new AtUri(uri.toString())
    this.cid = CID.parse(cid.toString())
  }

  get raw() {
    return {
      uri: this.uri.toString(),
      cid: this.cid.toString(),
    }
  }

  get uriStr() {
    return this.uri.toString()
  }

  get cidStr() {
    return this.cid.toString()
  }
}

export class SeedClient<
  Network extends TestNetworkNoAppView = TestNetworkNoAppView,
> {
  accounts: Record<
    DidString,
    {
      did: DidString
      accessJwt: string
      refreshJwt: string
      handle: HandleString
      email: string
      password: string
    }
  >
  profiles: Record<
    string,
    {
      displayName: string
      description: string
      avatar: BlobRef
      joinedViaStarterPack: RecordRef | undefined
      ref: RecordRef
    }
  >
  follows: Record<string, Record<string, RecordRef>>
  blocks: Record<string, Record<string, RecordRef>>
  mutes: Record<string, Set<string>>
  posts: Record<
    string,
    {
      text: string
      ref: RecordRef
      images: app.bsky.embed.images.Image[]
      quote?: RecordRef
    }[]
  >
  likes: Record<string, Record<string, AtUri>>
  replies: Record<
    string,
    { text: string; ref: RecordRef; images: app.bsky.embed.images.Image[] }[]
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

  dids: Record<string, DidString>

  constructor(
    readonly network: Network,
    readonly client: Client,
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
    params: com.atproto.server.createAccount.InputBody & {
      handle: string
      email: string
      password: string
      inviteCode?: string
    },
  ) {
    const account = await this.client.call(
      com.atproto.server.createAccount,
      params,
    )
    const did = account.did as DidString
    this.dids[shortName] = did as DidString
    this.accounts[did] = {
      ...account,
      did,
      email: params.email,
      password: params.password,
    }
    return this.accounts[did]
  }

  async updateHandle(by: string, handle: HandleString) {
    await this.client.call(
      com.atproto.identity.updateHandle,
      { handle },
      { headers: this.getHeaders(by) },
    )
  }

  async createProfile(
    by: AtIdentifierString,
    displayName: string,
    description: string,
    selfLabels?: string[],
    joinedViaStarterPack?: RecordRef,
    overrides?: Partial<app.bsky.actor.profile.Main>,
  ): Promise<{
    displayName: string
    description: string
    avatar: BlobRef
    ref: RecordRef
    joinedViaStarterPack?: RecordRef
  }> {
    AVATAR_IMG ??= await fs.readFile(AVATAR_PATH)

    const {
      body: { blob: avatarBlob },
    } = await this.client.uploadBlob(AVATAR_IMG, {
      encoding: 'image/jpeg',
      headers: this.getHeaders(by),
    })

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
          createdAt: new Date().toISOString(),
          ...overrides,
        },
        {
          repo: by,
          headers: this.getHeaders(by),
        },
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

  async updateProfile(
    by: AtIdentifierString,
    record: Omit<
      Infer<typeof app.bsky.actor.profile.main>,
      '$type' | 'joinedViaStarterPack'
    >,
  ) {
    const res = await this.client.put(app.bsky.actor.profile, record, {
      rkey: 'self',
      repo: by,
      headers: this.getHeaders(by),
    })
    this.profiles[by] = {
      ...(this.profiles[by] ?? {}),
      ...record,
      ref: new RecordRef(res.uri, res.cid),
    }
    return this.profiles[by]
  }

  async follow(
    from: AtIdentifierString,
    to: DidString,
    overrides?: Partial<app.bsky.graph.follow.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.graph.follow,
      {
        subject: to,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      {
        repo: from,
        headers: this.getHeaders(from),
      },
    )
    this.follows[from] ??= {}
    this.follows[from][to] = new RecordRef(res.uri, res.cid)
    return this.follows[from][to]
  }

  async unfollow(from: AtIdentifierString, to: string) {
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
    from: AtIdentifierString,
    to: DidString,
    overrides?: Partial<app.bsky.graph.block.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.graph.block,
      {
        subject: to,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      {
        repo: from,
        headers: this.getHeaders(from),
      },
    )
    this.blocks[from] ??= {}
    this.blocks[from][to] = new RecordRef(res.uri, res.cid)
    return this.blocks[from][to]
  }

  async unblock(from: AtIdentifierString, to: string) {
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

  async mute(from: string, to: AtIdentifierString) {
    await this.client.call(
      app.bsky.graph.muteActor,
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
    by: AtIdentifierString,
    text: string,
    facets?: app.bsky.richtext.facet.Main[],
    images?: app.bsky.embed.images.Image[],
    quote?: RecordRef,
    overrides?: Partial<app.bsky.feed.post.Main>,
  ) {
    const imageEmbed = images
      ? app.bsky.embed.images.$build({ images })
      : undefined
    const recordEmbed = quote && {
      record: { uri: quote.uriStr, cid: quote.cidStr },
    }
    const embed =
      imageEmbed && recordEmbed
        ? app.bsky.embed.recordWithMedia.$build({
            record: recordEmbed,
            media: imageEmbed,
          })
        : recordEmbed
          ? app.bsky.embed.record.$build(recordEmbed)
          : imageEmbed
    const res = await this.client.create(
      app.bsky.feed.post,
      {
        text,
        facets,
        embed,
        createdAt: new Date().toISOString(),
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

  async deletePost(by: AtIdentifierString, uri: AtUri) {
    await this.client.delete(app.bsky.feed.post, {
      repo: by,
      rkey: uri.rkey,
      headers: this.getHeaders(by),
    })
  }

  async uploadFile(
    by: string,
    filePath: string,
    encoding: `${string}/${string}`,
  ): Promise<app.bsky.embed.images.Image> {
    const file = await fs.readFile(filePath)
    const res = await this.client.uploadBlob(file, {
      headers: this.getHeaders(by),
      encoding,
    })
    return { image: res.body.blob, alt: filePath }
  }

  async like(
    by: AtIdentifierString,
    subject: RecordRef,
    overrides?: Partial<app.bsky.feed.like.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.feed.like,
      {
        subject: subject.raw,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      {
        repo: by,
        headers: this.getHeaders(by),
      },
    )
    this.likes[by] ??= {}
    this.likes[by][subject.uriStr] = new AtUri(res.uri)
    return this.likes[by][subject.uriStr]
  }

  async reply(
    by: AtIdentifierString,
    root: RecordRef,
    parent: RecordRef,
    text: string,
    facets?: app.bsky.richtext.facet.Main[],
    images?: app.bsky.embed.images.Image[],
    overrides?: Partial<app.bsky.feed.post.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.feed.post,
      {
        text,
        createdAt: new Date().toISOString(),
        reply: { root: root.raw, parent: parent.raw },
        facets,
        embed: images ? app.bsky.embed.images.$build({ images }) : undefined,
        ...overrides,
      },
      {
        repo: by,
        headers: this.getHeaders(by),
      },
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
    by: AtIdentifierString,
    subject: RecordRef,
    overrides?: Partial<app.bsky.feed.repost.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.feed.repost,
      {
        subject: subject.raw,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      {
        repo: by,
        headers: this.getHeaders(by),
      },
    )
    this.reposts[by] ??= []
    const repost = new RecordRef(res.uri, res.cid)
    this.reposts[by].push(repost)
    return repost
  }

  async createList(
    by: AtIdentifierString,
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
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      {
        repo: by,
        headers: this.getHeaders(by),
      },
    )
    this.lists[by] ??= {}
    const ref = new RecordRef(res.uri, res.cid)
    this.lists[by][ref.uriStr] = {
      ref: ref,
      items: {},
    }
    return ref
  }

  async createFeedGen(
    by: AtIdentifierString,
    feedDid: DidString,
    name: string,
  ) {
    const res = await this.client.create(
      app.bsky.feed.generator,
      {
        did: feedDid,
        displayName: name,
        createdAt: new Date().toISOString(),
      },
      {
        repo: by,
        headers: this.getHeaders(by),
      },
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
    by: AtIdentifierString,
    name: string,
    actors: DidString[],
    feeds?: AtUriString[],
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
        createdAt: new Date().toISOString(),
      },
      {
        repo: by,
        headers: this.getHeaders(by),
      },
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

  async addToList(by: AtIdentifierString, subject: DidString, list: RecordRef) {
    const res = await this.client.create(
      app.bsky.graph.listitem,
      { subject, list: list.uriStr, createdAt: new Date().toISOString() },
      { repo: by, headers: this.getHeaders(by) },
    )
    const ref = new RecordRef(res.uri, res.cid)
    const found = (this.lists[by] ?? {})[list.uriStr]
    if (found) {
      found.items[subject] = ref
    }
    return ref
  }

  async rmFromList(by: AtIdentifierString, subject: string, list: RecordRef) {
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

  async createReport(opts: {
    reasonType: com.atproto.moderation.defs.ReasonType
    subject:
      | $Typed<com.atproto.admin.defs.RepoRef>
      | $Typed<com.atproto.repo.strongRef.Main>
    reason?: string
    reportedBy: string
  }) {
    const { reasonType, subject, reason, reportedBy } = opts
    return this.client.call(
      com.atproto.moderation.createReport,
      { reasonType, subject, reason },
      {
        headers: this.getHeaders(reportedBy),
      },
    )
  }

  async verify(
    by: AtIdentifierString,
    subject: DidString,
    handle: HandleString,
    displayName: string,
    overrides?: Partial<app.bsky.graph.verification.Main>,
  ) {
    const res = await this.client.create(
      app.bsky.graph.verification,
      {
        subject,
        createdAt: new Date().toISOString(),
        handle,
        displayName,
        ...overrides,
      },
      {
        repo: by,
        headers: this.getHeaders(by),
      },
    )
    this.verifications[by] ??= {}
    this.verifications[by][subject] = new AtUri(res.uri)
    return this.verifications[by][subject]
  }

  async unverify(by: AtIdentifierString, subject: DidString) {
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

  async createChatDeclaration(
    by: AtIdentifierString,
    allowIncoming: chat.bsky.actor.declaration.Main['allowIncoming'],
  ) {
    await this.client.create(
      chat.bsky.actor.declaration,
      { allowIncoming },
      {
        repo: by,
        headers: this.getHeaders(by),
      },
    )
  }

  async createThreadgate(
    by: AtIdentifierString,
    ref: RecordRef,
    overrides?: Omit<Partial<app.bsky.feed.threadgate.Main>, 'post'>,
  ) {
    await this.client.create(
      app.bsky.feed.threadgate,
      {
        createdAt: new Date().toISOString(),
        ...overrides,
        post: ref.uriStr,
      },
      {
        repo: by,
        rkey: ref.uri.rkey,
        headers: this.getHeaders(by),
      },
    )
  }

  getHeaders(did: string) {
    return SeedClient.getHeaders(this.accounts[did].accessJwt)
  }

  static getHeaders(jwt: string) {
    return { authorization: `Bearer ${jwt}` }
  }
}
