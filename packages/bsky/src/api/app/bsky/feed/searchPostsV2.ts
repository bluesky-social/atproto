import { Timestamp } from '@bufbuild/protobuf'
import { mapDefined } from '@atproto/common'
import { AtUriString } from '@atproto/lex'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { DataPlaneClient } from '../../../../data-plane/index.js'
import {
  PostSearchQuery,
  parsePostSearchQuery,
} from '../../../../data-plane/server/util.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { parseString } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline.js'
import {
  SearchQueryLanguage,
  SearchSortOrder,
} from '../../../../proto/bsky_pb.js'
import { uriToDid as creatorFromUri } from '../../../../util/uris.js'
import { Views } from '../../../../views/index.js'
import { resHeaders, resolveSearchV2Override } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const searchPostsV2 = createPipeline(
    skeleton,
    hydration,
    noBlocksOrTagged,
    presentation,
  )
  server.add(app.bsky.feed.searchPostsV2, {
    auth: ctx.authVerifier.standard,
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
      const isV2Enabled =
        hydrateCtx.features.checkGate(
          hydrateCtx.features.Gate.SearchV2Enable,
        ) || resolveSearchV2Override(req, ctx.cfg)
      if (!isV2Enabled) {
        throw new InvalidRequestError('Search v2 is not enabled')
      }

      const results = await searchPostsV2(
        {
          ...params,
          // Default to curated 'top' ranking when unset; the backend rejects an
          // unspecified sort order.
          sort: params.sort ?? 'top',
          hydrateCtx,
          isModService,
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

const skeleton = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const query = params.query ?? ''
  const parsedQuery = parsePostSearchQuery(query, {
    author: params.authors?.[0],
  })

  const res = await ctx.dataplane.searchPostsV2({
    params: {
      query,
      viewer: params.hydrateCtx.viewer ?? undefined,
      limit: params.limit,
      cursor: params.cursor,
    },
    sort: postSortToV2(params.sort),
    filters: {
      authors: params.authors ?? [],
      mentions: params.mentions ?? [],
      domains: params.domains ?? [],
      urls: params.urls ?? [],
      embeddedAtUris: params.embeddedAtUris ?? [],
      hashtags: params.hashtags ?? [],
    },
    exclude: {
      authors: params.excludeAuthors ?? [],
      mentions: params.excludeMentions ?? [],
      domains: params.excludeDomains ?? [],
      urls: params.excludeUrls ?? [],
      embeddedAtUris: params.excludeEmbeddedAtUris ?? [],
      hashtags: params.excludeHashtags ?? [],
    },
    since: parseTimestamp(params.since),
    until: parseTimestamp(params.until),
    allTime: params.allTime,
    language: params.language,
    hasMedia: params.hasMedia,
    hasVideo: params.hasVideo,
    replyParentUri: params.replyParentUri,
    threadRootUri: params.threadRootUri,
    excludeReplies: params.excludeReplies,
    repliesOnly: params.repliesOnly,
    following: params.following,
    queryLanguage: queryLanguageToV2(params.queryLanguage),
  })
  return {
    posts: res.posts.map(({ uri }) => uri as AtUriString),
    cursor: parseString(res.pageInfo?.cursor),
    hitsTotal: res.pageInfo?.hitsTotal
      ? Number(res.pageInfo.hitsTotal)
      : undefined,
    detectedQueryLanguages: res.detectedQueryLanguages,
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
  const { parsedQuery } = skeleton

  skeleton.posts = skeleton.posts.filter((uri) => {
    const post = hydration.posts?.get(uri)
    if (!post) return

    const creator = creatorFromUri(uri)
    const isCuratedSearch = params.sort === 'top'
    const isPostByViewer = creator === params.hydrateCtx.viewer

    if (isPostByViewer) return true
    if (params.isModService) return true

    if (ctx.views.viewerBlockExists(creator, hydration)) return false

    const tagged = [...ctx.cfg.searchTagsHide].some((t) => post.tags.has(t))

    if (isCuratedSearch && tagged) return false
    if (!(parsedQuery.author || params.authors?.length) && tagged) return false
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
    detectedQueryLanguages: skeleton.detectedQueryLanguages,
  }
}

type Context = {
  cfg: AppContext['cfg']
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.feed.searchPostsV2.$Params & {
  hydrateCtx: HydrateCtx
  isModService: boolean
}

type Skeleton = {
  posts: AtUriString[]
  hitsTotal?: number
  cursor?: string
  detectedQueryLanguages?: string[]
  parsedQuery: PostSearchQuery
}

const postSortToV2 = (sort?: string): SearchSortOrder => {
  if (sort === 'top') return SearchSortOrder.TOP
  if (sort === 'recent') return SearchSortOrder.RECENT
  return SearchSortOrder.UNSPECIFIED
}

const queryLanguageToV2 = (
  lang: string | undefined,
): SearchQueryLanguage | undefined => {
  if (lang === 'ja') return SearchQueryLanguage.JA
  if (lang === 'zh') return SearchQueryLanguage.ZH
  if (lang === 'ko') return SearchQueryLanguage.KO
  if (lang === 'th') return SearchQueryLanguage.TH
  if (lang === 'ar') return SearchQueryLanguage.AR
  return undefined
}

const parseTimestamp = (value: string | undefined): Timestamp | undefined => {
  if (!value) return undefined
  const date = new Date(value)
  if (isNaN(date.getTime())) return undefined
  return Timestamp.fromDate(date)
}
