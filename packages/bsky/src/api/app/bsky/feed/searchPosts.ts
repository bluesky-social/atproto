import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/searchPosts'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { uriToDid as creatorFromUri } from '../../../../util/uris'

type Skeleton = {
  posts: string[]
  hitsTotal?: number
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.searchPosts({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocks,
      presentation,
    ),
  })
}
const skeleton: SkeletonFn<Skeleton, QueryParams> = async (ctx) => {
  const { params } = ctx

  if (ctx.searchAgent) {
    // @NOTE cursors won't change on appview swap
    const { data: res } =
      await ctx.searchAgent.api.app.bsky.unspecced.searchPostsSkeleton({
        q: params.q,
        cursor: params.cursor,
        limit: params.limit,
        author: params.author,
        domain: params.domain,
        lang: params.lang,
        mentions: params.mentions,
        since: params.since,
        sort: params.sort,
        tag: params.tag,
        until: params.until,
        url: params.url,
        viewer: ctx.viewer ?? undefined,
      })
    return {
      posts: res.posts.map(({ uri }) => uri),
      cursor: parseString(res.cursor),
    }
  }

  const res = await ctx.dataplane.searchPosts({
    term: params.q,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    posts: res.uris,
    cursor: parseString(res.cursor),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  return ctx.hydrator.hydratePosts(
    skeleton.posts.map((uri) => ({ uri })),
    ctx,
  )
}

const noBlocks: RulesFn<Skeleton, QueryParams> = (ctx, skeleton, hydration) => {
  skeleton.posts = skeleton.posts.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const posts = mapDefined(skeleton.posts, (uri) =>
    ctx.views.post(uri, hydration),
  )
  return {
    body: {
      posts,
      cursor: skeleton.cursor,
      hitsTotal: skeleton.hitsTotal,
    },
  }
}
