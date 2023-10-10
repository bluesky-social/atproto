import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/com/atproto/admin/getSubjectState'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getSubjectState({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const { did, uri, blob } = params
      const modSrvc = ctx.services.moderation(ctx.db)
      let body: OutputSchema | null
      if (uri) {
        body = await modSrvc.getRecordTakedownState(new AtUri(uri))
      } else if (blob) {
        if (!did) {
          throw new InvalidRequestError(
            'Must provide a did to request blob state',
          )
        }
        body = await modSrvc.getBlobTakedownState(did, CID.parse(blob))
      } else if (did) {
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
