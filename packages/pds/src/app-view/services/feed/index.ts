import { sql } from 'kysely'
import { AtUri } from '@atproto/uri'
import { dedupeStrs } from '@atproto/common'
import { cborToLexRecord } from '@atproto/repo'
import Database from '../../../db'
import { countAll, notSoftDeletedClause, valuesList } from '../../../db/util'
import { ImageUriBuilder } from '../../../image/uri'
import { ids } from '../../../lexicon/lexicons'
import {
  Record as PostRecord,
  isRecord as isPostRecord,
} from '../../../lexicon/types/app/bsky/feed/post'
import { isMain as isEmbedImages } from '../../../lexicon/types/app/bsky/embed/images'
import { isMain as isEmbedExternal } from '../../../lexicon/types/app/bsky/embed/external'
import {
  isMain as isEmbedRecord,
  isViewRecord,
} from '../../../lexicon/types/app/bsky/embed/record'
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
  PostBlocksMap,
  RecordEmbedViewRecord,
  FeedHydrationOptions,
} from './types'
import { LabelService, Labels } from '../label'
import { ActorService } from '../actor'
import { GraphService } from '../graph'
import { FeedViews } from './views'
import { LabelCache } from '../../../label-cache'

export * from './types'

export class FeedService {
  constructor(
    public db: Database,
    public imgUriBuilder: ImageUriBuilder,
    public labelCache: LabelCache,
  ) {}

  static creator(imgUriBuilder: ImageUriBuilder, labelCache: LabelCache) {
    return (db: Database) => new FeedService(db, imgUriBuilder, labelCache)
  }

  views = new FeedViews(this.db, this.imgUriBuilder)
  services = {
    label: LabelService.creator(this.labelCache)(this.db),
    actor: ActorService.creator(this.imgUriBuilder, this.labelCache)(this.db),
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

  selectFeedGeneratorQb(requester: string | null) {
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
          .where('like.creator', '=', requester ?? '')
          .whereRef('like.subject', '=', 'feed_generator.uri')
          .select('uri')
          .as('viewerLike'),
      )
  }

