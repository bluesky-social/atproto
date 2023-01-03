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
      const moderationService = services.moderation(db)
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
        const moderationTxn = services.moderation(dbTxn)
        const now = new Date()

        const result = await moderationTxn.logAction({
          action,
          subject,
          createdBy,
          reason,
          createdAt: now,
        })

        if (result.action === TAKEDOWN) {
          await authTxn.revokeRefreshTokensByDid(subject.did)
          await moderationTxn.takedownActorByDid({
            takedownId: result.id,
            did: subject.did,
          })
        }

        return result
      })

      return {
        encoding: 'application/json',
        body: await moderationService.formatActionView(moderationAction),
      }
    },
  })

  server.com.atproto.admin.reverseModerationAction({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const moderationService = services.moderation(db)
      const { id, createdBy, reason } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const moderationTxn = services.moderation(dbTxn)
        const now = new Date()

        const existing = await moderationTxn.getAction(id)
        if (!existing) {
          throw new InvalidRequestError('Moderation action does not exist')
        }
        if (existing.reversedAt !== null) {
          throw new InvalidRequestError(
            'Moderation action has already been reversed',
          )
        }

        const result = await moderationTxn.logReverseAction({
          id,
          createdAt: now,
          createdBy,
          reason,
        })

        if (result.action === TAKEDOWN && result.subjectDid !== null) {
          await moderationTxn.reverseTakedownActorByDid({
            did: result.subjectDid,
          })
        }

        return result
      })

      return {
        encoding: 'application/json',
        body: await moderationService.formatActionView(moderationAction),
      }
    },
  })

  server.com.atproto.admin.resolveModerationReports({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const moderationService = services.moderation(db)
      const { actionId, reportIds, createdBy } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const moderationTxn = services.moderation(dbTxn)
        await moderationTxn.resolveReports({ reportIds, actionId, createdBy })
        return await moderationTxn.getActionOrThrow(actionId)
      })

      return {
        encoding: 'application/json',
        body: await moderationService.formatActionView(moderationAction),
      }
    },
  })
}
