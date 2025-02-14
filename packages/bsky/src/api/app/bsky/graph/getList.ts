import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context'
import { mergeManyStates } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getList'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { ListItemInfo } from '../../../../proto/bsky_pb'
import { uriToDid as didFromUri } from '../../../../util/uris'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  listUri: string
  listitems: ListItemInfo[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getList({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocks,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async (ctx) => {
  if (clearlyBadCursor(ctx.params.cursor)) {
    return { listUri: ctx.params.list, listitems: [] }
  }
  const { listitems, cursor } = await ctx.hydrator.dataplane.getListMembers({
    listUri: ctx.params.list,
    limit: ctx.params.limit,
    cursor: ctx.params.cursor,
  })
  return {
    listUri: ctx.params.list,
    listitems,
    cursor: cursor || undefined,
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  const { listUri, listitems } = skeleton
  const [listState, profileState] = await Promise.all([
    ctx.hydrator.hydrateLists([listUri], ctx),
    ctx.hydrator.hydrateProfiles(
      listitems.map(({ did }) => did),
      ctx,
    ),
  ])

  const creator = didFromUri(ctx.params.list)

  const bidirectionalBlocks =
    ctx.viewer === creator ||
    listState.lists?.get(ctx.params.list)?.record.purpose ===
      'app.bsky.graph.defs#modlist'
      ? undefined
      : await ctx.hydrator.hydrateBidirectionalBlocks([
          [creator, listitems.map(({ did }) => did)],
        ])

  return mergeManyStates(listState, profileState, { bidirectionalBlocks })
}

const noBlocks: RulesFn<Skeleton, QueryParams> = (ctx, skeleton, hydration) => {
  const creator = didFromUri(skeleton.listUri)
  const blocks = hydration.bidirectionalBlocks?.get(creator)
  skeleton.listitems = skeleton.listitems.filter(({ did }) => {
    return !blocks?.get(did)
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const { listUri, listitems, cursor } = skeleton
  const list = ctx.views.list(listUri, hydration)
  const items = mapDefined(listitems, ({ uri, did }) => {
    const subject = ctx.views.profile(did, hydration)
    if (!subject) return
    return { uri, subject }
  })
  if (!list) {
    throw new InvalidRequestError('List not found')
  }
  return { body: { list, items, cursor } }
}
