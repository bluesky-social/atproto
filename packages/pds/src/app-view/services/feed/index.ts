import { sql } from 'kysely'
import { AtUri } from '@atproto/uri'
import { dedupeStrs } from '@atproto/common'
import Database from '../../../db'
import { countAll, notSoftDeletedClause } from '../../../db/util'
import { ImageUriBuilder } from '../../../image/uri'
import { ids } from '../../../lexicon/lexicons'
import {
  Record as PostRecord,
  isRecord as isPostRecord,
} from '../../../lexicon/types/app/bsky/feed/post'
import { isMain as isEmbedImages } from '../../../lexicon/types/app/bsky/embed/images'
import { isMain as isEmbedExternal } from '../../../lexicon/types/app/bsky/embed/external'
import { isMain as isEmbedRecord } from '../../../lexicon/types/app/bsky/embed/record'
import { isMain as isEmbedRecordWithMedia } from '../../../lexicon/types/app/bsky/embed/recordWithMedia'
import { FeedViewPost } from '../../../lexicon/types/app/bsky/feed/defs'
import {
  ActorInfoMap,
  PostInfoMap,
  FeedItemType,
  FeedRow,
  FeedGenInfoMap,
  PostViews,
  PostEmbedViews,
  RecordEmbedViewRecordMap,
} from './types'
import { LabelService, Labels } from '../label'
import { ActorService } from '../actor'
import { GraphService } from '../graph'
import { FeedViews } from './views'
import { cborToLexRecord } from '@atproto/repo'

export * from './types'

