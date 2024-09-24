import { AtpAgent } from '@atproto/api'
import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context.js'
import { DataPlaneClient } from '../../../../data-plane/index.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { parseString } from '../../../../hydration/util.js'
import { Server } from '../../../../lexicon/index.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/searchPosts.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
} from '../../../../pipeline.js'
import { uriToDid as creatorFromUri } from '../../../../util/uris.js'
import { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const searchPosts = ctx.createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.feed.searchPosts({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const results = await searchPosts(hydrateCtx, params)
      return {
        encoding: 'application/json',
        body: results,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs

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
        viewer: ctx.hydrateCtx.viewer ?? undefined,
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

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton } = inputs
  return ctx.hydrator.hydratePosts(
    skeleton.posts.map((uri) => ({ uri })),
    ctx.hydrateCtx,
  )
}

const noBlocks = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.posts = skeleton.posts.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  const posts = mapDefined(skeleton.posts, (uri) =>
    ctx.views.post(uri, hydration),
  )
  return {
    posts,
    cursor: skeleton.cursor,
    hitsTotal: skeleton.hitsTotal,
  }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
  searchAgent?: AtpAgent
  hydrateCtx: HydrateCtx
}

type Params = QueryParams

type Skeleton = {
  posts: string[]
  hitsTotal?: number
  cursor?: string
}
