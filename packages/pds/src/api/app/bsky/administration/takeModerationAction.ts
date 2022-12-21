import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import * as ActorRef from '../../../../lexicon/types/app/bsky/actor/ref'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.administration.takeModerationAction({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const {
        action: _action,
        subject: _subject,
        rationale,
        createdBy,
      } = input.body

      if (_action !== 'takedown') {
        throw new InvalidRequestError('Unsupported action')
      }
      if (_subject.$type !== ids.AppBskyActorRef) {
        throw new InvalidRequestError('Unsupported subject type')
      }

      const action = _action as 'takedown'
      const subject = _subject as ActorRef.Main

      const actor = await services.actor(db).getUser(subject.did)
      if (!actor || actor.declarationCid !== subject.declarationCid) {
        throw new Error('Actor does not exist')
      }

      const moderationAction = await db.transaction(async (dbTxn) => {
        const authTxn = services.auth(dbTxn)
        const now = new Date().toISOString()

        const result = await dbTxn.db
          .insertInto('moderation_action')
          .values({
            action,
            subjectType: 'actor',
            subjectDid: subject.did,
            subjectDeclarationCid: subject.declarationCid,
            createdAt: now,
            createdBy,
            rationale,
          })
          .returningAll()
          .executeTakeFirstOrThrow()

        if (result.action === 'takedown') {
          await authTxn.revokeRefreshTokensByDid(subject.did)
          await dbTxn.db
            .updateTable('did_handle')
            .set({ takedownId: result.id })
            .where('did', '=', subject.did)
            .where('takedownId', 'is', null)
            .executeTakeFirst()
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