  // @NOTE keep in sync with actorService.views.profile()
  async getActorInfos(
    dids: string[],
    requester: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean }, // @NOTE used by hydrateFeed() to batch label hydration
  ): Promise<ActorInfoMap> {
    if (dids.length < 1) return {}
    const { ref } = this.db.db.dynamic
    const { skipLabels = false, includeSoftDeleted = false } = opts ?? {}
    const [actors, labels] = await Promise.all([
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
            .where('creator', '=', requester ?? '')
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterFollowing'),
          this.db.db
            .selectFrom('follow')
            .whereRef('creator', '=', ref('did_handle.did'))
            .where('subjectDid', '=', requester ?? '')
            .select('uri')
            .as('requesterFollowedBy'),
          this.db.db
            .selectFrom('actor_block')
            .where('creator', '=', requester ?? '')
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterBlocking'),
          this.db.db
            .selectFrom('actor_block')
            .whereRef('creator', '=', ref('did_handle.did'))
            .where('subjectDid', '=', requester ?? '')
            .select('uri')
            .as('requesterBlockedBy'),
          this.db.db
            .selectFrom('mute')
            .whereRef('did', '=', ref('did_handle.did'))
            .where('mutedByDid', '=', requester ?? '')
            .select('did')
            .as('requesterMuted'),
          this.db.db
            .selectFrom('list_item')
            .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
            .where('list_mute.mutedByDid', '=', requester ?? '')
            .whereRef('list_item.subjectDid', '=', ref('did_handle.did'))
            .select('list_item.listUri')
            .limit(1)
            .as('requesterMutedByList'),
        ])
        .execute(),
      this.services.label.getLabelsForSubjects(skipLabels ? [] : dids),
    ])
    const listUris: string[] = actors
      .map((a) => a.requesterMutedByList)
      .filter((list) => !!list)
    const listViews = await this.services.graph.getListViews(
      listUris,
      requester,
    )
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
            muted: !!cur?.requesterMuted || !!cur?.requesterMutedByList,
            mutedByList: cur.requesterMutedByList
              ? this.services.graph.formatListViewBasic(
                  listViews[cur.requesterMutedByList],
                )
              : undefined,
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
    requester: string | null,
    options?: Pick<FeedHydrationOptions, 'includeSoftDeleted'>,
  ): Promise<PostInfoMap> {
    if (postUris.length < 1) return {}
    const db = this.db.db
    const { ref } = db.dynamic
    let postsQb = db
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

    if (!options?.includeSoftDeleted) {
      postsQb = postsQb
        .where(notSoftDeletedClause(ref('repo_root'))) // Ensures post reply parent/roots get omitted from views when taken down
        .where(notSoftDeletedClause(ref('record')))
    }

    const posts = await postsQb
      .select([
        'post.uri as uri',
        'post.cid as cid',
        'post.creator as creator',
        'post.indexedAt as indexedAt',
        'ipld_block.content as recordBytes',
        'post_agg.likeCount as likeCount',
        'post_agg.repostCount as repostCount',
        'post_agg.replyCount as replyCount',
        'record.takedownId as takedownId',
        db
          .selectFrom('repost')
          .where('creator', '=', requester ?? '')
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterRepost'),
        db
          .selectFrom('like')
          .where('creator', '=', requester ?? '')
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterLike'),
      ])
      .execute()
    return posts.reduce((acc, cur) => {
      const { recordBytes, ...post } = cur
      return Object.assign(acc, {
        [post.uri]: {
          ...post,
          record: cborToLexRecord(recordBytes),
        },
      })
    }, {} as PostInfoMap)
  }

  async getFeedGeneratorInfos(
    generatorUris: string[],
    requester: string | null,
  ) {
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
      blocks?: PostBlocksMap
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
    const blocks = precomputed?.blocks ?? (await this.blocksForPosts(posts))
    const embeds =
      precomputed?.embeds ??
      (await this.embedsForPosts(posts, blocks, requester))

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
    requester: string | null,
    options?: FeedHydrationOptions,
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
        includeSoftDeleted: options?.includeSoftDeleted,
      }),
      this.getPostInfos(Array.from(postUris), requester, options),
      this.services.label.getLabelsForSubjects([...postUris, ...actorDids]),
    ])
    const blocks = await this.blocksForPosts(posts)
    const embeds = await this.embedsForPosts(posts, blocks, requester)

    return this.views.formatFeed(
      items,
      actors,
      posts,
      embeds,
      labels,
      blocks,
      options,
    )
  }

  // applies blocks for visibility to third-parties (i.e. based on post content)
  async blocksForPosts(posts: PostInfoMap): Promise<PostBlocksMap> {
    const relationships: RelationshipPair[] = []
    const byPost: Record<string, PostRelationships> = {}
    const didFromUri = (uri) => new AtUri(uri).host
    for (const post of Object.values(posts)) {
      // skip posts that we can't process or appear to already have been processed
      if (!isPostRecord(post.record)) continue
      if (byPost[post.uri]) continue
      byPost[post.uri] = {}
      // 3p block for replies
      const parentUri = post.record.reply?.parent.uri
      const parentDid = parentUri ? didFromUri(parentUri) : null
      // 3p block for record embeds
      const embedUris = nestedRecordUris([post.record])
      // gather actor relationships among posts
      if (parentDid) {
        const pair: RelationshipPair = [post.creator, parentDid]
        relationships.push(pair)
        byPost[post.uri].reply = pair
      }
      for (const embedUri of embedUris) {
        const pair: RelationshipPair = [post.creator, didFromUri(embedUri)]
        relationships.push(pair)
        byPost[post.uri].embed = pair
      }
    }
    // compute block state from all actor relationships among posts
    const blockSet = await this.getBlockSet(relationships)
    if (blockSet.empty()) return {}
    const result: PostBlocksMap = {}
    Object.entries(byPost).forEach(([uri, block]) => {
      if (block.embed && blockSet.has(block.embed)) {
        result[uri] ??= {}
        result[uri].embed = true
      }
      if (block.reply && blockSet.has(block.reply)) {
        result[uri] ??= {}
        result[uri].reply = true
      }
    })
    return result
  }

  private async getBlockSet(relationships: RelationshipPair[]) {
    const { ref } = this.db.db.dynamic
    const blockSet = new RelationshipSet()
    if (!relationships.length) return blockSet
    const relationshipSet = new RelationshipSet()
    relationships.forEach((pair) => relationshipSet.add(pair))
    // compute actual block set from all actor relationships
    const blockRows = await this.db.db
      .selectFrom('actor_block')
      .select(['creator', 'subjectDid']) // index-only columns
      .where(
        sql`(${ref('creator')}, ${ref('subjectDid')})`,
        'in',
        valuesList(
          relationshipSet.listAllPairs().map(([a, b]) => sql`${a}, ${b}`),
        ),
      )
      .execute()
    blockRows.forEach((r) => blockSet.add([r.creator, r.subjectDid]))
    return blockSet
  }

  async embedsForPosts(
    postInfos: PostInfoMap,
    blocks: PostBlocksMap,
    requester: string | null,
    depth = 0,
  ) {
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
          record: applyEmbedBlock(
            uri,
            blocks,
            recordEmbedViews[post.embed.record.uri],
          ),
        }
      } else if (isEmbedRecordWithMedia(post.embed)) {
        const embedRecordView = recordEmbedViews[post.embed.record.record.uri]
        if (!embedRecordView) continue
        const formatted = this.views.getRecordWithMediaEmbedView(
          post.embed,
          applyEmbedBlock(uri, blocks, embedRecordView),
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
    requester: string | null,
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
    const deepBlocks = await this.blocksForPosts(postInfos)
    const deepEmbedViews = await this.embedsForPosts(
      postInfos,
      deepBlocks,
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
    if (isPostRecord(info.record)) {
      records[uri] = info.record
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

type PostRelationships = { reply?: RelationshipPair; embed?: RelationshipPair }

type RelationshipPair = [didA: string, didB: string]

class RelationshipSet {
  index = new Map<string, Set<string>>()
  add([didA, didB]: RelationshipPair) {
    const didAIdx = this.index.get(didA) ?? new Set()
    const didBIdx = this.index.get(didB) ?? new Set()
    if (!this.index.has(didA)) this.index.set(didA, didAIdx)
    if (!this.index.has(didB)) this.index.set(didB, didBIdx)
    didAIdx.add(didB)
    didBIdx.add(didA)
  }
  has([didA, didB]: RelationshipPair) {
    return !!this.index.get(didA)?.has(didB)
  }
  listAllPairs() {
    const pairs: RelationshipPair[] = []
    for (const [didA, didBIdx] of this.index.entries()) {
      for (const didB of didBIdx) {
        pairs.push([didA, didB])
      }
    }
    return pairs
  }
  empty() {
    return this.index.size === 0
  }
}

function applyEmbedBlock(
  uri: string,
  blocks: PostBlocksMap,
  view: RecordEmbedViewRecord,
): RecordEmbedViewRecord {
  if (isViewRecord(view) && blocks[uri]?.embed) {
    return {
      $type: 'app.bsky.embed.record#viewBlocked',
      uri: view.uri,
    }
  }
  return view
}
