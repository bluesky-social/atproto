import { LexMap, UriString } from '@atproto/lex'
import { AtUri, DidString, HandleString, INVALID_HANDLE } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { AccountManager } from '../account-manager/account-manager'
import { ActorStoreReader } from '../actor-store/actor-store-reader'
import { BskyAppView } from '../bsky-app-view'
import { ImageUrlBuilder } from '../image/image-url-builder'
import { app } from '../lexicons/index.js'
import { LocalRecords, RecordDescript } from './types'

type CommonSignedUris = 'avatar' | 'banner' | 'feed_thumbnail' | 'feed_fullsize'

export type LocalViewerCreator = (
  actorStoreReader: ActorStoreReader,
) => LocalViewer

export class LocalViewer {
  constructor(
    public readonly actorStoreReader: ActorStoreReader,
    public readonly accountManager: AccountManager,
    public readonly imageUrlBuilder: ImageUrlBuilder,
    public readonly bskyAppView?: BskyAppView,
  ) {}

  get did() {
    return this.actorStoreReader.did as DidString
  }

  static creator(
    accountManager: AccountManager,
    imageUrlBuilder: ImageUrlBuilder,
    bskyAppView?: BskyAppView,
  ): LocalViewerCreator {
    return (actorStore) =>
      new LocalViewer(actorStore, accountManager, imageUrlBuilder, bskyAppView)
  }

  getImageUrl(pattern: CommonSignedUris, cid: string) {
    return this.imageUrlBuilder.build(pattern, this.did, cid) as UriString
  }

  async serviceAuthHeaders(did: string, lxm: string) {
    if (!this.bskyAppView) {
      throw new Error('Could not find bsky appview did')
    }
    const keypair = await this.actorStoreReader.keypair()

    return createServiceAuthHeaders({
      iss: did,
      aud: this.bskyAppView.did,
      lxm,
      keypair,
    })
  }

  async getRecordsSinceRev(rev: string): Promise<LocalRecords> {
    return this.actorStoreReader.record.getRecordsSinceRev(rev)
  }

  async getProfileBasic(): Promise<app.bsky.actor.defs.ProfileViewBasic | null> {
    const [profileRes, accountRes] = await Promise.all([
      this.actorStoreReader.record.getProfileRecord(),
      this.accountManager.getAccount(this.did),
    ])

    if (!accountRes) return null

    return {
      did: this.did,
      handle: (accountRes.handle ?? INVALID_HANDLE) as HandleString,
      displayName: profileRes?.displayName,
      avatar: profileRes?.avatar
        ? this.getImageUrl('avatar', profileRes.avatar.ref.toString())
        : undefined,
    }
  }

  async formatAndInsertPostsInFeed(
    feed: app.bsky.feed.defs.FeedViewPost[],
    posts: RecordDescript<app.bsky.feed.post.Main>[],
  ): Promise<app.bsky.feed.defs.FeedViewPost[]> {
    if (posts.length === 0) {
      return feed
    }
    const lastTime = feed.at(-1)?.post.indexedAt ?? new Date(0).toISOString()
    const inFeed = posts.filter((p) => p.indexedAt > lastTime)
    const newestToOldest = inFeed.reverse()
    const maybeFormatted = await Promise.all(
      newestToOldest.map((p) => this.getPost(p)),
    )
    const formatted = maybeFormatted.filter(
      (p) => p !== null,
    ) as app.bsky.feed.defs.PostView[]
    for (const post of formatted) {
      const idx = feed.findIndex((fi) => fi.post.indexedAt < post.indexedAt)
      if (idx >= 0) {
        feed.splice(idx, 0, { post })
      } else {
        feed.push({ post })
      }
    }
    return feed
  }

  async getPost(
    descript: RecordDescript<app.bsky.feed.post.Main>,
  ): Promise<app.bsky.feed.defs.PostView | null> {
    const { uri, cid, indexedAt, record } = descript
    const author = await this.getProfileBasic()
    if (!author) return null
    const embed = record.embed ? await this.formatPostEmbed(record) : undefined
    return {
      uri: uri.toString(),
      cid: cid.toString(),
      likeCount: 0, // counts presumed to be 0 directly after post creation
      replyCount: 0,
      repostCount: 0,
      quoteCount: 0,
      author,
      record: record as LexMap,
      embed,
      indexedAt,
    }
  }

  async formatPostEmbed(post: app.bsky.feed.post.Main) {
    const embed = post.embed
    if (!embed) return undefined
    if (app.bsky.embed.images.$isTypeOf(embed)) {
      return this.formatImageEmbed(embed)
    } else if (app.bsky.embed.external.$isTypeOf(embed)) {
      return this.formatExternalEmbed(embed)
    } else if (app.bsky.embed.record.$isTypeOf(embed)) {
      return this.formatRecordEmbed(embed)
    } else if (app.bsky.embed.recordWithMedia.$isTypeOf(embed)) {
      return this.formatRecordWithMediaEmbed(embed)
    } else {
      return undefined
    }
  }

