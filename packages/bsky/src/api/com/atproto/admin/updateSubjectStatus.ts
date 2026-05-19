import { timestampFromDate } from '@bufbuild/protobuf/wkt'
import {
  AuthRequiredError,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.updateSubjectStatus, {
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
        if (com.atproto.admin.defs.repoRef.$isTypeOf(subject)) {
          if (takedown.applied) {
            await ctx.dataplane.takedownActor({
              did: subject.did,
              ref: takedown.ref,
              seen: timestampFromDate(now),
            })
          } else {
            await ctx.dataplane.untakedownActor({
              did: subject.did,
              seen: timestampFromDate(now),
            })
          }
        } else if (com.atproto.repo.strongRef.$isTypeOf(subject)) {
          if (takedown.applied) {
            await ctx.dataplane.takedownRecord({
              recordUri: subject.uri,
              ref: takedown.ref,
              seen: timestampFromDate(now),
            })
          } else {
            await ctx.dataplane.untakedownRecord({
              recordUri: subject.uri,
              seen: timestampFromDate(now),
            })
          }
        } else if (com.atproto.admin.defs.repoBlobRef.$isTypeOf(subject)) {
          if (takedown.applied) {
            await ctx.dataplane.takedownBlob({
              did: subject.did,
              cid: subject.cid,
              ref: takedown.ref,
              seen: timestampFromDate(now),
            })
          } else {
            await ctx.dataplane.untakedownBlob({
              did: subject.did,
              cid: subject.cid,
              seen: timestampFromDate(now),
            })
          }
        } else {
          throw new InvalidRequestError(
            `Invalid subject type: ${subject.$type}`,
          )
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
