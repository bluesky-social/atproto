import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  isRepoRef,
  isRepoBlobRef,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { isMain as isStrongRef } from '../../../../lexicon/types/com/atproto/repo/strongRef'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateSubjectStatus({
    auth: ctx.authVerifier.roleOrModService,
    handler: async ({ input, auth }) => {
      // if less than moderator access then cannot perform a takedown
      if (auth.credentials.type === 'role' && !auth.credentials.moderator) {
        throw new AuthRequiredError(
          'Must be a full moderator to update subject state',
        )
      }

      const { subject, takedown } = input.body
      if (takedown) {
        if (isRepoRef(subject)) {
          await ctx.accountManager.takedownAccount(subject.did, takedown)
        } else if (isStrongRef(subject)) {
          const uri = new AtUri(subject.uri)
          await ctx.actorStore.transact(uri.hostname, (store) =>
            store.record.updateRecordTakedownStatus(uri, takedown),
          )
        } else if (isRepoBlobRef(subject)) {
          await ctx.actorStore.transact(subject.did, (store) =>
            store.repo.blob.updateBlobTakedownStatus(
              CID.parse(subject.cid),
              takedown,
            ),
          )
        } else {
          throw new InvalidRequestError('Invalid subject')
        }
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
