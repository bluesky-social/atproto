import { InvalidRequestError } from '@atproto/xrpc-server'
import { ServerConfig } from '../../../../config'
import { AppContext } from '../../../../context'
import { Code, DataPlaneClient, isDataplaneError } from '../../../../data-plane'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { isNotFoundPost } from '../../../../lexicon/types/app/bsky/feed/defs'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getPostThread'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { postUriToThreadgateUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { ATPROTO_REPO_REV, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getPostThread = createPipeline(
    skeleton,
    hydration,
    noRules, // handled in presentation: 3p block-violating replies are turned to #blockedPost, viewer blocks turned to #notFoundPost.
    presentation,
  )
  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req, res }) => {
      const { viewer, includeTakedowns, include3pBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
        include3pBlocks,
      })

      let result: OutputSchema
      try {
        result = await getPostThread({ ...params, hydrateCtx }, ctx)
      } catch (err) {
        const repoRev = await ctx.hydrator.actor.getRepoRevSafe(viewer)
        if (repoRev) {
          res.setHeader(ATPROTO_REPO_REV, repoRev)
        }
        throw err
      }

      const repoRev = await ctx.hydrator.actor.getRepoRevSafe(viewer)

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({
          repoRev,
          labelers: hydrateCtx.labelers,
        }),
      }
    },
  })
}

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs
  const anchor = await ctx.hydrator.resolveUri(params.uri)
  try {
    const res = await ctx.dataplane.getThread({
      postUri: anchor,
      above: params.parentHeight,
      below: getDepth(ctx, anchor, params),
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
  const thread = ctx.views.thread(skeleton, hydration, {
    height: params.parentHeight,
    depth: getDepth(ctx, skeleton.anchor, params),
  })
  if (isNotFoundPost(thread)) {
    // @TODO technically this could be returned as a NotFoundPost based on lexicon
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

const getDepth = (ctx: Context, anchor: string, params: Params) => {
  let maxDepth = ctx.cfg.maxThreadDepth
  if (ctx.cfg.bigThreadUris.has(anchor) && ctx.cfg.bigThreadDepth) {
    maxDepth = ctx.cfg.bigThreadDepth
  }
  return maxDepth ? Math.min(maxDepth, params.depth) : params.depth
}
