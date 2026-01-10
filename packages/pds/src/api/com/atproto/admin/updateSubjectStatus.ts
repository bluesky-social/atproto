import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  isRepoBlobRef,
  isRepoRef,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { isMain as isStrongRef } from '../../../../lexicon/types/com/atproto/repo/strongRef'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateSubjectStatus({
    auth: ctx.authVerifier.moderator,
    handler: async ({ input }) => {
      const { subject, takedown, deactivated } = input.body
      if (takedown) {
        if (isRepoRef(subject)) {
          await ctx.accountManager.takedownAccount(subject.did, takedown)
        } else if (isStrongRef(subject)) {
          const uri = new AtUri(subject.uri)
          await ctx.actorStore.transact(uri.hostname, async (store) => {
            await store.record.updateRecordTakedownStatus(uri, takedown)
          })
        } else if (isRepoBlobRef(subject)) {
          await ctx.actorStore.transact(subject.did, async (store) => {
            await store.repo.blob.updateBlobTakedownStatus(
              CID.parse(subject.cid),
              takedown,
            )
          })
        } else {
          throw new InvalidRequestError('Invalid subject')
        }
      }

      if (deactivated) {
        if (isRepoRef(subject)) {
          if (deactivated.applied) {
            await ctx.accountManager.deactivateAccount(subject.did, null)
          } else {
            await ctx.accountManager.activateAccount(subject.did)
          }
        }
      }

      if (isRepoRef(subject)) {
        const status = await ctx.accountManager.getAccountStatus(subject.did)
        await ctx.sequencer.sequenceAccountEvt(subject.did, status)
      }

      return {
        encoding: 'application/json',
        body: {
          subject,
          takedown,
        },
      }
    },
  })
}
