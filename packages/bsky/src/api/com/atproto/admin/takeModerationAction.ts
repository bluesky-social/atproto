import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import {
  AuthRequiredError,
  InvalidRequestError,
  UpstreamFailureError,
} from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  ACKNOWLEDGE,
  ESCALATE,
  TAKEDOWN,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { getSubject, getAction } from '../moderation/util'
import { TakedownSubjects } from '../../../../services/moderation'
import { retryHttp } from '../../../../util/retry'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.takeModerationAction({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const {
        action,
        subject,
        reason,
        createdBy,
        createLabelVals,
        negateLabelVals,
        subjectBlobCids,
        durationInHours,
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

      const { result, takenDown } = await db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.services.moderation(dbTxn)
        const labelTxn = ctx.services.label(dbTxn)

        const result = await moderationTxn.logAction({
          action: getAction(action),
          subject: getSubject(subject),
          subjectBlobCids: subjectBlobCids?.map((cid) => CID.parse(cid)) ?? [],
          createLabelVals,
          negateLabelVals,
          createdBy,
          reason,
          durationInHours,
        })

        let takenDown: TakedownSubjects | undefined

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.admin.defs#repoRef' &&
          result.subjectDid
        ) {
          // No credentials to revoke on appview
          takenDown = await moderationTxn.takedownRepo({
            takedownId: result.id,
            did: result.subjectDid,
          })
        }

        if (
          result.action === TAKEDOWN &&
          result.subjectType === 'com.atproto.repo.strongRef' &&
          result.subjectUri &&
          result.subjectCid
        ) {
          takenDown = await moderationTxn.takedownRecord({
            takedownId: result.id,
            uri: new AtUri(result.subjectUri),
            cid: CID.parse(result.subjectCid),
            blobCids: subjectBlobCids?.map((cid) => CID.parse(cid)) ?? [],
          })
        }

        await labelTxn.formatAndCreate(
          ctx.cfg.labelerDid,
          result.subjectUri ?? result.subjectDid,
          result.subjectCid,
          { create: createLabelVals, negate: negateLabelVals },
        )

        return { result, takenDown }
      })

      if (takenDown) {
        const { did, subjects } = takenDown
        if (did && subjects.length > 0) {
          const agent = await ctx.pdsAdminAgent(did)
          const results = await Promise.allSettled(
            subjects.map((subject) =>
              retryHttp(() =>
                agent.api.com.atproto.admin.updateSubjectStatus({
                  subject,
                  takedown: {
                    applied: true,
                    ref: result.id.toString(),
                  },
                }),
              ),
            ),
          )
          const hadFailure = results.some((r) => r.status === 'rejected')
          if (hadFailure) {
            throw new UpstreamFailureError('failed to apply action on PDS')
          }
        }
      }

      return {
        encoding: 'application/json',
        body: await moderationService.views.action(result),
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
