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
    auth: ctx.roleOrAdminServiceVerifier,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      // if less than moderator access then cannot perform a takedown
      if (!access.moderator) {
        throw new AuthRequiredError(
          'Must be a full moderator to update subject state',
        )
      }
      const { subject, takedown } = input.body
      const modSrvc = ctx.services.moderation(ctx.db)
      const authSrvc = ctx.services.auth(ctx.db)
      if (takedown) {
        if (isRepoRef(subject)) {
          await Promise.all([
            await modSrvc.updateRepoTakedownState(subject.did, takedown),
            await authSrvc.revokeRefreshTokensByDid(subject.did),
          ])
        } else if (isStrongRef(subject)) {
          await modSrvc.updateRecordTakedownState(
            new AtUri(subject.uri),
            takedown,
          )
        } else if (isRepoBlobRef(subject)) {
          try {
            await modSrvc.updateBlobTakedownState(
              subject.did,
              CID.parse(subject.cid),
              takedown,
            )
          } catch (err) {
            console.log(err)
            throw err
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
