import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.administration.reverseModerationAction({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db } = ctx
      const { id, reversedBy, reversedRationale } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const now = new Date().toISOString()

        const existing = await dbTxn.db
          .selectFrom('moderation_action')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst()

        if (!existing) {
          throw new InvalidRequestError('Moderation action does not exist')
        }
        if (existing.reversedAt !== null) {
          throw new InvalidRequestError(
            'Moderation action has already been reversed',
          )
        }

        const result = await dbTxn.db
          .updateTable('moderation_action')
          .where('id', '=', id)
          .set({
            reversedAt: now,
            reversedBy,
            reversedRationale,
          })
          .returningAll()
          .executeTakeFirstOrThrow()

        if (result.action === 'takedown' && result.subjectDid !== null) {
          await dbTxn.db
            .updateTable('did_handle')
            .set({ takedownId: null })
            .where('did', '=', result.subjectDid)
            .execute()
        }

        return result
      })

      return {
        encoding: 'application/json',
        body: {
          id: moderationAction.id,
          action: moderationAction.action,
          subject: {
            $type: ids.AppBskyActorRef,
            did: moderationAction.subjectDid,
            declarationCid: moderationAction.subjectDeclarationCid,
          },
          rationale: moderationAction.rationale,
          createdAt: moderationAction.createdAt,
          createdBy: moderationAction.createdBy,
          reversedAt: moderationAction.reversedAt ?? undefined,
          reversedBy: moderationAction.reversedBy ?? undefined,
          reversedRationale: moderationAction.reversedRationale ?? undefined,
        },
      }
    },
  })
}
