import type { DidString } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type { Hydrator } from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
import type { Views } from '../../../../views/index.js'

export default function (server: Server, ctx: AppContext) {
  const getUnreadCount = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.add(app.bsky.notification.getUnreadCount, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.iss
      const result = await getUnreadCount({ ...params, viewer }, ctx)
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  if (params.seenAt) {
    throw new InvalidRequestError('The seenAt parameter is unsupported')
  }
  const priority = params.priority ?? (await getPriority(ctx, params.viewer))
  const res = await ctx.hydrator.dataplane.getUnreadNotificationCount({
    actorDid: params.viewer,
    priority,
  })
  return {
    count: res.count,
  }
}

const hydration = async (
  _input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  return {}
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton } = input
  return { count: skeleton.count }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.notification.getUnreadCount.$Params & {
  viewer: DidString
}

type SkeletonState = {
  count: number
}

const getPriority = async (ctx: Context, did: DidString) => {
  const actors = await ctx.hydrator.actor.getActors([did], {
    skipCacheForDids: [did],
  })
  return !!actors.get(did)?.priorityNotifications
}
