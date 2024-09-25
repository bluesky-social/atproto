import { mapDefined, noUndefinedVals } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getSuggestedFollowsByActor.js'
import {
  HeadersFn,
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline.js'

type Skeleton = {
  isFallback: boolean
  suggestedDids: string[]
  headers?: Record<string, string>
}

export default function (server: Server, ctx: AppContext) {
  const getSuggestedFollowsByActor = ctx.createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
    { extraHeaders },
  )

  server.app.bsky.graph.getSuggestedFollowsByActor({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const headers = noUndefinedVals({
        'accept-language': req.headers['accept-language'],
        'x-bsky-topics': Array.isArray(req.headers['x-bsky-topics'])
          ? req.headers['x-bsky-topics'].join(',')
          : req.headers['x-bsky-topics'],
      })

      return getSuggestedFollowsByActor({ labelers, viewer }, params, headers)
    },
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({
  ctx,
  params,
  headers,
}) => {
  const [relativeToDid] = await ctx.hydrator.actor.getDids([params.actor])
  if (!relativeToDid) {
    throw new InvalidRequestError('Actor not found')
  }

  if (ctx.suggestionsAgent) {
    const res =
      await ctx.suggestionsAgent.api.app.bsky.unspecced.getSuggestionsSkeleton(
        {
          viewer: ctx.hydrateCtx.viewer ?? undefined,
          relativeToDid,
        },
        { headers },
      )
    return {
      isFallback: !res.data.relativeToDid,
      suggestedDids: res.data.actors.map((a) => a.did),
      headers: res.headers,
    }
  } else {
    const actorDid = ctx.hydrateCtx.viewer
    if (!actorDid) throw new InvalidRequestError('An actor is required')

    const { dids } = await ctx.hydrator.dataplane.getFollowSuggestions({
      actorDid,
      relativeToDid,
    })
    return {
      isFallback: true,
      suggestedDids: dids,
    }
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton: { suggestedDids },
}) => {
  return ctx.hydrator.hydrateProfilesDetailed(suggestedDids, ctx.hydrateCtx)
}

const noBlocksOrMutes: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  skeleton.suggestedDids = skeleton.suggestedDids.filter(
    (did) =>
      !ctx.views.viewerBlockExists(did, hydration) &&
      !ctx.views.viewerMuteExists(did, hydration),
  )
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const suggestions = mapDefined(skeleton.suggestedDids, (did) =>
    ctx.views.profileDetailed(did, hydration),
  )
  return {
    isFallback: skeleton.isFallback,
    suggestions,
  }
}

const extraHeaders: HeadersFn<Skeleton, QueryParams> = ({ skeleton }) => {
  const lang = skeleton.headers?.['content-language']
  return lang ? ({ 'content-language': lang } as Record<string, string>) : {}
}
