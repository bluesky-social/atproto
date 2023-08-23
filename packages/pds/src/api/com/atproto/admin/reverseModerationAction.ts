import { AtUri } from '@atproto/uri'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  isRepoRef,
  ACKNOWLEDGE,
  ESCALATE,
  TAKEDOWN,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { isMain as isStrongRef } from '../../../../lexicon/types/com/atproto/repo/strongRef'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.reverseModerationAction({
    auth: ctx.roleVerifier,
    handler: async ({ req, input, auth }) => {
      const access = auth.credentials
      const { db, services } = ctx
      if (ctx.shouldProxyModeration()) {
        const { data: result } =
          await ctx.appviewAgent.com.atproto.admin.reverseModerationAction(
            input.body,
            authPassthru(req, true),
          )

        const transact = db.transaction(async (dbTxn) => {
          const moderationTxn = services.moderation(dbTxn)
          const labelTxn = services.appView.label(dbTxn)
          // reverse takedowns
          if (result.action === TAKEDOWN && isRepoRef(result.subject)) {
            await moderationTxn.reverseTakedownRepo({
              did: result.subject.did,
            })
          }
          if (result.action === TAKEDOWN && isStrongRef(result.subject)) {
            await moderationTxn.reverseTakedownRecord({
              uri: new AtUri(result.subject.uri),
            })
          }
          // invert label creation & negations
          const reverseLabels = (uri: string, cid: string | null) =>
            labelTxn.formatAndCreate(ctx.cfg.labelerDid, uri, cid, {
              create: result.negateLabelVals,
              negate: result.createLabelVals,
            })
          if (isRepoRef(result.subject)) {
            await reverseLabels(result.subject.did, null)
          }
          if (isStrongRef(result.subject)) {
            await reverseLabels(result.subject.uri, result.subject.cid)
          }
        })

        try {
          await transact
        } catch (err) {
          req.log.error(
            { err, actionId: input.body.id },
            'proxied moderation action reversal failed',
          )
        }

        return {
          encoding: 'application/json',
          body: result,
        }
      }

      const moderationService = services.moderation(db)
      const { id, createdBy, reason } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const moderationTxn = services.moderation(dbTxn)
        const labelTxn = services.appView.label(dbTxn)
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
            'Must be an admin to reverse an account takedown',
          )
        }

        const result = await moderationTxn.revertAction({
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

        return result
      })

      return {
        encoding: 'application/json',
        body: await moderationService.views.action(moderationAction),
      }
    },
  })
}
