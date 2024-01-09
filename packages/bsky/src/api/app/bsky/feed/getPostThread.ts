import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { isNotFoundPost } from '../../../../lexicon/types/app/bsky/feed/defs'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getPostThread'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'

export default function (server: Server, ctx: AppContext) {
  const getPostThread = createPipeline(
    skeleton,
    hydration,
    noRules, // handled in presentation: 3p block-violating replies are turned to #blockedPost, viewer blocks turned to #notFoundPost.
    presentation,
  )
  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, res }) => {
      const { viewer } = ctx.authVerifier.parseCreds(auth)

      const [result, repoRev] = await Promise.allSettled([
        getPostThread({ ...params, viewer }, ctx),
        ctx.hydrator.actor.getRepoRevSafe(viewer),
      ])

      if (repoRev.status === 'fulfilled') {
        setRepoRev(res, repoRev.value)
      }
      if (result.status === 'rejected') {
        throw result.reason
      }

      return {
        encoding: 'application/json',
        body: result.value,
      }
    },
  })
}

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs
  const res = await ctx.dataplane.getThread({
    postUri: params.uri,
    above: params.parentHeight,
    below: params.depth,
  })
  return {
    anchor: params.uri,
    uris: res.uris,
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateThreadPosts(skeleton.uris, params.viewer)
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

type Params = QueryParams & { viewer: string | null }

type Skeleton = {
  anchor: string
  uris: string[]
}
