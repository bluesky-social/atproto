import type { AtUriString } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { ServerConfig } from '../../../../config.js'
import type { AppContext } from '../../../../context.js'
import {
  Code,
  type DataPlaneClient,
  isDataplaneError,
} from '../../../../data-plane/index.js'
import type { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
import type { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

// No parents for hidden replies (it would be the anchor post).
const ABOVE = 0

// For hidden replies we don't get more than the top-level replies.
// To get nested replies, load the thread as one of the hidden replies as anchor.
const BELOW = 1

// It doesn't really matter since BELOW is 1, so it will not be used.
const BRANCHING_FACTOR = 0

export default function (server: Server, ctx: AppContext) {
  const getPostThreadOther = createPipeline(
    skeleton,
    hydration,
    noRules, // handled in presentation: 3p block-violating replies are turned to #blockedPost, viewer blocks turned to #notFoundPost.
    presentation,
  )
  server.add(app.bsky.unspecced.getPostThreadOtherV2, {
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns, include3pBlocks, skipViewerBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
        include3pBlocks,
        skipViewerBlocks,
      })

      return {
        encoding: 'application/json',
        body: await getPostThreadOther({ ...params, hydrateCtx }, ctx),
        headers: resHeaders({
          labelers: hydrateCtx.labelers,
        }),
      }
    },
  })
}

const skeleton = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const anchor = await ctx.hydrator.resolveUri(params.anchor)
  try {
    const res = await ctx.dataplane.getThread({
      postUri: anchor,
      above: ABOVE,
      below: BELOW,
    })
    return {
      anchor,
      uris: res.uris as AtUriString[],
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
  const { ctx, skeleton, hydration } = inputs
  const thread = ctx.views.threadOtherV2(skeleton, hydration, {
    below: BELOW,
    branchingFactor: BRANCHING_FACTOR,
  })
  return { thread }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
  cfg: ServerConfig
}

type Params = app.bsky.unspecced.getPostThreadOtherV2.$Params & {
  hydrateCtx: HydrateCtx
}

type Skeleton = {
  anchor: AtUriString
  uris: AtUriString[]
}
