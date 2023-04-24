import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { softDeleted } from '../../../../db/util'
import AppContext from '../../../../context'
import { authOptionalVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const { actor } = params
      const requester = auth.credentials.did
      const { db, services } = ctx
      const actorService = services.actor(db)

      const actorRes = await actorService.getActor(actor, true)

      if (!actorRes) {
        throw new InvalidRequestError('Profile not found')
      }
      if (softDeleted(actorRes)) {
        throw new InvalidRequestError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      return {
        encoding: 'application/json',
        body: await actorService.views.profileDetailed(actorRes, requester),
      }
    },
  })
}
