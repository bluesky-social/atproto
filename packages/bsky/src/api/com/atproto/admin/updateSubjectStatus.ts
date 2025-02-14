import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Timestamp } from '@bufbuild/protobuf'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import {
  isRepoBlobRef,
  isRepoRef,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { isMain as isStrongRef } from '../../../../lexicon/types/com/atproto/repo/strongRef'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateSubjectStatus({
    auth: ctx.authVerifier.roleOrModService,
    handler: ctx.createHandler(async (ctx) => {
      const { auth } = ctx
      const canPerformTakedown =
        (auth.credentials.type === 'role' && auth.credentials.admin) ||
        auth.credentials.type === 'mod_service'

      if (!canPerformTakedown) {
        throw new AuthRequiredError('Must be a full moderator')
      }

      const now = new Date()
      const { subject, takedown } = ctx.input.body
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
    }),
  })
}
