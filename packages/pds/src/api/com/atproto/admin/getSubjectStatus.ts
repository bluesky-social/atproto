import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/com/atproto/admin/getSubjectStatus'
import { ensureValidAdminAud } from '../../../../auth-verifier'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getSubjectStatus({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ params, auth }) => {
      const { did, uri, blob } = params
      const modSrvc = ctx.services.moderation(ctx.db)
      let body: OutputSchema | null
      if (blob) {
        if (!did) {
          throw new InvalidRequestError(
            'Must provide a did to request blob state',
          )
        }
        ensureValidAdminAud(auth, did)
        body = await modSrvc.getBlobTakedownState(did, CID.parse(blob))
      } else if (uri) {
        const parsedUri = new AtUri(uri)
        ensureValidAdminAud(auth, parsedUri.hostname)
        body = await modSrvc.getRecordTakedownState(parsedUri)
      } else if (did) {
        ensureValidAdminAud(auth, did)
        body = await modSrvc.getRepoTakedownState(did)
      } else {
        throw new InvalidRequestError('No provided subject')
      }
      if (body === null) {
        throw new InvalidRequestError('Subject not found', 'NotFound')
      }
      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}
