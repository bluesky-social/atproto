import { sql } from 'kysely'
import { AtUri } from '@atproto/syntax'
import { jsonStringToLex } from '@atproto/lexicon'
import { Database } from '../../db'
import { countAll, noMatch, notSoftDeletedClause } from '../../db/util'
import { ImageUriBuilder } from '../../image/uri'
import { ids } from '../../lexicon/lexicons'
import {
  Record as PostRecord,
  isRecord as isPostRecord,
} from '../../lexicon/types/app/bsky/feed/post'
import {
  Record as ThreadgateRecord,
  isListRule,
} from '../../lexicon/types/app/bsky/feed/threadgate'
import { isMain as isEmbedImages } from '../../lexicon/types/app/bsky/embed/images'
import { isMain as isEmbedExternal } from '../../lexicon/types/app/bsky/embed/external'
import {
  isMain as isEmbedRecord,
  isViewRecord,
} from '../../lexicon/types/app/bsky/embed/record'
import { isMain as isEmbedRecordWithMedia } from '../../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  PostInfoMap,
  FeedItemType,
  FeedRow,
  FeedGenInfoMap,
  PostEmbedViews,
  RecordEmbedViewRecordMap,
  PostInfo,
  RecordEmbedViewRecord,
  PostBlocksMap,
  FeedHydrationState,
  ThreadgateInfoMap,
} from './types'
import { LabelService } from '../label'
import { ActorService } from '../actor'
import {
  BlockAndMuteState,
  GraphService,
  ListInfoMap,
  RelationshipPair,
} from '../graph'
import { FeedViews } from './views'
import { LabelCache } from '../../label-cache'
import { threadgateToPostUri, postToThreadgateUri } from './util'

export * from './types'

export class FeedService {
  constructor(
    public db: Database,
    public imgUriBuilder: ImageUriBuilder,
    public labelCache: LabelCache,
  ) {}

  views = new FeedViews(this.db, this.imgUriBuilder, this.labelCache)

  services = {
    label: LabelService.creator(this.labelCache)(this.db),
    actor: ActorService.creator(this.imgUriBuilder, this.labelCache)(this.db),
    graph: GraphService.creator(this.imgUriBuilder)(this.db),
  }

  static creator(imgUriBuilder: ImageUriBuilder, labelCache: LabelCache) {
    return (db: Database) => new FeedService(db, imgUriBuilder, labelCache)
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
        'post.sortAt as sortAt',
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

  selectFeedGeneratorQb(viewer?: string | null) {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('feed_generator')
      .innerJoin('actor', 'actor.did', 'feed_generator.creator')
      .innerJoin('record', 'record.uri', 'feed_generator.uri')
      .selectAll('feed_generator')
      .where(notSoftDeletedClause(ref('actor')))
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
          .if(!viewer, (q) => q.where(noMatch))
          .where('like.creator', '=', viewer ?? '')
          .whereRef('like.subject', '=', 'feed_generator.uri')
          .select('uri')
          .as('viewerLike'),
      )
  }

