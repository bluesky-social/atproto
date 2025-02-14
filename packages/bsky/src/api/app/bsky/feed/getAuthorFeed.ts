import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context'
import { Actor } from '../../../../hydration/actor'
import { FeedItem, Post } from '../../../../hydration/feed'
import { HydrationState, mergeStates } from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { FeedType } from '../../../../proto/bsky_pb'
import { safePinnedPost, uriToDid } from '../../../../util/uris'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  actor: Actor
  items: FeedItem[]
  filter: QueryParams['filter']
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocksOrMutedReposts,
      presentation,
      {
        exposeRepoRev: true,
        includeTakedowns: true,
      },
    ),
  })
}

const FILTER_TO_FEED_TYPE = {
  posts_with_replies: undefined, // default: all posts, replies, and reposts
  posts_no_replies: FeedType.POSTS_NO_REPLIES,
  posts_with_media: FeedType.POSTS_WITH_MEDIA,
  posts_and_author_threads: FeedType.POSTS_AND_AUTHOR_THREADS,
}

export const skeleton: SkeletonFn<Skeleton, QueryParams> = async (ctx) => {
  const { params } = ctx

  const [did] = await ctx.hydrator.actor.getDids([params.actor])
  if (!did) {
    throw new InvalidRequestError('Profile not found')
  }
  const actors = await ctx.hydrator.actor.getActors([did], ctx.includeTakedowns)
  const actor = actors.get(did)
  if (!actor) {
    throw new InvalidRequestError('Profile not found')
  }
  if (clearlyBadCursor(params.cursor)) {
    return { actor, filter: params.filter, items: [] }
  }

  const pinnedPost = safePinnedPost(actor.profile?.pinnedPost)
  const isFirstPageRequest = !params.cursor
  const shouldInsertPinnedPost =
    isFirstPageRequest &&
    params.includePins &&
    pinnedPost &&
    uriToDid(pinnedPost.uri) === actor.did

  const res = await ctx.dataplane.getAuthorFeed({
    actorDid: did,
    limit: params.limit,
    cursor: params.cursor,
    feedType: FILTER_TO_FEED_TYPE[params.filter],
  })

  let items: FeedItem[] = res.items.map((item) => ({
    post: { uri: item.uri, cid: item.cid || undefined },
    repost: item.repost
      ? { uri: item.repost, cid: item.repostCid || undefined }
      : undefined,
  }))

  if (shouldInsertPinnedPost && pinnedPost) {
    const pinnedItem = {
      post: {
        uri: pinnedPost.uri,
        cid: pinnedPost.cid,
      },
      authorPinned: true,
    }

    items = items.filter((item) => item.post.uri !== pinnedItem.post.uri)
    items.unshift(pinnedItem)
  }

  return {
    actor,
    filter: params.filter,
    items,
    cursor: parseString(res.cursor),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  const [feedPostState, profileViewerState] = await Promise.all([
    ctx.hydrator.hydrateFeedItems(skeleton.items, ctx),
    ctx.hydrator.hydrateProfileViewers([skeleton.actor.did], ctx),
  ])
  return mergeStates(feedPostState, profileViewerState)
}

const noBlocksOrMutedReposts: RulesFn<Skeleton, QueryParams> = (
  ctx,
  skeleton,
  hydration,
) => {
  const relationship = hydration.profileViewers?.get(skeleton.actor.did)
  if (relationship?.blocking || relationship?.blockingByList) {
    throw new InvalidRequestError(
      `Requester has blocked actor: ${skeleton.actor.did}`,
      'BlockedActor',
    )
  }
  if (relationship?.blockedBy || relationship?.blockedByList) {
    throw new InvalidRequestError(
      `Requester is blocked by actor: ${skeleton.actor.did}`,
      'BlockedByActor',
    )
  }

  const checkBlocksAndMutes = (item: FeedItem) => {
    const bam = ctx.views.feedItemBlocksAndMutes(item, hydration)
    return (
      !bam.authorBlocked &&
      !bam.originatorBlocked &&
      (!bam.authorMuted || bam.originatorMuted) // repost of muted content
    )
  }

  if (skeleton.filter === 'posts_and_author_threads') {
    // ensure replies are only included if the feed contains all
    // replies up to the thread root (i.e. a complete self-thread.)
    const selfThread = new SelfThreadTracker(skeleton.items, hydration)
    skeleton.items = skeleton.items.filter((item) => {
      return (
        checkBlocksAndMutes(item) &&
        (item.repost || item.authorPinned || selfThread.ok(item.post.uri))
      )
    })
  } else {
    skeleton.items = skeleton.items.filter(checkBlocksAndMutes)
  }

  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const feed = mapDefined(skeleton.items, (item) =>
    ctx.views.feedViewPost(item, hydration),
  )
  return { body: { feed, cursor: skeleton.cursor } }
}

class SelfThreadTracker {
  feedUris = new Set<string>()
  cache = new Map<string, boolean>()

  constructor(
    items: FeedItem[],
    private hydration: HydrationState,
  ) {
    items.forEach((item) => {
      if (!item.repost) {
        this.feedUris.add(item.post.uri)
      }
    })
  }

  ok(uri: string, loop = new Set<string>()) {
    // if we've already checked this uri, pull from the cache
    if (this.cache.has(uri)) {
      return this.cache.get(uri) ?? false
    }
    // loop detection
    if (loop.has(uri)) {
      this.cache.set(uri, false)
      return false
    } else {
      loop.add(uri)
    }
    // cache through the result
    const result = this._ok(uri, loop)
    this.cache.set(uri, result)
    return result
  }

  private _ok(uri: string, loop: Set<string>): boolean {
    // must be in the feed to be in a self-thread
    if (!this.feedUris.has(uri)) {
      return false
    }
    // must be hydratable to be part of self-thread
    const post = this.hydration.posts?.get(uri)
    if (!post) {
      return false
    }
    // root posts (no parent) are trivial case of self-thread
    const parentUri = getParentUri(post)
    if (parentUri === null) {
      return true
    }
    // recurse w/ cache: this post is in a self-thread if its parent is.
    return this.ok(parentUri, loop)
  }
}

function getParentUri(post: Post) {
  return post.record.reply?.parent.uri ?? null
}
