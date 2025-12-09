import { mapDefined } from '@atproto/common'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/contact/getMatches'
import {
  HydrationFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { RolodexClient } from '../../../../rolodex'
import { Views } from '../../../../views'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util'

export default function (server: Server, ctx: AppContext) {
  const getMatches = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.app.bsky.contact.getMatches({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      assertRolodexOrThrowUnimplemented(ctx)

      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
      })

      const result = await getMatches(
        { ...params, hydrateCtx: hydrateCtx.copy({ viewer }) },
        ctx,
      )

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
  const actor = params.hydrateCtx.viewer
  const { cursor, subjects } = await callRolodexClient(
    ctx.rolodexClient.getMatches({
      actor: params.hydrateCtx.viewer,
      limit: params.limit,
      cursor: params.cursor,
    }),
  )
  return {
    actor,
    subjects,
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { subjects } = skeleton
  return ctx.hydrator.hydrateProfiles(subjects, params.hydrateCtx)
}

const noBlocks = (inputs: {
  ctx: Context
  skeleton: SkeletonState
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.subjects = skeleton.subjects.filter((subject) => {
    return !ctx.views.viewerBlockExists(subject, hydration)
  })
  return skeleton
}

const presentation = (input: {
  ctx: Context
  params: Params
  skeleton: SkeletonState
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = input
  const matches = mapDefined(skeleton.subjects, (did) =>
    ctx.views.profile(did, hydration),
  )
  return { matches }
}

type Context = {
  hydrator: Hydrator
  rolodexClient: RolodexClient
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string }
}

type SkeletonState = {
  actor: string
  subjects: string[]
  cursor?: string
}
