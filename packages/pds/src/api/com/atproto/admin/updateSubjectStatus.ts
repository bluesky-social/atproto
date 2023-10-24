import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  isRepoRef,
  isRepoBlobRef,
  StatusAttr,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { InputSchema } from '../../../../lexicon/types/com/atproto/admin/updateSubjectStatus'
import { isMain as isStrongRef } from '../../../../lexicon/types/com/atproto/repo/strongRef'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateSubjectStatus({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ input, auth }) => {
      // if less than moderator access then cannot perform a takedown
      if (auth.credentials.type === 'role' && !auth.credentials.moderator) {
        throw new AuthRequiredError(
          'Must be a full moderator to update subject state',
        )
      }

      const { subject, takedown } = input.body
      if (takedown) {
        const { subjectDid, updateFn } = switchOnSubject(ctx, subject, takedown)
        if (
          auth.credentials.type === 'service' &&
          auth.credentials.aud !== subjectDid
        ) {
          throw new AuthRequiredError(
            'jwt audience does not match account did',
            'BadJwtAudience',
          )
        }
        await updateFn()
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

const switchOnSubject = (
  ctx: AppContext,
  subject: InputSchema['subject'],
  takedown: StatusAttr,
): { subjectDid: string; updateFn: () => Promise<unknown> } => {
  const modSrvc = ctx.services.moderation(ctx.db)
  const authSrvc = ctx.services.auth(ctx.db)
  if (isRepoRef(subject)) {
    return {
      subjectDid: subject.did,
      updateFn: () =>
        Promise.all([
          modSrvc.updateRepoTakedownState(subject.did, takedown),
          authSrvc.revokeRefreshTokensByDid(subject.did),
        ]),
    }
  } else if (isStrongRef(subject)) {
    const uri = new AtUri(subject.uri)
    return {
      subjectDid: uri.hostname,
      updateFn: () => modSrvc.updateRecordTakedownState(uri, takedown),
    }
  } else if (isRepoBlobRef(subject)) {
    return {
      subjectDid: subject.did,
      updateFn: () =>
        modSrvc.updateBlobTakedownState(
          subject.did,
          CID.parse(subject.cid),
          takedown,
        ),
    }
  } else {
    throw new InvalidRequestError('Invalid subject')
  }
}
