import { dedupeStrs, mapDefined } from '@atproto/common'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import { ids } from '../../../../lexicon/lexicons'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getPosts'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { uriToDid as creatorFromUri } from '../../../../util/uris'

type Skeleton = {
  posts: string[]
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPosts({
    auth: ctx.authVerifier.standardOptionalParameterized({
      lxmCheck: (method) => {
        if (!method) return false
        return (
          method === ids.AppBskyFeedGetPosts || method.startsWith('chat.bsky.')
        )
      },
    }),
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocks,
      presentation,
    ),
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
    ctx,
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
