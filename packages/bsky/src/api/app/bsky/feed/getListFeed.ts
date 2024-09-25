import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context.js'
import { FeedItem } from '../../../../hydration/feed.js'
import { mergeStates } from '../../../../hydration/hydrator.js'
import { parseString } from '../../../../hydration/util.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getListFeed.js'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { uriToDid } from '../../../../util/uris.js'
import { clearlyBadCursor } from '../../../util.js'

type Skeleton = {
  items: FeedItem[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  const getListFeed = ctx.createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
    { exposeRepoRev: true },
  )
  server.app.bsky.feed.getListFeed({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      return getListFeed({ labelers, viewer }, params)
    },
  })
}

export const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({
  ctx,
  params,
}) => {
  if (clearlyBadCursor(params.cursor)) {
    return { items: [] }
  }
  const res = await ctx.dataplane.getListFeed({
    listUri: params.list,
    limit: params.limit,
    cursor: params.cursor,
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

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  params,
  skeleton,
}) => {
  const [feedItemsState, bidirectionalBlocks] = await Promise.all([
    ctx.hydrator.hydrateFeedItems(skeleton.items, ctx.hydrateCtx),
    ctx.hydrator.hydrateBidirectionalBlocks([
      [
        uriToDid(params.list),
        skeleton.items.map((item) => uriToDid(item.post.uri)),
      ],
    ]),
  ])

  return mergeStates(feedItemsState, {
    bidirectionalBlocks,
  })
}

const noBlocksOrMutes: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  params,
  skeleton,
  hydration,
}) => {
  skeleton.items = skeleton.items.filter((item) => {
    const bam = ctx.views.feedItemBlocksAndMutes(item, hydration)
    const creatorBlocks = hydration.bidirectionalBlocks?.get(
      uriToDid(params.list),
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

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  return {
    feed: mapDefined(skeleton.items, (item) =>
      ctx.views.feedViewPost(item, hydration),
    ),
    cursor: skeleton.cursor,
  }
}
