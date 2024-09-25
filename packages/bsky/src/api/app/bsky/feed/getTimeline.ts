import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
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
  const getTimeline = ctx.createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
    { exposeRepoRev: true },
  )

  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      return getTimeline({ labelers, viewer }, params)
    },
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  if (clearlyBadCursor(params.cursor)) {
    return { items: [] }
  }

  const actorDid = ctx.hydrateCtx.viewer
  if (!actorDid) throw new InvalidRequestError('An actor is required')

  const res = await ctx.dataplane.getTimeline({
    actorDid,
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
  return ctx.hydrator.hydrateFeedItems(skeleton.items, ctx.hydrateCtx)
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
  return { feed, cursor: skeleton.cursor }
}
