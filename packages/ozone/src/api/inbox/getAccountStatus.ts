import { currentDatetimeString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getAccountStatus, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const did = auth.credentials.iss
      const [status, strike] = await Promise.all([
        ctx.db.db
          .selectFrom('moderation_subject_status')
          .where('did', '=', did)
          .where('recordPath', '=', '')
          .where('convoId', '=', '')
          .select([
            'takendown',
            'suspendUntil',
            'muteUntil',
            'muteReportingUntil',
            'updatedAt',
          ])
          .executeTakeFirst(),
        ctx.db.db
          .selectFrom('account_strike')
          .where('did', '=', did)
          .select(['activeStrikeCount', 'lastStrikeAt'])
          .executeTakeFirst(),
      ])
      const now = currentDatetimeString()
      const suspended = !!status?.suspendUntil && status.suspendUntil > now
      const restricted =
        (!!status?.muteUntil && status.muteUntil > now) ||
        (!!status?.muteReportingUntil && status.muteReportingUntil > now)
      const standing =
        status?.takendown || suspended || (strike?.activeStrikeCount ?? 0) >= 12
          ? 'atRisk'
          : restricted || (strike?.activeStrikeCount ?? 0) >= 8
            ? 'warning'
            : 'good'
      const updatedAt =
        status?.updatedAt && strike?.lastStrikeAt
          ? status.updatedAt > strike.lastStrikeAt
            ? status.updatedAt
            : strike.lastStrikeAt
          : (status?.updatedAt ??
            strike?.lastStrikeAt ??
            '1970-01-01T00:00:00.000Z')

      const body: tools.ozone.inbox.getAccountStatus.$OutputBody = {
        src: ctx.cfg.service.did,
        standing,
        updatedAt,
      }
      if (suspended && status?.suspendUntil)
        body.expiresAt = status.suspendUntil

      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}
