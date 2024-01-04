import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  isRepoRef,
  isRepoBlobRef,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { InputSchema } from '../../../../lexicon/types/com/atproto/admin/updateSubjectStatus'
import { isMain as isStrongRef } from '../../../../lexicon/types/com/atproto/repo/strongRef'
import { authPassthru, proxy, resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateSubjectStatus({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ input, auth, req }) => {
      // if less than moderator access then cannot perform a takedown
      if (auth.credentials.type === 'role' && !auth.credentials.moderator) {
        throw new AuthRequiredError(
          'Must be a full moderator to update subject state',
        )
      }

      const { subject, takedown } = input.body
      const { did, uri, blob } = parseSubject(subject)

      const modSrvc = ctx.services.moderation(ctx.db)
      const authSrvc = ctx.services.auth(ctx.db)
      const accSrvc = ctx.services.account(ctx.db)

      // no need to check if proxying actually occurred or use its result
      const account = await accSrvc.getAccount(did, true)
      const proxied = await proxy(ctx, account?.pdsDid, async (agent) => {
        const result = await agent.api.com.atproto.admin.updateSubjectStatus(
          input.body,
          authPassthru(req, true),
        )
        return resultPassthru(result)
      })

      if (takedown) {
        if (blob) {
          if (!proxied) {
            await modSrvc.updateBlobTakedownState(did, blob, takedown)
          }
        } else if (uri) {
          if (!proxied) {
            await modSrvc.updateRecordTakedownState(uri, takedown)
          }
        } else {
          // apply account takedown on entryway in addition to proxied pds
          await Promise.all([
            modSrvc.updateRepoTakedownState(did, takedown),
            authSrvc.revokeRefreshTokensByDid(did),
          ])
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

const parseSubject = (subject: InputSchema['subject']) => {
  if (isRepoRef(subject)) {
    return { did: subject.did }
  } else if (isStrongRef(subject)) {
    const uri = new AtUri(subject.uri)
    return { did: uri.hostname, uri }
  } else if (isRepoBlobRef(subject)) {
    const blobCid = CID.parse(subject.cid)
    return { did: subject.did, blob: blobCid }
  } else {
    throw new InvalidRequestError('Invalid subject')
  }
}
