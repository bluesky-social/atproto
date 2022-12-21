import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import * as ActorRef from '../../../../lexicon/types/app/bsky/actor/ref'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.administration.takeModerationAction({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const adminService = services.admin(db)
      const {
        action: _action,
        subject: _subject,
        rationale,
        createdBy,
      } = input.body

      if (_action !== 'takedown') {
        throw new InvalidRequestError('Unsupported action')
      }
      if (_subject.$type !== ids.AppBskyActorRef) {
        throw new InvalidRequestError('Unsupported subject type')
      }

      const action = _action as 'takedown'
      const subject = _subject as ActorRef.Main

      const actor = await services.actor(db).getUser(subject.did, true)
      if (!actor || actor.declarationCid !== subject.declarationCid) {
        throw new Error('Actor does not exist')
      }

      const moderationAction = await db.transaction(async (dbTxn) => {
        const authTxn = services.auth(dbTxn)
        const adminTxn = services.admin(dbTxn)
        const now = new Date()

        const result = await adminTxn.logModAction({
          action,
          subject,
          createdBy,
          rationale,
          createdAt: now,
        })

        if (result.action === 'takedown') {
          await authTxn.revokeRefreshTokensByDid(subject.did)
          await adminTxn.takedownActorByDid({
            takedownId: result.id,
            did: subject.did,
          })
        }

        return result
      })

      return {
        encoding: 'application/json',
        body: adminService.formatModActionView(moderationAction),
      }
    },
  })
}
