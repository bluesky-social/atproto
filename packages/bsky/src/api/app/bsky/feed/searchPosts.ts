import { AtpAgent } from '@atproto/api'
import { mapDefined } from '@atproto/common'
import { ServerConfig } from '../../../../config'
import { AppContext } from '../../../../context'
import { DataPlaneClient } from '../../../../data-plane'
import {
  PostSearchQuery,
  parsePostSearchQuery,
} from '../../../../data-plane/server/util'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/searchPosts'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { uriToDid as creatorFromUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const searchPosts = createPipeline(
    skeleton,
    hydration,
    noBlocksOrTagged,
    presentation,
  )
  server.app.bsky.feed.searchPosts({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const { viewer, isModService } = ctx.authVerifier.parseCreds(auth)

      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const results = await searchPosts(
        { ...params, hydrateCtx, isModService },
        ctx,
      )
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
  const parsedQuery = parsePostSearchQuery(params.q, {
    author: params.author,
  })

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
        viewer: params.hydrateCtx.viewer ?? undefined,
      })
    return {
      posts: res.posts.map(({ uri }) => uri),
      cursor: parseString(res.cursor),
      parsedQuery,
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
    parsedQuery,
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydratePosts(
    skeleton.posts.map((uri) => ({ uri })),
    params.hydrateCtx,
  )
}

const noBlocksOrTagged = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, params, skeleton, hydration } = inputs
  skeleton.posts = skeleton.posts.filter((uri) => {
    const post = hydration.posts?.get(uri)
    if (!post) return

    const creator = creatorFromUri(uri)

    if (ctx.views.viewerBlockExists(creator, hydration)) {
      return false
    }

    const { author } = skeleton.parsedQuery
    const isCuratedSearch = params.sort === 'top'
    const isPostByViewer = creator === params.hydrateCtx.viewer
    if (
      !isPostByViewer &&
      !params.isModService &&
      (isCuratedSearch || !author) &&
      [...ctx.cfg.searchTagsHide].some((t) => post.tags.has(t))
    ) {
      return false
    }

    return true
  })
  return skeleton
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  const posts = mapDefined(skeleton.posts, (uri) => {
    const post = hydration.posts?.get(uri)
    if (!post) return

    return ctx.views.post(uri, hydration)
  })
  return {
    posts,
    cursor: skeleton.cursor,
    hitsTotal: skeleton.hitsTotal,
  }
}

type Context = {
  cfg: ServerConfig
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
  searchAgent?: AtpAgent
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
  isModService: boolean
}

type Skeleton = {
  posts: string[]
  hitsTotal?: number
  cursor?: string
  parsedQuery: PostSearchQuery
}
