import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import {
  ACKNOWLEDGE,
  FLAG,
  TAKEDOWN,
} from '../../../lexicon/types/com/atproto/admin/moderationAction'
import { ModerationAction } from '../../../db/tables/moderation'
import { InputSchema as ActionInput } from '../../../lexicon/types/com/atproto/admin/takeModerationAction'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.takeModerationAction({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const adminService = services.admin(db)
      const { action, subject, reason, createdBy } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const authTxn = services.auth(dbTxn)
        const adminTxn = services.admin(dbTxn)

        const result = await adminTxn.logModAction({
          action: getAction(action),
          subject: getSubject(subject),
          createdBy,
          reason,
        })

        if (
          result.action === TAKEDOWN &&
          result.subjectType ===
            'com.atproto.admin.moderationAction#subjectRepo' &&
          result.subjectDid
        ) {
          await authTxn.revokeRefreshTokensByDid(result.subjectDid)
          await adminTxn.takedownRepo({
            takedownId: result.id,
            did: result.subjectDid,
          })
        }

        if (
          result.action === TAKEDOWN &&
          result.subjectType ===
            'com.atproto.admin.moderationAction#subjectRecord' &&
          result.subjectUri
        ) {
          await adminTxn.takedownRecord({
            takedownId: result.id,
            uri: new AtUri(result.subjectUri),
          })
        }

        return result
      })

      return {
        encoding: 'application/json',
        body: await adminService.formatModActionView(moderationAction),
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

        if (
          result.action === TAKEDOWN &&
          result.subjectType ===
            'com.atproto.admin.moderationAction#subjectRepo' &&
          result.subjectDid
        ) {
          await adminTxn.reverseTakedownRepo({
            did: result.subjectDid,
          })
        }

        if (
          result.action === TAKEDOWN &&
          result.subjectType ===
            'com.atproto.admin.moderationAction#subjectRecord' &&
          result.subjectUri
        ) {
          await adminTxn.reverseTakedownRecord({
            uri: new AtUri(result.subjectUri),
          })
        }

        return result
      })

      return {
        encoding: 'application/json',
        body: await adminService.formatModActionView(moderationAction),
      }
    },
  })

  server.com.atproto.admin.resolveModerationReports({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const adminService = services.admin(db)
      const { actionId, reportIds, createdBy } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const adminTxn = services.admin(dbTxn)
        await adminTxn.resolveModReports({ reportIds, actionId, createdBy })
        return await adminTxn.getModActionOrThrow(actionId)
      })

      return {
        encoding: 'application/json',
        body: await adminService.formatModActionView(moderationAction),
      }
    },
  })
}

function getAction(action: ActionInput['action']) {
  if (action === TAKEDOWN || action === FLAG || action === ACKNOWLEDGE) {
    return action as ModerationAction['action']
  }
  throw new InvalidRequestError('Invalid action')
}

function getSubject(subject: ActionInput['subject']) {
  if (
    subject.$type === 'com.atproto.admin.moderationAction#subjectRepo' &&
    typeof subject.did === 'string'
  ) {
    return { did: subject.did }
  }
  if (
    subject.$type === 'com.atproto.admin.moderationAction#subjectRecord' &&
    typeof subject.did === 'string' &&
    typeof subject.collection === 'string' &&
    typeof subject.rkey === 'string' &&
    (subject.cid === undefined || typeof subject.cid === 'string')
  ) {
    return {
      uri: AtUri.make(subject.did, subject.collection, subject.rkey),
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
