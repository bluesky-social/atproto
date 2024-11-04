import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context'
import { FeedItem } from '../../../../hydration/feed'
import { mergeStates } from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getListFeed'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { uriToDid } from '../../../../util/uris'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  items: FeedItem[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getListFeed({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocksOrMutes,
      presentation,
      {
        exposeRepoRev: true,
      },
    ),
  })
}

export const skeleton: SkeletonFn<Skeleton, QueryParams> = async (ctx) => {
  if (clearlyBadCursor(ctx.params.cursor)) {
    return { items: [] }
  }
  const res = await ctx.dataplane.getListFeed({
    listUri: ctx.params.list,
    limit: ctx.params.limit,
    cursor: ctx.params.cursor,
  })
  return {
    items: res.items.map((item) => ({
      post: { uri: item.uri, cid: item.cid || undefined },
      repost: item.repost
        ? { uri: item.repost, cid: item.repostCid || undefined }
        : undefined,
    })),
    cursor: parseString(res.cursor),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  const [feedItemsState, bidirectionalBlocks] = await Promise.all([
    ctx.hydrator.hydrateFeedItems(skeleton.items, ctx),
    ctx.hydrator.hydrateBidirectionalBlocks([
      [
        uriToDid(ctx.params.list),
        skeleton.items.map((item) => uriToDid(item.post.uri)),
      ],
    ]),
  ])

  return mergeStates(feedItemsState, {
    bidirectionalBlocks,
  })
}

const noBlocksOrMutes: RulesFn<Skeleton, QueryParams> = (
  ctx,
  skeleton,
  hydration,
) => {
  skeleton.items = skeleton.items.filter((item) => {
    const bam = ctx.views.feedItemBlocksAndMutes(item, hydration)
    const creatorBlocks = hydration.bidirectionalBlocks?.get(
      uriToDid(ctx.params.list),
    )
    return (
      !bam.authorBlocked &&
      !bam.authorMuted &&
      !bam.originatorBlocked &&
      !bam.originatorMuted &&
      !bam.ancestorAuthorBlocked &&
      !creatorBlocks?.get(uriToDid(item.post.uri))
    )
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  return {
    body: {
      feed: mapDefined(skeleton.items, (item) =>
        ctx.views.feedViewPost(item, hydration),
      ),
      cursor: skeleton.cursor,
    },
  }
}
