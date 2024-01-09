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
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ input, auth }) => {
      const { canPerformTakedown } = ctx.authVerifier.parseCreds(auth)
      if (!canPerformTakedown) {
        throw new AuthRequiredError(
          'Must be a full moderator to update subject state',
        )
      }
      const { subject, takedown } = input.body
      if (takedown) {
        let actorDid: string | undefined = undefined
        let recordUri: string | undefined = undefined
        let blobCid: string | undefined = undefined
        if (isRepoRef(subject)) {
          actorDid = subject.did
        } else if (isStrongRef(subject)) {
          recordUri = subject.uri
        } else if (isRepoBlobRef(subject)) {
          actorDid = subject.did
          blobCid = subject.cid
        } else {
          throw new InvalidRequestError('Invalid subject')
        }
        await ctx.dataplane.updateTakedown({
          actorDid,
          recordUri,
          blobCid,
          takenDown: takedown?.applied,
        })
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
