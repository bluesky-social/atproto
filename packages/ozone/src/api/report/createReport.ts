import { ForbiddenError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ReasonType } from '../../lexicon/types/com/atproto/moderation/defs'
import { ModerationService } from '../../mod-service'
import { subjectFromInput } from '../../mod-service/subject'
import { TagService } from '../../tag-service'
import { getTagForReport } from '../../tag-service/util'
import { isAppealReport } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const requester =
        'iss' in auth.credentials ? auth.credentials.iss : ctx.cfg.service.did
      const { reasonType, reason, modTool } = input.body
      const subject = subjectFromInput(input.body.subject)

      // If the report is an appeal, the requester must be the author of the subject
      if (isAppealReport(reasonType) && requester !== subject.did) {
        throw new ForbiddenError('You cannot appeal this report')
      }

      const db = ctx.db

      await Promise.all([
        assertValidReporter(ctx.modService(db), reasonType, requester),
        ctx.moderationServiceProfile().validateReasonType(reasonType),
      ])

      const report = await db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.modService(dbTxn)
        const { event: reportEvent, subjectStatus } =
          await moderationTxn.report({
            reason,
            subject,
            reasonType,
            reportedBy: requester || ctx.cfg.service.did,
            modTool,
          })

        const tagService = new TagService(
          subject,
          subjectStatus,
          ctx.cfg.service.did,
          moderationTxn,
        )
        await tagService.evaluateForSubject([getTagForReport(reasonType)])

        return reportEvent
      })

      const body = ctx.modService(db).views.formatReport(report)
      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}

const assertValidReporter = async (
  modService: ModerationService,
  reasonType: ReasonType,
  did: string,
) => {
  const reporterStatus = await modService.getCurrentStatus({ did })

  // If we don't have a mod status for the reporter, no need to do further checks
  if (!reporterStatus.length) {
    return
  }

  // For appeals, we just need to make sure that the account does not have pending appeal
  if (isAppealReport(reasonType)) {
    if (reporterStatus[0]?.appealed) {
      throw new ForbiddenError(
        'Awaiting decision on previous appeal',
        'AlreadyAppealed',
      )
    }
    return
  }

  // For non appeals, we need to make sure the reporter account is not already in takendown status
  // This is necessary because we allow takendown accounts call createReport but that's only meant for appeals
  // and we need to make sure takendown accounts don't abuse this endpoint
  if (reporterStatus[0]?.takendown) {
    throw new ForbiddenError(
      'Report not accepted from takendown account',
      'AccountTakedown',
    )
  }
}
