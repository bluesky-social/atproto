import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { softDeleted } from '../../../../db/util'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params, res }) => {
      const { actor } = params
      const requester = auth.credentials.did
      const { db, services } = ctx
      const actorService = services.actor(db)

      const [actorRes, actorClock] = await Promise.all([
        actorService.getActor(actor, true),
        actorService.getActorClock(requester),
      ])

      if (!actorRes) {
        throw new InvalidRequestError('Profile not found')
      }
      if (softDeleted(actorRes)) {
        throw new InvalidRequestError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      if (actorClock !== null) {
        res.setHeader('atproto-clock', actorClock)
      }

      return {
        encoding: 'application/json',
        body: await actorService.views.profileDetailed(actorRes, requester),
      }
    },
  })
}
