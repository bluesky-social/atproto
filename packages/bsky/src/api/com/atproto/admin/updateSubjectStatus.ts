import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  isRepoRef,
  isRepoBlobRef,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { isMain as isStrongRef } from '../../../../lexicon/types/com/atproto/repo/strongRef'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { CID } from 'multiformats/cid'

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

      const modService = ctx.services.moderation(ctx.db.getPrimary())

      const { subject, takedown } = input.body
      if (takedown) {
        if (isRepoRef(subject)) {
          const did = subject.did
          if (takedown.applied) {
            await modService.takedownRepo({
              takedownRef: takedown.ref ?? new Date().toISOString(),
              did,
            })
          } else {
            await modService.reverseTakedownRepo({ did })
          }
        } else if (isStrongRef(subject)) {
          const uri = new AtUri(subject.uri)
          const cid = CID.parse(subject.cid)
          if (takedown.applied) {
            await modService.takedownRecord({
              takedownRef: takedown.ref ?? new Date().toISOString(),
              uri,
              cid,
            })
          } else {
            await modService.reverseTakedownRecord({ uri })
          }
        } else if (isRepoBlobRef(subject)) {
          const { did, cid } = subject
          if (takedown.applied) {
            await modService.takedownBlob({
              takedownRef: takedown.ref ?? new Date().toISOString(),
              did,
              cid,
            })
          } else {
            await modService.reverseTakedownBlob({ did, cid })
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
