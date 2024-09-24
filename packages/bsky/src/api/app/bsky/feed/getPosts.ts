import { dedupeStrs, mapDefined } from '@atproto/common'
import AppContext from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getPosts'
import { uriToDid as creatorFromUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

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
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })

      const results = await getPosts(hydrateCtx, params)

      return {
        encoding: 'application/json',
        body: results,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (inputs: { params: Params }) => {
  return { posts: dedupeStrs(inputs.params.uris) }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, skeleton } = inputs
  return ctx.hydrator.hydratePosts(
    skeleton.posts.map((uri) => ({ uri })),
    ctx.hydrateCtx,
  )
}

const noBlocks = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.posts = skeleton.posts.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation = (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  const posts = mapDefined(skeleton.posts, (uri) =>
    ctx.views.post(uri, hydration),
  )
  return { posts }
}

type Context = {
  hydrator: Hydrator
  views: Views
  hydrateCtx: HydrateCtx
}

type Params = QueryParams

type Skeleton = {
  posts: string[]
}
