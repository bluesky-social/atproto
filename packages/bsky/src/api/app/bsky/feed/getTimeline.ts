import { mapDefined } from '@atproto/common'
import { StandardOutput } from '../../../../auth-verifier'
import AppContext from '../../../../context'
import { FeedItem } from '../../../../hydration/feed'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  items: FeedItem[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier.standard,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocksOrMutes,
      presentation,
      { exposeRepoRev: true },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams, StandardOutput> = async ({
  ctx,
  params,
}) => {
  if (clearlyBadCursor(params.cursor)) {
    return { items: [] }
  }

  const res = await ctx.dataplane.getTimeline({
    actorDid: ctx.viewer,
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
  skeleton,
}) => {
  return ctx.hydrator.hydrateFeedItems(skeleton.items, ctx)
}

const noBlocksOrMutes: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  skeleton.items = skeleton.items.filter((item) => {
    const bam = ctx.views.feedItemBlocksAndMutes(item, hydration)
    return (
      !bam.authorBlocked &&
      !bam.authorMuted &&
      !bam.originatorBlocked &&
      !bam.originatorMuted &&
      !bam.ancestorAuthorBlocked
    )
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
  return { body: { feed, cursor: skeleton.cursor } }
}
