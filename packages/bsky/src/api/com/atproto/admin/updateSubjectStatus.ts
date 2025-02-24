import { Timestamp } from '@bufbuild/protobuf'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  isRepoBlobRef,
  isRepoRef,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { isMain as isStrongRef } from '../../../../lexicon/types/com/atproto/repo/strongRef'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateSubjectStatus({
    auth: ctx.authVerifier.roleOrModService,
    handler: async ({ input, auth }) => {
      const { canPerformTakedown } = ctx.authVerifier.parseCreds(auth)
      if (!canPerformTakedown) {
        throw new AuthRequiredError(
          'Must be a full moderator to update subject state',
        )
      }
      const now = new Date()
      const { subject, takedown } = input.body
      if (takedown) {
        if (isRepoRef(subject)) {
          if (takedown.applied) {
            await ctx.dataplane.takedownActor({
              did: subject.did,
              ref: takedown.ref,
              seen: Timestamp.fromDate(now),
            })
          } else {
            await ctx.dataplane.untakedownActor({
              did: subject.did,
              seen: Timestamp.fromDate(now),
            })
          }
        } else if (isStrongRef(subject)) {
          if (takedown.applied) {
            await ctx.dataplane.takedownRecord({
              recordUri: subject.uri,
              ref: takedown.ref,
              seen: Timestamp.fromDate(now),
            })
          } else {
            await ctx.dataplane.untakedownRecord({
              recordUri: subject.uri,
              seen: Timestamp.fromDate(now),
            })
          }
        } else if (isRepoBlobRef(subject)) {
          if (takedown.applied) {
            await ctx.dataplane.takedownBlob({
              did: subject.did,
              cid: subject.cid,
              ref: takedown.ref,
              seen: Timestamp.fromDate(now),
            })
          } else {
            await ctx.dataplane.untakedownBlob({
              did: subject.did,
              cid: subject.cid,
              seen: Timestamp.fromDate(now),
            })
          }
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
