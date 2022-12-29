import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import {
  TAKEDOWN,
  SubjectRepo,
} from '../../../lexicon/types/com/atproto/admin/moderationAction'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.takeModerationAction({
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
      if (_subject.$type !== 'com.atproto.admin.moderationAction#subjectRepo') {
        throw new InvalidRequestError('Unsupported subject type')
      }

      const action = _action as typeof TAKEDOWN
      const subject = _subject as SubjectRepo

      const repoRoot = await services.repo(db).getRepoRoot(subject.did)
      if (!repoRoot) {
        throw new Error('Repo does not exist')
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

  server.com.atproto.admin.reverseModerationAction({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const adminService = services.admin(db)
      const { id, createdBy, reason } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const adminTxn = services.admin(dbTxn)
        const now = new Date()

        const existing = await adminTxn.getModAction(id)
        if (!existing) {
          throw new InvalidRequestError('Moderation action does not exist')
        }
        if (existing.reversedAt !== null) {
          throw new InvalidRequestError(
            'Moderation action has already been reversed',
          )
        }

        const result = await adminTxn.logReverseModAction({
          id,
          createdAt: now,
          createdBy,
          reason,
        })

        if (result.action === TAKEDOWN && result.subjectDid !== null) {
          await adminTxn.reverseTakedownActorByDid({ did: result.subjectDid })
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
