import { AtpAgent } from '@atproto/api'
import { mapDefined } from '@atproto/common'
import { ServerConfig } from '../../../../config'
import { AppContext } from '../../../../context'
import { DataPlaneClient } from '../../../../data-plane'
import {
  PostSearchQuery,
  parsePostSearchQuery,
} from '../../../../data-plane/server/util'
import { FeatureGateID } from '../../../../feature-gates'
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
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        featureGates: ctx.featureGates.checkGates(
          [ctx.featureGates.ids.SearchFilteringExplorationEnable],
          ctx.featureGates.userContext({ did: viewer }),
        ),
      })
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
    undefined,
    {
      processDynamicTagsForView: params.hydrateCtx.featureGates.get(
        FeatureGateID.SearchFilteringExplorationEnable,
      )
        ? 'search'
        : undefined,
    },
  )
}

const noBlocksOrTagged = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, params, skeleton, hydration } = inputs
  const { parsedQuery } = skeleton

  skeleton.posts = skeleton.posts.filter((uri) => {
    const post = hydration.posts?.get(uri)
    if (!post) return

    const creator = creatorFromUri(uri)
    const isCuratedSearch = params.sort === 'top'
    const isPostByViewer = creator === params.hydrateCtx.viewer

    // Cases to always show.
    if (isPostByViewer) return true
    if (params.isModService) return true

    // Cases to never show.
    if (ctx.views.viewerBlockExists(creator, hydration)) return false

    let tagged = false
    if (
      params.hydrateCtx.featureGates.get(
        FeatureGateID.SearchFilteringExplorationEnable,
      )
    ) {
      tagged = post.tags.has(ctx.cfg.visibilityTagHide)
    } else {
      tagged = [...ctx.cfg.searchTagsHide].some((t) => post.tags.has(t))
    }

    // Cases to conditionally show based on tagging.
    if (isCuratedSearch && tagged) return false
    if (!parsedQuery.author && tagged) return false
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
