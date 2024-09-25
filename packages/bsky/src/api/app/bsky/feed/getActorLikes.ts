import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { FeedItem } from '../../../../hydration/feed.js'
import { parseString } from '../../../../hydration/util.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getActorLikes.js'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { uriToDid as creatorFromUri } from '../../../../util/uris.js'
import { clearlyBadCursor } from '../../../util.js'

type Skeleton = {
  items: FeedItem[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getActorLikes({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noPostBlocks,
      presentation,
      { exposeRepoRev: true },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({
  ctx,
  params: { actor, limit, cursor },
}) => {
  const viewer = ctx.hydrateCtx.viewer
  if (clearlyBadCursor(cursor)) {
    return { items: [] }
  }
  const [actorDid] = await ctx.hydrator.actor.getDids([actor])
  if (!actorDid || !viewer || viewer !== actorDid) {
    throw new InvalidRequestError('Profile not found')
  }

  const likesRes = await ctx.dataplane.getActorLikes({
    actorDid,
    limit,
    cursor,
  })

  const items = likesRes.likes.map((l) => ({ post: { uri: l.subject } }))

  return {
    items,
    cursor: parseString(likesRes.cursor),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateFeedItems(skeleton.items, ctx.hydrateCtx)
}

const noPostBlocks: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  skeleton.items = skeleton.items.filter((item) => {
    const creator = creatorFromUri(item.post.uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const feed = mapDefined(skeleton.items, (item) =>
    ctx.views.feedViewPost(item, hydration),
  )
  return {
    feed,
    cursor: skeleton.cursor,
  }
}