  async getPostInfos(
    postUris: string[],
    viewer: string | null,
  ): Promise<PostInfoMap> {
    if (postUris.length < 1) return {}
    const db = this.db.db
    const { ref } = db.dynamic
    const posts = await db
      .selectFrom('post')
      .where('post.uri', 'in', postUris)
      .innerJoin('actor', 'actor.did', 'post.creator')
      .innerJoin('record', 'record.uri', 'post.uri')
      .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('actor'))) // Ensures post reply parent/roots get omitted from views when taken down
      .where(notSoftDeletedClause(ref('record')))
      .select([
        'post.uri as uri',
        'post.cid as cid',
        'post.creator as creator',
        'post.sortAt as indexedAt',
        'post.invalidReplyRoot as invalidReplyRoot',
        'post.violatesThreadGate as violatesThreadGate',
        'record.json as recordJson',
        'post_agg.likeCount as likeCount',
        'post_agg.repostCount as repostCount',
        'post_agg.replyCount as replyCount',
        'post.tags as tags',
        db
          .selectFrom('repost')
          .if(!viewer, (q) => q.where(noMatch))
          .where('creator', '=', viewer ?? '')
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterRepost'),
        db
          .selectFrom('like')
          .if(!viewer, (q) => q.where(noMatch))
          .where('creator', '=', viewer ?? '')
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterLike'),
      ])
      .execute()
    return posts.reduce((acc, cur) => {
      const { recordJson, ...post } = cur
      const record = jsonStringToLex(recordJson) as PostRecord
      const info: PostInfo = {
        ...post,
        invalidReplyRoot: post.invalidReplyRoot ?? false,
        violatesThreadGate: post.violatesThreadGate ?? false,
        record,
        viewer,
      }
      return Object.assign(acc, { [post.uri]: info })
    }, {} as PostInfoMap)
  }

  async getFeedGeneratorInfos(generatorUris: string[], viewer: string | null) {
    if (generatorUris.length < 1) return {}
    const feedGens = await this.selectFeedGeneratorQb(viewer)
      .where('feed_generator.uri', 'in', generatorUris)
      .execute()
    return feedGens.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.uri]: {
          ...cur,
          viewer: viewer ? { like: cur.viewerLike } : undefined,
        },
      }),
      {} as FeedGenInfoMap,
    )
  }

  async getFeedItems(uris: string[]): Promise<Record<string, FeedRow>> {
    if (uris.length < 1) return {}
    const feedItems = await this.selectFeedItemQb()
      .where('feed_item.uri', 'in', uris)
      .execute()
    return feedItems.reduce((acc, item) => {
      return Object.assign(acc, { [item.uri]: item })
    }, {} as Record<string, FeedRow>)
  }

  feedItemRefs(items: FeedRow[]) {
    const actorDids = new Set<string>()
    const postUris = new Set<string>()
    for (const item of items) {
      postUris.add(item.postUri)
      actorDids.add(item.postAuthorDid)
      actorDids.add(item.originatorDid)
      if (item.replyParent) {
        postUris.add(item.replyParent)
        actorDids.add(new AtUri(item.replyParent).hostname)
      }
      if (item.replyRoot) {
        postUris.add(item.replyRoot)
        actorDids.add(new AtUri(item.replyRoot).hostname)
      }
    }
    return { dids: actorDids, uris: postUris }
  }

  async feedHydration(
    refs: {
      dids: Set<string>
      uris: Set<string>
      viewer: string | null
    },
    depth = 0,
  ): Promise<FeedHydrationState> {
    const { viewer, dids, uris } = refs
    const [posts, threadgates, labels, bam] = await Promise.all([
      this.getPostInfos(Array.from(uris), viewer),
      this.threadgatesByPostUri(Array.from(uris)),
      this.services.label.getLabelsForSubjects([...uris, ...dids]),
      this.services.graph.getBlockAndMuteState(
        viewer ? [...dids].map((did) => [viewer, did]) : [],
      ),
    ])

    // profileState for labels and bam handled above, profileHydration() shouldn't fetch additional
    const [profileState, blocks, lists] = await Promise.all([
      this.services.actor.views.profileHydration(
        Array.from(dids),
        { viewer },
        { bam, labels },
      ),
      this.blocksForPosts(posts, bam),
      this.listsForThreadgates(threadgates, viewer),
    ])
    const embeds = await this.embedsForPosts(posts, blocks, viewer, depth)
    return {
      posts,
      threadgates,
      blocks,
      embeds,
      labels, // includes info for profiles
      bam, // includes info for profiles
      profiles: profileState.profiles,
      lists: Object.assign(lists, profileState.lists),
    }
  }

  // applies blocks for visibility to third-parties (i.e. based on post content)
  async blocksForPosts(
    posts: PostInfoMap,
    bam?: BlockAndMuteState,
  ): Promise<PostBlocksMap> {
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
    const blockState = await this.services.graph.getBlockState(
      relationships,
      bam,
    )
    const result: PostBlocksMap = {}
    Object.entries(byPost).forEach(([uri, block]) => {
      if (block.embed && blockState.block(block.embed)) {
        result[uri] ??= {}
        result[uri].embed = true
      }
      if (block.reply && blockState.block(block.reply)) {
        result[uri] ??= {}
        result[uri].reply = true
      }
    })
    return result
  }

  async embedsForPosts(
    postInfos: PostInfoMap,
    blocks: PostBlocksMap,
    viewer: string | null,
    depth: number,
  ) {
    const postMap = postRecordsFromInfos(postInfos)
    const posts = Object.values(postMap)
    if (posts.length < 1) {
      return {}
    }
    const recordEmbedViews =
      depth > 1 ? {} : await this.nestedRecordViews(posts, viewer, depth)

    const postEmbedViews: PostEmbedViews = {}
    for (const [uri, post] of Object.entries(postMap)) {
      const creator = new AtUri(uri).hostname
      if (!post.embed) continue
      if (isEmbedImages(post.embed)) {
        postEmbedViews[uri] = this.views.imagesEmbedView(creator, post.embed)
      } else if (isEmbedExternal(post.embed)) {
        postEmbedViews[uri] = this.views.externalEmbedView(creator, post.embed)
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
          creator,
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
    viewer: string | null,
    depth: number,
  ): Promise<RecordEmbedViewRecordMap> {
    const nestedUris = nestedRecordUris(posts)
    if (nestedUris.length < 1) return {}
    const nestedDids = new Set<string>()
    const nestedPostUris = new Set<string>()
    const nestedFeedGenUris = new Set<string>()
    const nestedListUris = new Set<string>()
    for (const uri of nestedUris) {
      const parsed = new AtUri(uri)
      nestedDids.add(parsed.hostname)
      if (parsed.collection === ids.AppBskyFeedPost) {
        nestedPostUris.add(uri)
      } else if (parsed.collection === ids.AppBskyFeedGenerator) {
        nestedFeedGenUris.add(uri)
      } else if (parsed.collection === ids.AppBskyGraphList) {
        nestedListUris.add(uri)
      }
    }
    const [feedState, feedGenInfos, listViews] = await Promise.all([
      this.feedHydration(
        {
          dids: nestedDids,
          uris: nestedPostUris,
          viewer,
        },
        depth + 1,
      ),
      this.getFeedGeneratorInfos([...nestedFeedGenUris], viewer),
      this.services.graph.getListViews([...nestedListUris], viewer),
    ])
    const actorInfos = this.services.actor.views.profileBasicPresentation(
      [...nestedDids],
      feedState,
      { viewer },
    )
    const recordEmbedViews: RecordEmbedViewRecordMap = {}
    for (const uri of nestedUris) {
      const collection = new AtUri(uri).collection
      if (collection === ids.AppBskyFeedGenerator && feedGenInfos[uri]) {
        recordEmbedViews[uri] = {
          $type: 'app.bsky.feed.defs#generatorView',
          ...this.views.formatFeedGeneratorView(feedGenInfos[uri], actorInfos),
        }
      } else if (collection === ids.AppBskyGraphList && listViews[uri]) {
        recordEmbedViews[uri] = {
          $type: 'app.bsky.graph.defs#listView',
          ...this.services.graph.formatListView(listViews[uri], actorInfos),
        }
      } else if (collection === ids.AppBskyFeedPost && feedState.posts[uri]) {
        const formatted = this.views.formatPostView(
          uri,
          actorInfos,
          feedState.posts,
          feedState.threadgates,
          feedState.embeds,
          feedState.labels,
          feedState.lists,
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
          notFound: true,
        }
      }
    }
    return recordEmbedViews
  }

  async threadgatesByPostUri(postUris: string[]): Promise<ThreadgateInfoMap> {
    const gates = postUris.length
      ? await this.db.db
          .selectFrom('record')
          .where('uri', 'in', postUris.map(postToThreadgateUri))
          .select(['uri', 'cid', 'json'])
          .execute()
      : []
    const gatesByPostUri = gates.reduce((acc, gate) => {
      const record = jsonStringToLex(gate.json) as ThreadgateRecord
      const postUri = threadgateToPostUri(gate.uri)
      if (record.post !== postUri) return acc // invalid, skip
      acc[postUri] = { uri: gate.uri, cid: gate.cid, record }
      return acc
    }, {} as ThreadgateInfoMap)
    return gatesByPostUri
  }

  listsForThreadgates(
    threadgates: ThreadgateInfoMap,
    viewer: string | null,
  ): Promise<ListInfoMap> {
    const listsUris = new Set<string>()
    Object.values(threadgates).forEach((gate) => {
      gate?.record.allow?.forEach((rule) => {
        if (isListRule(rule)) {
          listsUris.add(rule.list)
        }
      })
    })
    return this.services.graph.getListViews([...listsUris], viewer)
  }
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

function applyEmbedBlock(
  uri: string,
  blocks: PostBlocksMap,
  view: RecordEmbedViewRecord,
): RecordEmbedViewRecord {
  if (isViewRecord(view) && blocks[uri]?.embed) {
    return {
      $type: 'app.bsky.embed.record#viewBlocked',
      uri: view.uri,
      blocked: true,
      author: {
        did: view.author.did,
        viewer: view.author.viewer
          ? {
              blockedBy: view.author.viewer?.blockedBy,
              blocking: view.author.viewer?.blocking,
            }
          : undefined,
      },
    }
  }
  return view
}
