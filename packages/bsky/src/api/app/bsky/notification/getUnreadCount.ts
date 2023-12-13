import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/notification/getUnreadCount'
import AppContext from '../../../../context'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipelineNew,
  noRulesNew,
} from '../../../../pipeline'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'

export default function (server: Server, ctx: AppContext) {
  const getUnreadCount = createPipelineNew(
    skeleton,
    hydration,
    noRulesNew,
    presentation,
  )
  server.app.bsky.notification.getUnreadCount({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.did
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
  const res = await ctx.hydrator.dataplane.getUnreadNotificationCount({
    actorDid: params.viewer,
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

type Params = QueryParams & {
  viewer: string
}

type SkeletonState = {
  count: number
}
