import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { Hydrator } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/notification/getUnreadCount.js'
import {
  HydrationFn,
  PresentationFnInput,
  SkeletonFn,
  noRules,
} from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'

export default function (server: Server, ctx: AppContext) {
  const getUnreadCount = ctx.createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.notification.getUnreadCount({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.iss
      const result = await getUnreadCount({ viewer }, params)
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton: SkeletonFn<Context, Params, SkeletonState> = async ({
  params,
  ctx,
}) => {
  if (params.seenAt) {
    throw new InvalidRequestError('The seenAt parameter is unsupported')
  }
  const priority =
    params.priority ?? (await getPriority(ctx, ctx.hydrateCtx.viewer))
  const res = await ctx.hydrator.dataplane.getUnreadNotificationCount({
    actorDid: ctx.hydrateCtx.viewer,
    priority,
  })
  return {
    count: res.count,
  }
}

const hydration: HydrationFn<Context, Params, SkeletonState> = async (
  _input,
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
  hydrateCtx: { viewer: string }
}

type Params = QueryParams

type SkeletonState = {
  count: number
}

const getPriority = async (ctx: Context, did: string) => {
  const actors = await ctx.hydrator.actor.getActors([did])
  return !!actors.get(did)?.priorityNotifications
}
