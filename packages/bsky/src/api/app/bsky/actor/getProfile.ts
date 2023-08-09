import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { softDeleted } from '../../../../db/util'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ auth, params }) => {
      const { actor } = params
      const requester = 'did' in auth.credentials ? auth.credentials.did : null
      const canViewTakendownProfile =
        auth.credentials.type === 'role' && auth.credentials.triage
      const { db, services } = ctx
      const actorService = services.actor(db)

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
