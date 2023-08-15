import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { softDeleted } from '../../../../db/util'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ auth, params, res }) => {
      const { actor } = params
      const requester = 'did' in auth.credentials ? auth.credentials.did : null
      const canViewTakendownProfile =
        auth.credentials.type === 'role' && auth.credentials.triage
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
