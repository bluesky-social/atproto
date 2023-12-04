import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/com/atproto/admin/getSubjectStatus'
import { ensureValidAdminAud } from '../../../../auth-verifier'
import { authPassthru, proxy, resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getSubjectStatus({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ params, auth, req }) => {
      const modSrvc = ctx.services.moderation(ctx.db)
      const accSrvc = ctx.services.account(ctx.db)
      const { did, uri, blob } = parseSubject(params)
      ensureValidAdminAud(auth, did)

      const account = await accSrvc.getAccount(did, true)
      const proxied = await proxy(ctx, account?.pdsDid, async (agent) => {
        const result = await agent.api.com.atproto.admin.getSubjectStatus(
          params,
          authPassthru(req),
        )
        return resultPassthru(result)
      })
      if (proxied !== null) {
        return proxied
      }

      let body: OutputSchema | null
      if (blob) {
        body = await modSrvc.getBlobTakedownState(did, blob)
      } else if (uri) {
        body = await modSrvc.getRecordTakedownState(uri)
      } else {
        body = await modSrvc.getRepoTakedownState(did)
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

const parseSubject = (opts: { did?: string; uri?: string; blob?: string }) => {
  const { did, uri, blob } = opts
  if (blob) {
    if (!did) {
      throw new InvalidRequestError('Must provide a did to request blob state')
    }
    const blobCid = CID.parse(blob)
    return { did, blob: blobCid }
  } else if (uri) {
    const parsedUri = new AtUri(uri)
    return { did: parsedUri.hostname, uri: parsedUri }
  } else if (did) {
    return { did }
  } else {
    throw new InvalidRequestError('No provided subject')
  }
}
