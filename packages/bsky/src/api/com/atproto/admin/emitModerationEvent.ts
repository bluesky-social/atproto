import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  ACKNOWLEDGE,
  ESCALATE,
  TAKEDOWN,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { getSubject, getAction } from '../moderation/util'
import { ModerationEventRow } from '../../../../services/moderation/types'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.emitModerationEvent({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const {
        action,
        subject,
        comment,
        createdBy,
        createLabelVals,
        negateLabelVals,
        subjectBlobCids,
        durationInHours,
        refEventId,
        meta,
      } = input.body

      // apply access rules

      // if less than admin access then can not takedown an account
      if (!access.moderator && action === TAKEDOWN && 'did' in subject) {
        throw new AuthRequiredError(
          'Must be a full moderator to perform an account takedown',
        )
      }
      // if less than moderator access then can only take ack and escalation actions
      if (!access.moderator && ![ACKNOWLEDGE, ESCALATE].includes(action)) {
        throw new AuthRequiredError(
          'Must be a full moderator to take this type of action',
        )
      }
      // if less than moderator access then can not apply labels
      if (
        !access.moderator &&
        (createLabelVals?.length || negateLabelVals?.length)
      ) {
        throw new AuthRequiredError('Must be a full moderator to label content')
      }

      validateLabels([...(createLabelVals ?? []), ...(negateLabelVals ?? [])])

      const moderationAction = await db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.services.moderation(dbTxn)
        const labelTxn = ctx.services.label(dbTxn)
        // Helper function for applying labels from a moderation event row
        // This is used for both applying labels for an action and reverting labels
        // from the reference event when reverting an action
        const applyLabels = async (
          labelParams: Pick<
            ModerationEventRow,
            | 'subjectCid'
            | 'subjectDid'
            | 'subjectUri'
            | 'createLabelVals'
            | 'negateLabelVals'
          >,
        ) =>
          labelTxn.formatAndCreate(
            ctx.cfg.labelerDid,
            labelParams.subjectUri ?? labelParams.subjectDid,
            labelParams.subjectCid,
            {
              create: labelParams.createLabelVals?.length
                ? labelParams.createLabelVals.split(' ')
                : undefined,
              negate: labelParams.negateLabelVals?.length
                ? labelParams.negateLabelVals.split(' ')
                : undefined,
            },
          )

        const result = await moderationTxn.logAction(
          {
            action: getAction(action),
            subject: getSubject(subject),
            subjectBlobCids:
              subjectBlobCids?.map((cid) => CID.parse(cid)) ?? [],
            createLabelVals,
            negateLabelVals,
            createdBy,
            comment: comment || null,
            durationInHours,
            refEventId,
            meta: meta || null,
          },
          applyLabels,
        )

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.admin.defs#repoRef' &&
          result.subjectDid
        ) {
          // No credentials to revoke on appview
          await moderationTxn.takedownRepo({
            takedownId: result.id,
            did: result.subjectDid,
          })
        }

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.repo.strongRef' &&
          result.subjectUri
        ) {
          await moderationTxn.takedownRecord({
            takedownId: result.id,
            uri: new AtUri(result.subjectUri),
            blobCids: subjectBlobCids?.map((cid) => CID.parse(cid)) ?? [],
          })
        }

        await applyLabels(result)

        return result
      })

      return {
        encoding: 'application/json',
        body: await moderationService.views.action(moderationAction),
      }
    },
  })
}

const validateLabels = (labels: string[]) => {
  for (const label of labels) {
    for (const char of badChars) {
      if (label.includes(char)) {
        throw new InvalidRequestError(`Invalid label: ${label}`)
      }
    }
  }
}

const badChars = [' ', ',', ';', `'`, `"`]
