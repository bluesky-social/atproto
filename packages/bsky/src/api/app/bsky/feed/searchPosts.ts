import { Timestamp } from '@bufbuild/protobuf'
import { mapDefined } from '@atproto/common'
import type { AtUriString, Client } from '@atproto/lex'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { ServerConfig } from '../../../../config.js'
import type { AppContext } from '../../../../context.js'
import {
  type DataPlaneClient,
  asInvalidRequest,
} from '../../../../data-plane/index.js'
import {
  type PostSearchQuery,
  parsePostSearchQuery,
} from '../../../../data-plane/server/util.js'
import type { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { parseString } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type RulesFnInput,
  type SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline.js'
import { SearchSortOrder } from '../../../../proto/bsky_pb.js'
import { uriToDid as creatorFromUri } from '../../../../util/uris.js'
import type { Views } from '../../../../views/index.js'
import { resHeaders, resolveSearchV2Override } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const searchPosts = createPipeline(
    skeleton,
    hydration,
    noBlocksOrTagged,
    presentation,
  )
  server.add(app.bsky.feed.searchPosts, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const { viewer, isModService, skipViewerBlocks } =
        ctx.authVerifier.parseCreds(auth)

      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        skipViewerBlocks,
        features: ctx.featureGatesClient.scope(
          ctx.featureGatesClient.parseUserContextFromHandler({
            viewer,
            req,
          }),
        ),
      })
      const results = await searchPosts(
        {
          ...params,
          hydrateCtx,
          isModService,
          isV2Override: resolveSearchV2Override(req, ctx.cfg),
        },
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

const skeletonV1 = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const parsedQuery = parsePostSearchQuery(params.q, {
    author: params.author,
  })

  if (ctx.searchClient) {
    // @NOTE cursors won't change on appview swap
    const res = await ctx.searchClient.call(
      app.bsky.unspecced.searchPostsSkeleton,
      {
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
      },
    )
    return {
      posts: res.posts.map(({ uri }) => uri as AtUriString),
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
    posts: res.uris as AtUriString[],
    cursor: parseString(res.cursor),
    parsedQuery,
  }
}

const skeletonV2 = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const parsedQuery = parsePostSearchQuery(params.q, {
    author: params.author,
  })
  // Surface dataplane InvalidArgument errors as a 400 rather than a 500.
  const res = await ctx.dataplane
    .searchPostsV2({
      allTime: true, // match v1 behavior, v2 defaults to false
      params: {
        query: params.q,
        viewer: params.hydrateCtx.viewer ?? undefined,
        limit: params.limit,
        cursor: sanitizeCursor(params.cursor),
      },
      sort: postSortToV2(params.sort),
      filters: {
        authors: params.author ? [params.author] : [],
        mentions: params.mentions ? [params.mentions] : [],
        domains: params.domain ? [params.domain] : [],
        urls: params.url ? [params.url] : [],
        hashtags: params.tag ?? [],
        languages: params.lang ? [params.lang] : [],
      },
      since: parseTimestamp(params.since),
      until: parseTimestamp(params.until),
    })
    .catch(asInvalidRequest())
  return {
    posts: res.posts.map(({ uri }) => uri as AtUriString),
    cursor: parseString(res.pageInfo?.cursor),
    hitsTotal: res.pageInfo?.hitsTotal
      ? Number(res.pageInfo.hitsTotal)
      : undefined,
    parsedQuery,
  }
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const useV2 =
    input.params.hydrateCtx.features.checkGate(
      input.params.hydrateCtx.features.Gate.SearchV2Enable,
    ) || input.params.isV2Override
  const skeletonFn = useV2 ? skeletonV2 : skeletonV1
  return skeletonFn(input)
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
      processDynamicTagsForView: params.hydrateCtx.features?.checkGate(
        params.hydrateCtx.features.Gate.SearchFilteringExplorationEnable,
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

    // Roll the post's own tags together with moderation tags on its author,
    // so author-level tags are filtered the same way as post-level tags.
    const author = hydration.actors?.get(creator)
    const tags = new Set([
      ...post.tags,
      ...(author?.accountModerationTags ?? []),
      ...(author?.profileModerationTags ?? []),
    ])

    // Tags that are hidden from all search surfaces (Top and Latest),
    // regardless of curation or author filtering.
    const alwaysHidden = [...ctx.cfg.searchTagsHideAll].some((t) => tags.has(t))
    if (alwaysHidden) return false

    let tagged = false
    if (
      params.hydrateCtx.features?.checkGate(
        params.hydrateCtx.features.Gate.SearchFilteringExplorationEnable,
      )
    ) {
      tagged = tags.has(ctx.cfg.visibilityTagHide)
    } else {
      tagged = [...ctx.cfg.searchTagsHide].some((t) => tags.has(t))
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
  searchClient?: Client
}

type Params = app.bsky.feed.searchPosts.$Params & {
  hydrateCtx: HydrateCtx
  isModService: boolean
  isV2Override: boolean
}

type Skeleton = {
  posts: AtUriString[]
  hitsTotal?: number
  cursor?: string
  parsedQuery: PostSearchQuery
}

const postSortToV2 = (sort: string | undefined): SearchSortOrder => {
  if (sort === 'top') return SearchSortOrder.TOP
  if (sort === 'latest') return SearchSortOrder.RECENT
  return SearchSortOrder.UNSPECIFIED
}

const parseTimestamp = (value: string | undefined): Timestamp | undefined => {
  if (!value) return undefined
  const date = new Date(value)
  if (isNaN(date.getTime())) return undefined
  return Timestamp.fromDate(date)
}

const sanitizeCursor = (cursor: string | undefined): string | undefined => {
  if (!cursor) return undefined
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)
    if (typeof parsed === 'object' && parsed !== null) {
      return cursor
    }
  } catch {
    // fall through to throw below
  }
  throw new InvalidRequestError('Invalid cursor format')
}
