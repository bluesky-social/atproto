import { parseCid } from '@atproto/lex-data'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.updateSubjectStatus, {
    auth: ctx.authVerifier.moderator,
    handler: async ({ input }) => {
      const { subject, takedown, deactivated } = input.body
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
            await ctx.accountManager.deactivateAccount(subject.did, null)
          } else {
            await ctx.accountManager.activateAccount(subject.did)
          }
        }
      }

      if (com.atproto.admin.defs.repoRef.$isTypeOf(subject)) {
        const status = await ctx.accountManager.getAccountStatus(subject.did)
        await ctx.sequencer.sequenceAccountEvt(subject.did, status)
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
