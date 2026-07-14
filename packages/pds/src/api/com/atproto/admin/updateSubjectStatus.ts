import { parseCid } from '@atproto/lex-data'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.updateSubjectStatus, {
    auth: ctx.authVerifier.moderator,
    handler: async ({ input }) => {
      const { subject, takedown, deactivated } = input.body

      if (takedown?.applied && deactivated != null && !deactivated.applied) {
        throw new InvalidRequestError(
          `Cannot activate and takedown an account at the same time`,
        )
      }

      if (takedown) {
        if (com.atproto.admin.defs.repoRef.$isTypeOf(subject)) {
          await ctx.accountManager.takedownAccount(subject.did, takedown)
        } else if (com.atproto.repo.strongRef.$isTypeOf(subject)) {
          const uri = new AtUri(subject.uri)
          await ctx.actorStore.transact(uri.hostname, async (store) => {
            await store.record.updateRecordTakedownStatus(uri, takedown)
          })
        } else if (com.atproto.admin.defs.repoBlobRef.$isTypeOf(subject)) {
          await ctx.actorStore.transact(subject.did, async (store) => {
            await store.repo.blob.updateBlobTakedownStatus(
              parseCid(subject.cid),
              takedown,
            )
          })
        } else {
          throw new InvalidRequestError(`Invalid subject (${subject.$type})`)
        }
      }

      if (deactivated) {
        if (com.atproto.admin.defs.repoRef.$isTypeOf(subject)) {
          if (deactivated.applied) {
            await ctx.accountManager.deactivateAccount(subject.did)
          } else {
            await ctx.accountManager.activateAccount(subject.did)
          }
        }
      }

      // @NOTE accountManager will sequence an account status when updating the
      // status, so we don't *need* to sequence the account status here.
      // However, this endpoint historically has always sequenced the account
      // status.
      if (!takedown && !deactivated) {
        if (com.atproto.admin.defs.repoRef.$isTypeOf(subject)) {
          await ctx.accountManager.sequenceAccountStatus(subject.did)
        }
      }

      return {
        encoding: 'application/json' as const,
        body: {
          subject,
          takedown,
        },
      }
    },
  })
}
