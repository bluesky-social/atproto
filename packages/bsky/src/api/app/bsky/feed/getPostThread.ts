import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { isNotFoundPost } from '../../../../lexicon/types/app/bsky/feed/defs'
import {
  QueryParams,
  OutputSchema,
} from '../../../../lexicon/types/app/bsky/feed/getPostThread'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient, isDataplaneError, Code } from '../../../../data-plane'

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
      const { viewer } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = { labelers, viewer }

      let result: OutputSchema
      try {
        result = await getPostThread({ ...params, hydrateCtx }, ctx)
      } catch (err) {
        const repoRev = await ctx.hydrator.actor.getRepoRevSafe(viewer)
        setRepoRev(res, repoRev)
        throw err
      }

      const repoRev = await ctx.hydrator.actor.getRepoRevSafe(viewer)
      setRepoRev(res, repoRev)

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs
  try {
    const res = await ctx.dataplane.getThread({
      postUri: params.uri,
      above: params.parentHeight,
      below: params.depth,
    })
    return {
      anchor: params.uri,
      uris: res.uris,
    }
  } catch (err) {
    if (isDataplaneError(err, Code.NotFound)) {
      return {
        anchor: params.uri,
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
    depth: params.depth,
  })
  if (isNotFoundPost(thread)) {
    // @TODO technically this could be returned as a NotFoundPost based on lexicon
    throw new InvalidRequestError(`Post not found: ${params.uri}`, 'NotFound')
  }
  return { thread }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & { hydrateCtx: HydrateCtx }

type Skeleton = {
  anchor: string
  uris: string[]
}
