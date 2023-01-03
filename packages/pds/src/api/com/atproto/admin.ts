import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import { TAKEDOWN } from '../../../lexicon/types/com/atproto/admin/moderationAction'
import { ModerationAction } from '../../../db/tables/moderation'
import { InputSchema as ActionInput } from '../../../lexicon/types/com/atproto/admin/takeModerationAction'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.takeModerationAction({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const moderationService = services.moderation(db)
      const { action, subject, reason, createdBy } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const authTxn = services.auth(dbTxn)
        const moderationTxn = services.moderation(dbTxn)

        const result = await moderationTxn.logAction({
          action: getAction(action),
          subject: getSubject(subject),
          createdBy,
          reason,
        })

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.repo.repoRef' &&
          result.subjectDid
        ) {
          await authTxn.revokeRefreshTokensByDid(result.subjectDid)
          await moderationTxn.takedownRepo({
            takedownId: result.id,
            did: result.subjectDid,
          })
        }

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.repo.recordRef' &&
          result.subjectUri
        ) {
          await moderationTxn.takedownRecord({
            takedownId: result.id,
            uri: new AtUri(result.subjectUri),
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

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.repo.repoRef' &&
          result.subjectDid
        ) {
          await moderationTxn.reverseTakedownRepo({
            did: result.subjectDid,
          })
        }

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.repo.recordRef' &&
          result.subjectUri
        ) {
          await moderationTxn.reverseTakedownRecord({
            uri: new AtUri(result.subjectUri),
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

function getAction(action: ActionInput['action']) {
  if (action === TAKEDOWN) {
    return action as ModerationAction['action']
  }
  throw new InvalidRequestError('Invalid action')
}

function getSubject(subject: ActionInput['subject']) {
  if (
    subject.$type === 'com.atproto.repo.repoRef' &&
    typeof subject.did === 'string'
  ) {
    return { did: subject.did }
  }
  if (
    subject.$type === 'com.atproto.repo.recordRef' &&
    typeof subject.uri === 'string' &&
    (subject.cid === undefined || typeof subject.cid === 'string')
  ) {
    return {
      uri: new AtUri(subject.uri),
      cid: subject.cid ? parseCID(subject.cid) : undefined,
    }
  }
  throw new InvalidRequestError('Invalid subject')
}

function parseCID(cid: string) {
  try {
    return CID.parse(cid)
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new InvalidRequestError('Invalid cid')
    }
    throw err
  }
}
