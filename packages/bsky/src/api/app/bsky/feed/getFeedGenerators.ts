import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getFeedGenerators'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline'

type Skeleton = {
  feedUris: string[]
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedGenerators({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noRules,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ params }) => {
  return {
    feedUris: params.feeds,
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return await ctx.hydrator.hydrateFeedGens(skeleton.feedUris, ctx)
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const feeds = mapDefined(skeleton.feedUris, (uri) =>
    ctx.views.feedGenerator(uri, hydration),
  )
  return { feeds }
}
