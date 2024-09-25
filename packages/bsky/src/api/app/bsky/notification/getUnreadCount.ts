import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/notification/getUnreadCount.js'
import {
  HydrationFn,
  PresentationFn,
  SkeletonFn,
  noRules,
} from '../../../../pipeline.js'

type Skeleton = {
  count: number
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.getUnreadCount({
    auth: ctx.authVerifier.standard,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noRules,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ params, ctx }) => {
  if (params.seenAt) {
    throw new InvalidRequestError('The seenAt parameter is unsupported')
  }

  const actorDid = ctx.hydrateCtx.viewer
  if (!actorDid) {
    throw new InvalidRequestError('Viewer not found')
  }

  const priority =
    params.priority ??
    !!(await ctx.hydrator.actor.getActors([actorDid])).get(actorDid)
      ?.priorityNotifications

  const res = await ctx.hydrator.dataplane.getUnreadNotificationCount({
    actorDid,
    priority,
  })

  return {
    count: res.count,
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (_input) => {
  return {}
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  skeleton,
}) => {
  return { count: skeleton.count }
}
