import { ForbiddenError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

const ASSIGNMENT_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.claimReport({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      // context
      const authDid =
        auth.credentials.type === 'moderator'
          ? auth.credentials.iss
          : auth.credentials.type === 'admin_token'
            ? ctx.cfg.service.did
            : undefined

      // inputs
      const reportId = input.body.reportId
      const queueId = input.body.queueId
      const assign = input.body.assign
      const did = authDid
      const now = new Date()
      const endAt = assign
        ? new Date(now.getTime() + ASSIGNMENT_DURATION_MS)
        : now

      // validation
      if (!did) {
        throw new ForbiddenError('No one to assign report to')
      }

      const result = await ctx.db.transaction(async (dbTxn) => {
        // existing
        const existing = await dbTxn.db
          .selectFrom('moderator_assignment')
          .selectAll()
          .where('reportId', '=', reportId)
          .where('endAt', '>', now)
          .executeTakeFirst()
        if (existing) {
          // Same mod
          if (existing.did === did) {
            const updated = await dbTxn.db
              .updateTable('moderator_assignment')
              .set({
                endAt,
                queueId,
              })
              .where('id', '=', existing.id)
              .returningAll()
              .executeTakeFirstOrThrow()
            return updated
          }
          // Different mod
          else {
            throw new InvalidRequestError(
              'Report already claimed',
              'AlreadyClaimed',
            )
          }
        }

        // new
        const created = await dbTxn.db
          .insertInto('moderator_assignment')
          .values({
            did,
            reportId,
            queueId: queueId ?? null,
            startAt: now,
            endAt,
          })
          .returningAll()
          .executeTakeFirstOrThrow()
        return created
      })

      return {
        encoding: 'application/json' as const,
        body: {
          id: result.id,
          did: result.did,
          reportId: result.reportId!,
          queueId: result.queueId ?? undefined,
          startAt: result.startAt.toISOString(),
          endAt: result.endAt.toISOString(),
        },
      }
    },
  })
}