  formatImageEmbed(embed: app.bsky.embed.images.Main) {
    const images = embed.images.map(
      (img): app.bsky.embed.images.ViewImage => ({
        thumb: this.getImageUrl('feed_thumbnail', img.image.ref.toString()),
        fullsize: this.getImageUrl('feed_fullsize', img.image.ref.toString()),
        aspectRatio: img.aspectRatio,
        alt: img.alt,
      }),
    )
    return app.bsky.embed.images.view.$build({ images })
  }

  formatExternalEmbed(embed: app.bsky.embed.external.Main) {
    const { uri, title, description, thumb } = embed.external
    return app.bsky.embed.external.view.$build({
      external: {
        uri,
        title,
        description,
        thumb: thumb
          ? this.getImageUrl('feed_thumbnail', thumb.ref.toString())
          : undefined,
      },
    })
  }

  async formatRecordEmbed(embed: app.bsky.embed.record.Main) {
    const view = await this.formatRecordEmbedInternal(embed)
    return app.bsky.embed.record.view.$build({
      record:
        view ??
        app.bsky.embed.record.viewNotFound.$build({
          uri: embed.record.uri,
          notFound: true,
        }),
    })
  }

  private async formatRecordEmbedInternal(embed: app.bsky.embed.record.Main) {
    if (!this.bskyAppView) {
      return undefined
    }
    const collection = new AtUri(embed.record.uri).collection
    if (collection === app.bsky.feed.post.$type) {
      const { headers } = await this.serviceAuthHeaders(
        this.did,
        app.bsky.feed.getPosts.$lxm,
      )
      const data = await this.bskyAppView.client.call(
        app.bsky.feed.getPosts,
        { uris: [embed.record.uri] },
        { headers },
      )
      const post = data.posts[0]
      if (!post) return undefined

      return app.bsky.embed.record.viewRecord.$build({
        uri: post.uri,
        cid: post.cid,
        author: post.author,
        value: post.record,
        labels: post.labels,
        embeds: post.embed ? [post.embed] : undefined,
        indexedAt: post.indexedAt,
      })
    } else if (collection === app.bsky.feed.generator.$type) {
      const { headers } = await this.serviceAuthHeaders(
        this.did,
        app.bsky.feed.getFeedGenerator.$lxm,
      )
      const data = await this.bskyAppView.client.call(
        app.bsky.feed.getFeedGenerator,
        { feed: embed.record.uri },
        { headers },
      )
      return app.bsky.feed.defs.generatorView.$build(data.view)
    } else if (collection === app.bsky.graph.list.$type) {
      const { headers } = await this.serviceAuthHeaders(
        this.did,
        app.bsky.graph.getList.$lxm,
      )
      const data = await this.bskyAppView.client.call(
        app.bsky.graph.getList,
        { list: embed.record.uri },
        { headers },
      )
      return app.bsky.graph.defs.listView.$build(data.list)
    }
    return undefined
  }

  async formatRecordWithMediaEmbed(embed: app.bsky.embed.recordWithMedia.Main) {
    const media = app.bsky.embed.images.$isTypeOf(embed.media)
      ? this.formatImageEmbed(embed.media)
      : app.bsky.embed.external.$isTypeOf(embed.media)
        ? this.formatExternalEmbed(embed.media)
        : null

    if (!media) return undefined

    const record = await this.formatRecordEmbed(embed.record)
    return app.bsky.embed.recordWithMedia.view.$build({
      record,
      media,
    })
  }

  updateProfileViewBasic<
    T extends
      | app.bsky.actor.defs.ProfileViewDetailed
      | app.bsky.actor.defs.ProfileViewBasic
      | app.bsky.actor.defs.ProfileView,
  >(view: T, record: app.bsky.actor.profile.Main): T {
    return {
      ...view,
      displayName: record.displayName,
      avatar: record.avatar
        ? this.getImageUrl('avatar', record.avatar.ref.toString())
        : undefined,
    }
  }

  updateProfileView<
    T extends
      | app.bsky.actor.defs.ProfileViewDetailed
      | app.bsky.actor.defs.ProfileViewBasic
      | app.bsky.actor.defs.ProfileView,
  >(view: T, record: app.bsky.actor.profile.Main): T {
    return {
      ...this.updateProfileViewBasic(view, record),
      description: record.description,
    }
  }

  updateProfileDetailed<T extends app.bsky.actor.defs.ProfileViewDetailed>(
    view: T,
    record: app.bsky.actor.profile.Main,
  ): T {
    return {
      ...this.updateProfileView(view, record),
      banner: record.banner
        ? this.getImageUrl('banner', record.banner.ref.toString())
        : undefined,
    }
  }
}
