import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { softDeleted } from '../../../../../db/util'
import AppContext from '../../../../../context'
import { authPassthru } from '../../../../../api/com/atproto/admin/util'
import { OutputSchema } from '../../../../../lexicon/types/app/bsky/actor/getProfile'
import { handleReadAfterWrite } from '../util/read-after-write'
import { LocalRecords } from '../../../../../services/local'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.accessOrRoleVerifier,
    handler: async ({ req, auth, params }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      if (ctx.canProxyRead()) {
        const res = await ctx.appviewAgent.api.app.bsky.actor.getProfile(
          params,
          requester
            ? await ctx.serviceAuthHeaders(requester)
            : authPassthru(req),
        )
        if (res.data.did === requester) {
          return await handleReadAfterWrite(
            ctx,
            requester,
            res,
            getProfileMunge,
          )
        }
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      // As long as user has triage permission, we know that they are a moderator user and can see taken down profiles
      const canViewTakendownProfile =
        auth.credentials.type === 'role' && auth.credentials.triage
      const { actor } = params
      const { db, services } = ctx
      const actorService = services.appView.actor(db)

      const actorRes = await actorService.getActor(actor, true)

      if (!actorRes) {
        throw new InvalidRequestError('Profile not found')
      }
      if (!canViewTakendownProfile && softDeleted(actorRes)) {
        throw new InvalidRequestError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }
      const profile = await actorService.views.profileDetailed(
        actorRes,
        requester,
        { includeSoftDeleted: canViewTakendownProfile },
      )
      if (!profile) {
        throw new InvalidRequestError('Profile not found')
      }

      return {
        encoding: 'application/json',
        body: profile,
      }
    },
  })
}

const getProfileMunge = async (
  ctx: AppContext,
  original: OutputSchema,
  local: LocalRecords,
): Promise<OutputSchema> => {
  if (!local.profile) return original
  return ctx.services
    .local(ctx.db)
    .updateProfileDetailed(original, local.profile.record)
}
