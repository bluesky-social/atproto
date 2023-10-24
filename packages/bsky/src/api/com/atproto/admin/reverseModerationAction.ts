import {
  AuthRequiredError,
  InvalidRequestError,
  UpstreamFailureError,
} from '@atproto/xrpc-server'
import {
  ACKNOWLEDGE,
  ESCALATE,
  TAKEDOWN,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { retryHttp } from '../../../../util/retry'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.reverseModerationAction({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const { id, createdBy, reason } = input.body

      const { result, restored } = await db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.services.moderation(dbTxn)
        const labelTxn = ctx.services.label(dbTxn)
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

        // apply access rules

        // if less than moderator access then can only reverse ack and escalation actions
        if (
          !access.moderator &&
          ![ACKNOWLEDGE, ESCALATE].includes(existing.action)
        ) {
          throw new AuthRequiredError(
            'Must be a full moderator to reverse this type of action',
          )
        }
        // if less than moderator access then cannot reverse takedown on an account
        if (
          !access.moderator &&
          existing.action === TAKEDOWN &&
          existing.subjectType === 'com.atproto.admin.defs#repoRef'
        ) {
          throw new AuthRequiredError(
            'Must be a full moderator to reverse an account takedown',
          )
        }

        const { result, restored } = await moderationTxn.revertAction({
          id,
          createdAt: now,
          createdBy,
          reason,
        })

        // invert creates & negates
        const { createLabelVals, negateLabelVals } = result
        const negate =
          createLabelVals && createLabelVals.length > 0
            ? createLabelVals.split(' ')
            : undefined
        const create =
          negateLabelVals && negateLabelVals.length > 0
            ? negateLabelVals.split(' ')
            : undefined
        await labelTxn.formatAndCreate(
          ctx.cfg.labelerDid,
          result.subjectUri ?? result.subjectDid,
          result.subjectCid,
          { create, negate },
        )

        return { result, restored }
      })

      if (restored) {
        const { did, subjects } = restored
        const agent = await ctx.pdsAdminAgent(did)
        const results = await Promise.allSettled(
          subjects.map((subject) =>
            retryHttp(() =>
              agent.api.com.atproto.admin.updateSubjectStatus({
                subject,
                takedown: {
                  applied: false,
                },
              }),
            ),
          ),
        )
        const hadFailure = results.some((r) => r.status === 'rejected')
        if (hadFailure) {
          throw new UpstreamFailureError('failed to revert action on PDS')
        }
      }

      return {
        encoding: 'application/json',
        body: await moderationService.views.action(result),
      }
    },
  })
}