export class FeedService {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new FeedService(db, imgUriBuilder)
  }

  views = new FeedViews(this.db, this.imgUriBuilder)
  services = {
    label: LabelService.creator()(this.db),
    actor: ActorService.creator(this.imgUriBuilder)(this.db),
    graph: GraphService.creator(this.imgUriBuilder)(this.db),
  }

  selectPostQb() {
    return this.db.db
      .selectFrom('post')
      .select([
        sql<FeedItemType>`${'post'}`.as('type'),
        'post.uri as uri',
        'post.cid as cid',
        'post.uri as postUri',
        'post.creator as originatorDid',
        'post.creator as postAuthorDid',
        'post.replyParent as replyParent',
        'post.replyRoot as replyRoot',
        'post.indexedAt as sortAt',
      ])
  }

  selectFeedItemQb() {
    return this.db.db
      .selectFrom('feed_item')
      .innerJoin('post', 'post.uri', 'feed_item.postUri')
      .selectAll('feed_item')
      .select([
        'post.replyRoot',
        'post.replyParent',
        'post.creator as postAuthorDid',
      ])
  }

  selectFeedGeneratorQb(requester: string) {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('feed_generator')
      .innerJoin('did_handle', 'did_handle.did', 'feed_generator.creator')
      .innerJoin(
        'repo_root as creator_repo',
        'creator_repo.did',
        'feed_generator.creator',
      )
      .innerJoin('record', 'record.uri', 'feed_generator.uri')
      .selectAll()
      .where(notSoftDeletedClause(ref('creator_repo')))
      .where(notSoftDeletedClause(ref('record')))
      .select((qb) =>
        qb
          .selectFrom('like')
          .whereRef('like.subject', '=', 'feed_generator.uri')
          .select(countAll.as('count'))
          .as('likeCount'),
      )
      .select((qb) =>
        qb
          .selectFrom('like')
          .where('like.creator', '=', requester)
          .whereRef('like.subject', '=', 'feed_generator.uri')
          .select('uri')
          .as('viewerLike'),
      )
  }

  // @NOTE keep in sync with actorService.views.profile()
  async getActorInfos(
    dids: string[],
    requester: string,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean }, // @NOTE used by hydrateFeed() to batch label hydration
  ): Promise<ActorInfoMap> {
    if (dids.length < 1) return {}
    const { ref } = this.db.db.dynamic
    const { skipLabels = false, includeSoftDeleted = false } = opts ?? {}
    const [actors, labels, listMutes] = await Promise.all([
      this.db.db
        .selectFrom('did_handle')
        .where('did_handle.did', 'in', dids)
        .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
        .selectAll('did_handle')
        .if(!includeSoftDeleted, (qb) =>
          qb.where(notSoftDeletedClause(ref('repo_root'))),
        )
        .select([
          'profile.uri as profileUri',
          'profile.displayName as displayName',
          'profile.description as description',
          'profile.avatarCid as avatarCid',
          'profile.indexedAt as indexedAt',
          this.db.db
            .selectFrom('follow')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterFollowing'),
          this.db.db
            .selectFrom('follow')
            .whereRef('creator', '=', ref('did_handle.did'))
            .where('subjectDid', '=', requester)
            .select('uri')
            .as('requesterFollowedBy'),
          this.db.db
            .selectFrom('actor_block')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterBlocking'),
          this.db.db
            .selectFrom('actor_block')
            .whereRef('creator', '=', ref('did_handle.did'))
            .where('subjectDid', '=', requester)
            .select('uri')
            .as('requesterBlockedBy'),
          this.db.db
            .selectFrom('mute')
            .whereRef('did', '=', ref('did_handle.did'))
            .where('mutedByDid', '=', requester)
            .select('did')
            .as('requesterMuted'),
        ])
        .execute(),
      this.services.label.getLabelsForSubjects(skipLabels ? [] : dids),
      this.services.actor.views.getListMutes(dids, requester),
    ])
    return actors.reduce((acc, cur) => {
      const actorLabels = labels[cur.did] ?? []
      return {
        ...acc,
        [cur.did]: {
          did: cur.did,
          handle: cur.handle,
          displayName: truncateUtf8(cur.displayName, 64) || undefined,
          avatar: cur.avatarCid
            ? this.imgUriBuilder.getCommonSignedUri('avatar', cur.avatarCid)
            : undefined,
          viewer: {
            muted: !!cur?.requesterMuted || !!listMutes[cur.did],
            mutedByList: listMutes[cur.did],
            blockedBy: !!cur?.requesterBlockedBy,
            blocking: cur?.requesterBlocking || undefined,
            following: cur?.requesterFollowing || undefined,
            followedBy: cur?.requesterFollowedBy || undefined,
          },
          labels: skipLabels ? undefined : actorLabels,
        },
      }
    }, {} as ActorInfoMap)
  }

  async getPostInfos(
    postUris: string[],
    requester: string,
  ): Promise<PostInfoMap> {
    if (postUris.length < 1) return {}
    const db = this.db.db
    const { ref } = db.dynamic
    const posts = await db
      .selectFrom('post')
      .where('post.uri', 'in', postUris)
      .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.cid', '=', 'post.cid')
          .onRef('ipld_block.creator', '=', 'post.creator'),
      )
      .innerJoin('repo_root', 'repo_root.did', 'post.creator')
      .innerJoin('record', 'record.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('repo_root'))) // Ensures post reply parent/roots get omitted from views when taken down
      .where(notSoftDeletedClause(ref('record')))
      .select([
        'post.uri as uri',
        'post.cid as cid',
        'post.creator as creator',
        'post.indexedAt as indexedAt',
        'ipld_block.content as recordBytes',
        'post_agg.likeCount as likeCount',
        'post_agg.repostCount as repostCount',
        'post_agg.replyCount as replyCount',
        db
          .selectFrom('repost')
          .where('creator', '=', requester)
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterRepost'),
        db
          .selectFrom('like')
          .where('creator', '=', requester)
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterLike'),
      ])
      .execute()
    return posts.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.uri]: cur,
      }),
      {} as PostInfoMap,
    )
  }

  async getFeedGeneratorInfos(generatorUris: string[], requester: string) {
    if (generatorUris.length < 1) return {}
    const feedGens = await this.selectFeedGeneratorQb(requester)
      .where('feed_generator.uri', 'in', generatorUris)
      .execute()
    return feedGens.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.uri]: cur,
      }),
      {} as FeedGenInfoMap,
    )
  }

  async getPostViews(
    postUris: string[],
    requester: string,
    precomputed?: {
      actors?: ActorInfoMap
      posts?: PostInfoMap
      embeds?: PostEmbedViews
      labels?: Labels
    },
  ): Promise<PostViews> {
    const uris = dedupeStrs(postUris)
    const dids = dedupeStrs(postUris.map((uri) => new AtUri(uri).hostname))

    const [actors, posts, labels] = await Promise.all([
      precomputed?.actors ??
        this.getActorInfos(dids, requester, { skipLabels: true }),
      precomputed?.posts ?? this.getPostInfos(uris, requester),
      precomputed?.labels ??
        this.services.label.getLabelsForSubjects([...uris, ...dids]),
    ])
    const embeds =
      precomputed?.embeds ?? (await this.embedsForPosts(posts, requester))

    return uris.reduce((acc, cur) => {
      const view = this.views.formatPostView(cur, actors, posts, embeds, labels)
      if (view) {
        acc[cur] = view
      }
      return acc
    }, {} as PostViews)
  }

  async hydrateFeed(
    items: FeedRow[],
    requester: string,
    // @TODO (deprecated) remove this once all clients support the blocked/not-found union on post views
    usePostViewUnion?: boolean,
  ): Promise<FeedViewPost[]> {
    const actorDids = new Set<string>()
    const postUris = new Set<string>()
    for (const item of items) {
      actorDids.add(item.postAuthorDid)
      postUris.add(item.postUri)
      if (item.postAuthorDid !== item.originatorDid) {
        actorDids.add(item.originatorDid)
      }
      if (item.replyParent) {
        postUris.add(item.replyParent)
        actorDids.add(new AtUri(item.replyParent).hostname)
      }
      if (item.replyRoot) {
        postUris.add(item.replyRoot)
        actorDids.add(new AtUri(item.replyRoot).hostname)
      }
    }
    const [actors, posts, labels] = await Promise.all([
      this.getActorInfos(Array.from(actorDids), requester, {
        skipLabels: true,
      }),
      this.getPostInfos(Array.from(postUris), requester),
      this.services.label.getLabelsForSubjects([...postUris, ...actorDids]),
    ])
    const embeds = await this.embedsForPosts(posts, requester)

    return this.views.formatFeed(
      items,
      actors,
      posts,
      embeds,
      labels,
      usePostViewUnion,
    )
  }

  async embedsForPosts(postInfos: PostInfoMap, requester: string, depth = 0) {
    const postMap = postRecordsFromInfos(postInfos)
    const posts = Object.values(postMap)
    if (posts.length < 1) {
      return {}
    }
    const recordEmbedViews =
      depth > 1 ? {} : await this.nestedRecordViews(posts, requester, depth)

    const postEmbedViews: PostEmbedViews = {}
    for (const [uri, post] of Object.entries(postMap)) {
      if (!post.embed) continue
      if (isEmbedImages(post.embed)) {
        postEmbedViews[uri] = this.views.imagesEmbedView(post.embed)
      } else if (isEmbedExternal(post.embed)) {
        postEmbedViews[uri] = this.views.externalEmbedView(post.embed)
      } else if (isEmbedRecord(post.embed)) {
        if (!recordEmbedViews[post.embed.record.uri]) continue
        postEmbedViews[uri] = {
          $type: 'app.bsky.embed.record#view',
          record: recordEmbedViews[post.embed.record.uri],
        }
      } else if (isEmbedRecordWithMedia(post.embed)) {
        const embedRecordView = recordEmbedViews[post.embed.record.record.uri]
        if (!embedRecordView) continue
        const formatted = this.views.getRecordWithMediaEmbedView(
          post.embed,
          embedRecordView,
        )
        if (formatted) {
          postEmbedViews[uri] = formatted
        }
      }
    }
    return postEmbedViews
  }

  async nestedRecordViews(
    posts: PostRecord[],
    requester: string,
    depth: number,
  ): Promise<RecordEmbedViewRecordMap> {
    const nestedUris = nestedRecordUris(posts)
    if (nestedUris.length < 1) return {}
    const nestedPostUris: string[] = []
    const nestedFeedGenUris: string[] = []
    const nestedListUris: string[] = []
    const nestedDidsSet = new Set<string>()
    for (const uri of nestedUris) {
      const parsed = new AtUri(uri)
      nestedDidsSet.add(parsed.hostname)
      if (parsed.collection === ids.AppBskyFeedPost) {
        nestedPostUris.push(uri)
      } else if (parsed.collection === ids.AppBskyFeedGenerator) {
        nestedFeedGenUris.push(uri)
      } else if (parsed.collection === ids.AppBskyGraphList) {
        nestedListUris.push(uri)
      }
    }
    const nestedDids = [...nestedDidsSet]
    const [postInfos, actorInfos, labelViews, feedGenInfos, listViews] =
      await Promise.all([
        this.getPostInfos(nestedPostUris, requester),
        this.getActorInfos(nestedDids, requester, { skipLabels: true }),
        this.services.label.getLabelsForSubjects([
          ...nestedPostUris,
          ...nestedDids,
        ]),
        this.getFeedGeneratorInfos(nestedFeedGenUris, requester),
        this.services.graph.getListViews(nestedListUris, requester),
      ])
    const deepEmbedViews = await this.embedsForPosts(
      postInfos,
      requester,
      depth + 1,
    )
    const recordEmbedViews: RecordEmbedViewRecordMap = {}
    for (const uri of nestedUris) {
      const collection = new AtUri(uri).collection
      if (collection === ids.AppBskyFeedGenerator && feedGenInfos[uri]) {
        recordEmbedViews[uri] = {
          $type: 'app.bsky.feed.defs#generatorView',
          ...this.views.formatFeedGeneratorView(
            feedGenInfos[uri],
            actorInfos,
            labelViews,
          ),
        }
      } else if (collection === ids.AppBskyGraphList && listViews[uri]) {
        recordEmbedViews[uri] = {
          $type: 'app.bsky.graph.defs#listView',
          ...this.services.graph.formatListView(listViews[uri], actorInfos),
        }
      } else if (collection === ids.AppBskyFeedPost && postInfos[uri]) {
        const formatted = this.views.formatPostView(
          uri,
          actorInfos,
          postInfos,
          deepEmbedViews,
          labelViews,
        )
        recordEmbedViews[uri] = this.views.getRecordEmbedView(
          uri,
          formatted,
          depth > 0,
        )
      } else {
        recordEmbedViews[uri] = {
          $type: 'app.bsky.embed.record#viewNotFound',
          uri,
        }
      }
    }
    return recordEmbedViews
  }
}

function truncateUtf8(str: string | null | undefined, length: number) {
  if (!str) return str
  const encoder = new TextEncoder()
  const utf8 = encoder.encode(str)
  if (utf8.length > length) {
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const truncated = utf8.slice(0, length)
    return decoder.decode(truncated).replace(/\uFFFD$/, '')
  }
  return str
}

const postRecordsFromInfos = (
  infos: PostInfoMap,
): { [uri: string]: PostRecord } => {
  const records: { [uri: string]: PostRecord } = {}
  for (const [uri, info] of Object.entries(infos)) {
    const record = cborToLexRecord(info.recordBytes)
    if (isPostRecord(record)) {
      records[uri] = record
    }
  }
  return records
}

const nestedRecordUris = (posts: PostRecord[]): string[] => {
  const uris: string[] = []
  for (const post of posts) {
    if (!post.embed) continue
    if (isEmbedRecord(post.embed)) {
      uris.push(post.embed.record.uri)
    } else if (isEmbedRecordWithMedia(post.embed)) {
      uris.push(post.embed.record.record.uri)
    } else {
      continue
    }
  }
  return uris
}
