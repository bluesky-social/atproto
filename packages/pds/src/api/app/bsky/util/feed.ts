import * as common from '@atproto/common'
import { TimeCidKeyset } from '../../../../db/pagination'
import { Main as FeedViewPost } from '../../../../lexicon/types/app/bsky/feed/feedViewPost'
import { View as PostView } from '../../../../lexicon/types/app/bsky/feed/post'
import { ImageUriBuilder } from '../../../../image/uri'
import Database from '../../../../db'
import { embedsForPosts, FeedEmbeds } from './embeds'
import { Kysely } from 'kysely'
import DatabaseSchema from '../../../../db/database-schema'
import { countAll } from '../../../../db/util'

export type FeedRow = {
  type: FeedItemType
  postUri: string
  postCid: string
  originatorDid: string
  authorDid: string
  replyParent: string | null
  replyRoot: string | null
  cursor: string
}

// Present post and repost results into FeedViewPosts
// Including links to embedded media
export const composeFeed = async (
  db: Database,
  imgUriBuilder: ImageUriBuilder,
  rows: FeedRow[],
  requester: string,
): Promise<FeedViewPost[]> => {
  const actorDids = new Set<string>()
  const postUris = new Set<string>()
  for (const row of rows) {
    actorDids.add(row.originatorDid)
    actorDids.add(row.authorDid)
    postUris.add(row.postUri)
    if (row.replyParent) postUris.add(row.replyParent)
    if (row.replyRoot) postUris.add(row.replyRoot)
  }
  const [actors, posts, embeds] = await Promise.all([
    getActorViews(db.db, imgUriBuilder, Array.from(actorDids)),
    getPostViews(db.db, Array.from(postUris), requester),
    embedsForPosts(db.db, imgUriBuilder, Array.from(postUris)),
  ])

  const feed: FeedViewPost[] = []
  for (const row of rows) {
    const post = formatPostView(row.postUri, actors, posts, embeds)
    const originator = actors[row.originatorDid]
    if (post && originator) {
      let reasonType: string | undefined
      if (row.type === 'trend') {
        reasonType = 'app.bsky.feed.feedViewPost#reasonTrend'
      } else if (row.type === 'repost') {
        reasonType = 'app.bsky.feed.feedViewPost#reasonRepost'
      }
      feed.push({
        post,
        reason: reasonType
          ? {
              $type: reasonType,
              by: actors[row.originatorDid],
              indexedAt: 'blah', //@TODO fix
            }
          : undefined,
        reply:
          row.replyRoot && row.replyParent
            ? {
                root: formatPostView(row.replyRoot, actors, posts, embeds),
                parent: formatPostView(row.replyParent, actors, posts, embeds),
              }
            : undefined,
      })
    }
  }
  return feed
}

const formatPostView = (
  uri: string,
  actors: ActorViewMap,
  posts: PostInfoMap,
  embeds: FeedEmbeds,
): PostView | null => {
  const post = posts[uri]
  if (!post) return null
  const author = actors[post.creator]
  return {
    uri: post.uri,
    cid: post.cid,
    author: author,
    record: common.ipldBytesToRecord(post.recordBytes),
    embed: embeds[uri],
    replyCount: post.replyCount,
    repostCount: post.repostCount,
    upvoteCount: post.upvoteCount,
    downvoteCount: post.downvoteCount,
    indexedAt: post.indexedAt,
    viewer: {
      repost: post.requesterRepost ?? undefined,
      upvote: post.requesterUpvote ?? undefined,
      downvote: post.requesterDownvote ?? undefined,
    },
  }
}

export type ActorView = {
  did: string
  declaration: {
    cid: string
    actorType: string
  }
  handle: string
  displayName?: string
  avatar?: string
}
export type ActorViewMap = { [did: string]: ActorView }

export const getActorViews = async (
  db: Kysely<DatabaseSchema>,
  imgUriBuilder: ImageUriBuilder,
  dids: string[],
): Promise<ActorViewMap> => {
  if (dids.length < 1) return {}
  const actors = await db
    .selectFrom('did_handle as actor')
    .where('actor.did', 'in', dids)
    .leftJoin('profile', 'profile.creator', 'actor.did')
    .select([
      'actor.did as did',
      'actor.declarationCid as declarationCid',
      'actor.actorType as actorType',
      'actor.handle as handle',
      'profile.displayName as displayName',
      'profile.avatarCid as avatarCid',
    ])
    .execute()
  return actors.reduce((acc, cur) => {
    return {
      ...acc,
      [cur.did]: {
        did: cur.did,
        declaration: {
          cid: cur.declarationCid,
          actorType: cur.actorType,
        },
        handle: cur.handle,
        displayName: cur.displayName ?? undefined,
        avatar: cur.avatarCid
          ? imgUriBuilder.getCommonSignedUri('avatar', cur.avatarCid)
          : undefined,
      },
    }
  }, {} as ActorViewMap)
}

export type PostInfo = {
  uri: string
  cid: string
  creator: string
  recordBytes: Uint8Array
  indexedAt: string
  upvoteCount: number
  downvoteCount: number
  repostCount: number
  replyCount: number
  requesterRepost: string | null
  requesterUpvote: string | null
  requesterDownvote: string | null
}

export type PostInfoMap = { [uri: string]: PostInfo }

export const getPostViews = async (
  db: Kysely<DatabaseSchema>,
  postUris: string[],
  requester: string,
): Promise<PostInfoMap> => {
  if (postUris.length < 1) return {}
  const { ref } = db.dynamic
  const posts = await db
    .selectFrom('post')
    .where('post.uri', 'in', postUris)
    .innerJoin('ipld_block', 'ipld_block.cid', 'post.cid')
    .select([
      'post.uri as uri',
      'post.cid as cid',
      'post.creator as creator',
      'ipld_block.content as recordBytes',
      'ipld_block.indexedAt as indexedAt',
      db
        .selectFrom('vote')
        .whereRef('subject', '=', ref('postUri'))
        .where('direction', '=', 'up')
        .select(countAll.as('count'))
        .as('upvoteCount'),
      db
        .selectFrom('vote')
        .whereRef('subject', '=', ref('postUri'))
        .where('direction', '=', 'down')
        .select(countAll.as('count'))
        .as('downvoteCount'),
      db
        .selectFrom('repost')
        .whereRef('subject', '=', ref('postUri'))
        .select(countAll.as('count'))
        .as('repostCount'),
      db
        .selectFrom('post')
        .whereRef('replyParent', '=', ref('postUri'))
        .select(countAll.as('count'))
        .as('replyCount'),
      db
        .selectFrom('repost')
        .where('creator', '=', requester)
        .whereRef('subject', '=', ref('postUri'))
        .select('uri')
        .as('requesterRepost'),
      db
        .selectFrom('vote')
        .where('creator', '=', requester)
        .whereRef('subject', '=', ref('postUri'))
        .where('direction', '=', 'up')
        .select('uri')
        .as('requesterUpvote'),
      db
        .selectFrom('vote')
        .where('creator', '=', requester)
        .whereRef('subject', '=', ref('postUri'))
        .where('direction', '=', 'down')
        .select('uri')
        .as('requesterDownvote'),
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

export enum FeedAlgorithm {
  ReverseChronological = 'reverse-chronological',
}

export type FeedItemType = 'post' | 'repost' | 'trend'

export class FeedKeyset extends TimeCidKeyset<FeedRow> {
  labelResult(result: FeedRow) {
    return { primary: result.cursor, secondary: result.postCid }
  }
}
