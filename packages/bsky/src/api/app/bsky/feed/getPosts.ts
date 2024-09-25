import { dedupeStrs, mapDefined } from '@atproto/common'

import AppContext from '../../../../context.js'
import { Server } from '../../../../lexicon/index.js'
import { ids } from '../../../../lexicon/lexicons.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getPosts.js'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { uriToDid as creatorFromUri } from '../../../../util/uris.js'

type Skeleton = {
  posts: string[]
}

export default function (server: Server, ctx: AppContext) {
  const getPosts = ctx.createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )

  server.app.bsky.feed.getPosts({
    auth: ctx.authVerifier.standardOptionalParameterized({
      lxmCheck: (method) => {
        if (!method) return false
        return (
          method === ids.AppBskyFeedGetPosts || method.startsWith('chat.bsky.')
        )
      },
    }),
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      return getPosts({ labelers, viewer }, params)
    },
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ params }) => {
  return { posts: dedupeStrs(params.uris) }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydratePosts(
    skeleton.posts.map((uri) => ({ uri })),
    ctx.hydrateCtx,
  )
}

const noBlocks: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  skeleton.posts = skeleton.posts.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const posts = mapDefined(skeleton.posts, (uri) =>
    ctx.views.post(uri, hydration),
  )
  return { posts }
}
