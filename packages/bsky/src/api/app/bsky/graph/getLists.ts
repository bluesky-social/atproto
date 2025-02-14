import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import { REFERENCELIST } from '../../../../lexicon/types/app/bsky/graph/defs'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getLists'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  listUris: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getLists({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noReferenceLists,
      presentation,
      {
        includeTakedowns: true,
      },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async (ctx) => {
  if (clearlyBadCursor(ctx.params.cursor)) {
    return { listUris: [] }
  }

  const [did] = await ctx.hydrator.actor.getDids([ctx.params.actor])
  if (!did) throw new InvalidRequestError('Profile not found')

  const { listUris, cursor } = await ctx.hydrator.dataplane.getActorLists({
    actorDid: did,
    cursor: ctx.params.cursor,
    limit: ctx.params.limit,
  })
  return { listUris, cursor: cursor || undefined }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  return ctx.hydrator.hydrateLists(skeleton.listUris, ctx)
}

const noReferenceLists: RulesFn<Skeleton, QueryParams> = (
  ctx,
  skeleton,
  hydration,
) => {
  skeleton.listUris = skeleton.listUris.filter((uri) => {
    const list = hydration.lists?.get(uri)
    return list?.record.purpose !== REFERENCELIST
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const { listUris, cursor } = skeleton
  const lists = mapDefined(listUris, (uri) => {
    return ctx.views.list(uri, hydration)
  })
  return { body: { lists, cursor } }
}
