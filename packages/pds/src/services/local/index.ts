import util from 'util'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { cborToLexRecord } from '@atproto/repo'
import Database from '../../db'
import { Record as PostRecord } from '../../lexicon/types/app/bsky/feed/post'
import { Record as ProfileRecord } from '../../lexicon/types/app/bsky/actor/profile'
import { ids } from '../../lexicon/lexicons'
import {
  ProfileViewBasic,
  ProfileView,
  ProfileViewDetailed,
} from '../../lexicon/types/app/bsky/actor/defs'
import { FeedViewPost, PostView } from '../../lexicon/types/app/bsky/feed/defs'
import {
  Main as EmbedImages,
  isMain as isEmbedImages,
} from '../../lexicon/types/app/bsky/embed/images'
import {
  Main as EmbedExternal,
  isMain as isEmbedExternal,
} from '../../lexicon/types/app/bsky/embed/external'
import {
  Main as EmbedRecord,
  isMain as isEmbedRecord,
  View as EmbedRecordView,
} from '../../lexicon/types/app/bsky/embed/record'
import {
  Main as EmbedRecordWithMedia,
  isMain as isEmbedRecordWithMedia,
} from '../../lexicon/types/app/bsky/embed/recordWithMedia'
import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'

type CommonSignedUris = 'avatar' | 'banner' | 'feed_thumbnail' | 'feed_fullsize'

export class LocalService {
  constructor(
    public db: Database,
    public signingKey: Keypair,
    public pdsHostname: string,
    public appViewAgent?: AtpAgent,
    public appviewDid?: string,
    public appviewCdnUrlPattern?: string,
  ) {}

  static creator(
    signingKey: Keypair,
    pdsHostname: string,
    appViewAgent?: AtpAgent,
    appviewDid?: string,
    appviewCdnUrlPattern?: string,
  ) {
    return (db: Database) =>
      new LocalService(
        db,
        signingKey,
        pdsHostname,
        appViewAgent,
        appviewDid,
        appviewCdnUrlPattern,
      )
  }

  getImageUrl(pattern: CommonSignedUris, did: string, cid: string) {
    if (!this.appviewCdnUrlPattern) {
      return `https://${this.pdsHostname}/xrpc/${ids.ComAtprotoSyncGetBlob}?did=${did}&cid=${cid}`
    }
    return util.format(this.appviewCdnUrlPattern, pattern, did, cid)
  }

  async serviceAuthHeaders(did: string) {
    if (!this.appviewDid) {
      throw new Error('Could not find bsky appview did')
    }
    return createServiceAuthHeaders({
      iss: did,
      aud: this.appviewDid,
      keypair: this.signingKey,
    })
  }

