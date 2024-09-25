import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { mergeManyStates } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getList.js'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { ListItemInfo } from '../../../../proto/bsky_pb.js'
import { uriToDid as didFromUri } from '../../../../util/uris.js'
import { clearlyBadCursor } from '../../../util.js'

type Skeleton = {
  listUri: string
  listitems: ListItemInfo[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  const getList = ctx.createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )

  server.app.bsky.graph.getList({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      return getList({ labelers, viewer }, params)
    },
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  if (clearlyBadCursor(params.cursor)) {
    return { listUri: params.list, listitems: [] }
  }
  const { listitems, cursor } = await ctx.hydrator.dataplane.getListMembers({
    listUri: params.list,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    listUri: params.list,
    listitems,
    cursor: cursor || undefined,
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  params: { list },
  skeleton,
}) => {
  const { listUri, listitems } = skeleton
  const [listState, profileState] = await Promise.all([
    ctx.hydrator.hydrateLists([listUri], ctx.hydrateCtx),
    ctx.hydrator.hydrateProfiles(
      listitems.map(({ did }) => did),
      ctx.hydrateCtx,
    ),
  ])

  const creator = didFromUri(list)

  const bidirectionalBlocks =
    ctx.hydrateCtx.viewer === creator ||
    listState.lists?.get(list)?.record.purpose === 'app.bsky.graph.defs#modlist'
      ? undefined
      : await ctx.hydrator.hydrateBidirectionalBlocks([
          [creator, listitems.map(({ did }) => did)],
        ])

  return mergeManyStates(listState, profileState, { bidirectionalBlocks })
}

const noBlocks: RulesFn<Skeleton, QueryParams> = ({ skeleton, hydration }) => {
  const creator = didFromUri(skeleton.listUri)
  const blocks = hydration.bidirectionalBlocks?.get(creator)
  skeleton.listitems = skeleton.listitems.filter(({ did }) => {
    return !blocks?.get(did)
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
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
  return { list, items, cursor }
}
