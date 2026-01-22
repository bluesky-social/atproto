import { mapDefined } from '@atproto/common'
import { DidString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { app } from '../../../../lexicons/index.js'
import {
  HydrationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { ImportContactsMatch } from '../../../../proto/rolodex_pb'
import { RolodexClient } from '../../../../rolodex'
import { Views } from '../../../../views'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util'

export default function (server: Server, ctx: AppContext) {
  const importContacts = createPipeline(
    skeleton,
    hydration,
    noRules, //
    presentation,
  )
  server.add(app.bsky.contact.importContacts, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth, req }) => {
      assertRolodexOrThrowUnimplemented(ctx)

      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
      })

      const result = await importContacts({ ...input.body, hydrateCtx }, ctx)

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (
  input: SkeletonFnInput<Context, Input>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  const actor = params.hydrateCtx.viewer
  const { matches } = await callRolodexClient(
    ctx.rolodexClient.importContacts({
      actor: params.hydrateCtx.viewer,
      contacts: params.contacts,
      token: params.token,
    }),
  )
  return {
    actor,
    matches,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Input, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { matches } = skeleton
  const subjects = matches.map((m) => m.subject as DidString)
  return ctx.hydrator.hydrateProfiles(subjects, params.hydrateCtx)
}

const presentation = (input: {
  ctx: Context
  params: Input
  skeleton: SkeletonState
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = input
  const matchesAndContactIndexes = mapDefined(
    skeleton.matches,
    ({
      subject,
      inputIndex,
    }): app.bsky.contact.defs.MatchAndContactIndex | undefined => {
      const profile = ctx.views.profile(subject as DidString, hydration)

      if (!profile) {
        return undefined
      }

      return {
        contactIndex: inputIndex,
        match: profile,
      }
    },
  )
  return { matchesAndContactIndexes }
}

type Context = {
  hydrator: Hydrator
  rolodexClient: RolodexClient
  views: Views
}

type Input = app.bsky.contact.importContacts.InputBody & {
  hydrateCtx: HydrateCtx & { viewer: string }
}

type SkeletonState = {
  actor: string
  matches: ImportContactsMatch[]
}
