import { mapDefined } from '@atproto/common'
import {
  AtUriString,
  DatetimeString,
  normalizeDatetimeAlways,
} from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator.js'
import { parseString } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import { RulesFnInput, createPipeline } from '../../../../pipeline.js'
import { uriToDid as creatorFromUri } from '../../../../util/uris.js'
import { Views } from '../../../../views/index.js'
import { clearlyBadCursor, resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getVotes = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.add(app.bsky.poll.getVotes, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns, skipViewerBlocks } =
        ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
        skipViewerBlocks,
      })
      const result = await getVotes({ ...params, hydrateCtx }, ctx)

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (inputs: {
  ctx: Context
  params: Params
}): Promise<Skeleton> => {
  const { ctx, params } = inputs

  if (clearlyBadCursor(params.cursor)) {
    return { votes: [] }
  }
  const votesRes = await ctx.hydrator.dataplane.getPollVotesBySubject({
    subject: { uri: params.uri, cid: params.cid ?? '' },
    hasOption: params.option !== undefined,
    option: params.option ?? 0,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    votes: votesRes.uris as AtUriString[],
    cursor: parseString(votesRes.cursor),
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydratePollVotes(skeleton.votes, params.hydrateCtx)
}

const noBlocks = (input: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, skeleton, hydration } = input
  skeleton.votes = skeleton.votes.filter((uri) => {
    const voterDid = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(voterDid, hydration)
  })
  return skeleton
}

const presentation = (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
  hydration: HydrationState
}): app.bsky.poll.getVotes.$OutputBody => {
  const { ctx, params, skeleton, hydration } = inputs
  const voteViews = mapDefined(skeleton.votes, (uri) => {
    const vote = hydration.pollVotes?.get(uri)
    if (!vote || !vote.record) {
      return
    }
    const voterDid = creatorFromUri(uri)
    const actor = ctx.views.profile(voterDid, hydration)
    if (!actor) {
      return
    }
    return {
      actor,
      option: vote.record.option,
      createdAt: normalizeDatetimeAlways(vote.record.createdAt),
      indexedAt: vote.sortedAt.toISOString() as DatetimeString,
    }
  })
  return {
    votes: voteViews,
    cursor: skeleton.cursor,
    uri: params.uri,
    cid: params.cid,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.poll.getVotes.$Params & { hydrateCtx: HydrateCtx }

type Skeleton = {
  votes: AtUriString[]
  cursor?: string
}
