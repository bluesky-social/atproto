import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  TAKEDOWN,
  SubjectActor,
} from '../../../../lexicon/types/app/bsky/admin/moderationAction'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.admin.takeModerationAction({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const adminService = services.admin(db)
      const {
        action: _action,
        subject: _subject,
        reason,
        createdBy,
      } = input.body

      if (_action !== TAKEDOWN) {
        throw new InvalidRequestError('Unsupported action')
      }
      if (_subject.$type !== 'app.bsky.admin.moderationAction#subjectActor') {
        throw new InvalidRequestError('Unsupported subject type')
      }

      const action = _action as typeof TAKEDOWN
      const subject = _subject as SubjectActor

      const actor = await services.actor(db).getUser(subject.did, true)
      if (!actor) {
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
          reason,
          createdAt: now,
        })

        if (result.action === TAKEDOWN) {
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
