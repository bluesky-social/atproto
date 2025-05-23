import { isThreadItemNotFound } from '@atproto/api/dist/client/types/app/bsky/unspecced/getPostThreadV2'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ServerConfig } from '../../../../config'
import { AppContext } from '../../../../context'
import { Code, DataPlaneClient, isDataplaneError } from '../../../../data-plane'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/unspecced/getPostThreadV2'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { postUriToThreadgateUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getPostThread = createPipeline(
    skeleton,
    hydration,
    noRules, // handled in presentation: 3p block-violating replies are turned to #blockedPost, viewer blocks turned to #notFoundPost.
    presentation,
  )
  server.app.bsky.unspecced.getPostThreadV2({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns, include3pBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
        include3pBlocks,
      })

      return {
        encoding: 'application/json',
        body: await getPostThread({ ...params, hydrateCtx }, ctx),
        headers: resHeaders({
          labelers: hydrateCtx.labelers,
        }),
      }
    },
  })
}

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs
  const anchor = await ctx.hydrator.resolveUri(params.anchor)
  try {
    const res = await ctx.dataplane.getThread({
      postUri: anchor,
      // We don't allow customizing the height above the anchor, and set it to a reasonable default.
      above: params.above ? 50 : 0,
      below: calculateBelow(ctx, anchor, params),
    })
    return {
      anchor,
      uris: res.uris,
    }
  } catch (err) {
    if (isDataplaneError(err, Code.NotFound)) {
      return {
        anchor,
        uris: [],
      }
    } else {
      throw err
    }
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateThreadPosts(
    skeleton.uris.map((uri) => ({ uri })),
    params.hydrateCtx,
  )
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton, hydration } = inputs
  const { anchor, thread } = ctx.views.threadV2(skeleton, hydration, {
    above: params.above,
    below: calculateBelow(ctx, skeleton.anchor, params),
    branchingFactor: params.branchingFactor,
    prioritizeFollowedUsers: params.prioritizeFollowedUsers,
    sort: params.sort,
    viewer: params.hydrateCtx.viewer,
  })

  if (!anchor || isThreadItemNotFound(anchor.value)) {
    throw new InvalidRequestError(
      `Post not found: ${skeleton.anchor}`,
      'NotFound',
    )
  }

  const rootUri =
    hydration.posts?.get(skeleton.anchor)?.record.reply?.root.uri ??
    skeleton.anchor
  const threadgate = ctx.views.threadgate(
    postUriToThreadgateUri(rootUri),
    hydration,
  )
  return { thread, threadgate }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
  cfg: ServerConfig
}

type Params = QueryParams & { hydrateCtx: HydrateCtx }

type Skeleton = {
  anchor: string
  uris: string[]
}

const calculateBelow = (ctx: Context, anchor: string, params: Params) => {
  let maxDepth = ctx.cfg.maxThreadDepth
  if (ctx.cfg.bigThreadUris.has(anchor) && ctx.cfg.bigThreadDepth) {
    maxDepth = ctx.cfg.bigThreadDepth
  }
  return maxDepth ? Math.min(maxDepth, params.below) : params.below
}
