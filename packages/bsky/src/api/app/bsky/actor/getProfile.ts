import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { softDeleted } from '../../../../db/util'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params, res }) => {
      const { actor } = params
      const requester = auth.credentials.did
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)

      const [actorRes, repoRev] = await Promise.all([
        actorService.getActor(actor, true),
        actorService.getRepoRev(requester),
      ])
      setRepoRev(res, repoRev)

      if (!actorRes) {
        throw new InvalidRequestError('Profile not found')
      }
      if (softDeleted(actorRes)) {
        throw new InvalidRequestError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }
      const profile = await actorService.views.profileDetailed(
        actorRes,
        requester,
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
