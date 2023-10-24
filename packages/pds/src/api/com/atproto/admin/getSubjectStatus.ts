import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  QueryParams,
  OutputSchema,
} from '../../../../lexicon/types/com/atproto/admin/getSubjectStatus'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getSubjectStatus({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ params, auth }) => {
      const { subjectDid, getStatus } = switchOnSubject(ctx, params)
      if (
        auth.credentials.type === 'service' &&
        auth.credentials.aud !== subjectDid
      ) {
        throw new AuthRequiredError(
          'jwt audience does not match account did',
          'BadJwtAudience',
        )
      }
      const body = await getStatus()
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

const switchOnSubject = (
  ctx: AppContext,
  params: QueryParams,
): { subjectDid: string; getStatus: () => Promise<OutputSchema | null> } => {
  const { did, uri, blob } = params
  const modSrvc = ctx.services.moderation(ctx.db)
  if (blob) {
    if (!did) {
      throw new InvalidRequestError('Must provide a did to request blob state')
    }
    return {
      subjectDid: did,
      getStatus: () => modSrvc.getBlobTakedownState(did, CID.parse(blob)),
    }
  } else if (uri) {
    const parsedUri = new AtUri(uri)
    return {
      subjectDid: parsedUri.hostname,
      getStatus: () => modSrvc.getRecordTakedownState(parsedUri),
    }
  } else if (did) {
    return {
      subjectDid: did,
      getStatus: () => modSrvc.getRepoTakedownState(did),
    }
  } else {
    throw new InvalidRequestError('No provided subject')
  }
}