  async getRecordsSinceRev(did: string, rev: string): Promise<LocalRecords> {
    const res = await this.db.db
      .selectFrom('record')
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('record.did', '=', 'ipld_block.creator')
          .onRef('record.cid', '=', 'ipld_block.cid'),
      )
      .select([
        'ipld_block.content',
        'uri',
        'ipld_block.cid',
        'record.indexedAt',
      ])
      .where('did', '=', did)
      .where('record.repoRev', '>', rev)
      .orderBy('record.repoRev', 'asc')
      .execute()
    return res.reduce(
      (acc, cur) => {
        const descript = {
          uri: new AtUri(cur.uri),
          cid: CID.parse(cur.cid),
          indexedAt: cur.indexedAt,
          record: cborToLexRecord(cur.content),
        }
        if (
          descript.uri.collection === ids.AppBskyActorProfile &&
          descript.uri.rkey === 'self'
        ) {
          acc.profile = descript as RecordDescript<ProfileRecord>
        } else if (descript.uri.collection === ids.AppBskyFeedPost) {
          acc.posts.push(descript as RecordDescript<PostRecord>)
        }
        return acc
      },
      { profile: null, posts: [] } as LocalRecords,
    )
  }

  async getProfileBasic(did: string): Promise<ProfileViewBasic | null> {
    const res = await this.db.db
      .selectFrom('did_handle')
      .leftJoin('record', 'record.did', 'did_handle.did')
      .leftJoin('ipld_block', (join) =>
        join
          .onRef('record.did', '=', 'ipld_block.creator')
          .onRef('record.cid', '=', 'ipld_block.cid'),
      )
      .where('did_handle.did', '=', did)
      .where('record.collection', '=', ids.AppBskyActorProfile)
      .where('record.rkey', '=', 'self')
      .selectAll()
      .executeTakeFirst()
    if (!res) return null
    const record = res.content
      ? (cborToLexRecord(res.content) as ProfileRecord)
      : null
    return {
      did,
      handle: res.handle,
      displayName: record?.displayName,
      avatar: record?.avatar
        ? this.getImageUrl('avatar', did, record.avatar.ref.toString())
        : undefined,
    }
  }

  async formatAndInsertPostsInFeed(
    feed: FeedViewPost[],
    posts: RecordDescript<PostRecord>[],
  ): Promise<FeedViewPost[]> {
    if (posts.length === 0) {
      return feed
    }
    const lastTime = feed.at(-1)?.post.indexedAt ?? new Date(0).toISOString()
    const inFeed = posts.filter((p) => p.indexedAt > lastTime)
    const newestToOldest = inFeed.reverse()
    const maybeFormatted = await Promise.all(
      newestToOldest.map((p) => this.getPost(p)),
    )
    const formatted = maybeFormatted.filter((p) => p !== null) as PostView[]
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
    descript: RecordDescript<PostRecord>,
  ): Promise<PostView | null> {
    const { uri, cid, indexedAt, record } = descript
    const author = await this.getProfileBasic(uri.hostname)
    if (!author) return null
    const embed = record.embed
      ? await this.formatPostEmbed(author.did, record)
      : undefined
    return {
      uri: uri.toString(),
      cid: cid.toString(),
      author,
      record,
      embed: embed ?? undefined,
      indexedAt,
    }
  }

  async formatPostEmbed(did: string, post: PostRecord) {
    const embed = post.embed
    if (!embed) return null
    if (isEmbedImages(embed) || isEmbedExternal(embed)) {
      return this.formatSimpleEmbed(did, embed)
    } else if (isEmbedRecord(embed)) {
      return this.formatRecordEmbed(did, embed)
    } else if (isEmbedRecordWithMedia(embed)) {
      return this.formatRecordWithMediaEmbed(did, embed)
    } else {
      return null
    }
  }

  async formatSimpleEmbed(did: string, embed: EmbedImages | EmbedExternal) {
    if (isEmbedImages(embed)) {
      const images = embed.images.map((img) => ({
        thumb: this.getImageUrl(
          'feed_thumbnail',
          did,
          img.image.ref.toString(),
        ),
        fullsize: this.getImageUrl(
          'feed_fullsize',
          did,
          img.image.ref.toString(),
        ),
        alt: img.alt,
      }))
      return {
        $type: 'app.bsky.embed.images#view',
        images,
      }
    } else {
      const { uri, title, description, thumb } = embed.external
      return {
        $type: 'app.bsky.embed.external#view',
        uri,
        title,
        description,
        thumb: thumb
          ? this.getImageUrl('feed_thumbnail', did, thumb.ref.toString())
          : undefined,
      }
    }
  }

  async formatRecordEmbed(
    did: string,
    embed: EmbedRecord,
  ): Promise<EmbedRecordView> {
    const view = await this.formatRecordEmbedInternal(did, embed)
    return {
      $type: 'app.bsky.embed.record#view',
      record:
        view === null
          ? {
              $type: 'app.bsky.embed.record#viewNotFound',
              uri: embed.record.uri,
            }
          : view,
    }
  }

  async formatRecordEmbedInternal(did: string, embed: EmbedRecord) {
    if (!this.appViewAgent || !this.appviewDid) {
      return null
    }
    const collection = new AtUri(embed.record.uri).collection
    if (collection === ids.AppBskyFeedPost) {
      const res = await this.appViewAgent.api.app.bsky.feed.getPosts(
        {
          uris: [embed.record.uri],
        },
        await this.serviceAuthHeaders(did),
      )
      const post = res.data.posts[0]
      if (!post) return null
      return {
        $type: 'app.bsky.embed.record#viewRecord',
        uri: post.uri,
        cid: post.cid,
        author: post.author,
        value: post.record,
        labels: post.labels,
        embeds: post.embed ? [post.embed] : undefined,
        indexedAt: post.indexedAt,
      }
    } else if (collection === ids.AppBskyFeedGenerator) {
      const res = await this.appViewAgent.api.app.bsky.feed.getFeedGenerator(
        {
          feed: embed.record.uri,
        },
        await this.serviceAuthHeaders(did),
      )
      return {
        $type: 'app.bsaky.feed.defs#generatorView',
        ...res.data.view,
      }
    } else if (collection === ids.AppBskyGraphList) {
      const res = await this.appViewAgent.api.app.bsky.graph.getList(
        {
          list: embed.record.uri,
        },
        await this.serviceAuthHeaders(did),
      )
      return {
        $type: 'app.bsaky.graph.defs#listView',
        ...res.data.list,
      }
    }
    return null
  }

  async formatRecordWithMediaEmbed(did: string, embed: EmbedRecordWithMedia) {
    if (!isEmbedImages(embed.media) && !isEmbedExternal(embed.media)) {
      return null
    }
    const media = this.formatSimpleEmbed(did, embed.media)
    const record = await this.formatRecordEmbed(did, embed.record)
    return {
      $type: 'app.bsky.embed.recordWithMedia#view',
      record,
      media,
    }
  }

  updateProfileViewBasic(
    view: ProfileViewBasic,
    record: ProfileRecord,
  ): ProfileViewBasic {
    return {
      ...view,
      displayName: record.displayName,
      avatar: record.avatar
        ? this.getImageUrl('avatar', view.did, record.avatar.ref.toString())
        : undefined,
    }
  }

  updateProfileView(view: ProfileView, record: ProfileRecord): ProfileView {
    return {
      ...this.updateProfileViewBasic(view, record),
      description: record.description,
    }
  }

  updateProfileDetailed(
    view: ProfileViewDetailed,
    record: ProfileRecord,
  ): ProfileViewDetailed {
    return {
      ...this.updateProfileView(view, record),
      banner: record.banner
        ? this.getImageUrl('banner', view.did, record.banner.ref.toString())
        : undefined,
    }
  }
}

export type LocalRecords = {
  profile: RecordDescript<ProfileRecord> | null
  posts: RecordDescript<PostRecord>[]
}

export type RecordDescript<T> = {
  uri: AtUri
  cid: CID
  indexedAt: string
  record: T
}
