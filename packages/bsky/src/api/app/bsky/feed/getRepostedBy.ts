import { mapDefined } from '@atproto/common'
import AppContext from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getRepostedBy'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { uriToDid as creatorFromUri } from '../../../../util/uris'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  reposts: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getRepostedBy({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocks,
      presentation,
      { enforceIncludeTakedowns: true },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  if (clearlyBadCursor(params.cursor)) {
    return { reposts: [] }
  }
  const res = await ctx.hydrator.dataplane.getRepostsBySubject({
    subject: { uri: params.uri, cid: params.cid },
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    reposts: res.uris,
    cursor: parseString(res.cursor),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return await ctx.hydrator.hydrateReposts(skeleton.reposts, ctx.hydrateCtx)
}

const noBlocks: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  skeleton.reposts = skeleton.reposts.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
  params,
}) => {
  const repostViews = mapDefined(skeleton.reposts, (uri) => {
    const repost = hydration.reposts?.get(uri)
    if (!repost?.record) {
      return
    }
    const creatorDid = creatorFromUri(uri)
    return ctx.views.profile(creatorDid, hydration)
  })
  return {
    repostedBy: repostViews,
    cursor: skeleton.cursor,
    uri: params.uri,
    cid: params.cid,
  }
}
