import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/com/atproto/admin/getSubjectStatus'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getSubjectStatus({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ params }) => {
      const { did, uri, blob } = params
      const modService = ctx.services.moderation(ctx.db.getPrimary())
      let body: OutputSchema | null = null
      if (blob) {
        if (!did) {
          throw new InvalidRequestError(
            'Must provide a did to request blob state',
          )
        }
        const takedown = await modService.getBlobTakedownRef(did, blob)
        if (takedown) {
          body = {
            subject: {
              $type: 'com.atproto.admin.defs#repoBlobRef',
              did: did,
              cid: blob,
            },
            takedown,
          }
        }
      } else if (uri) {
        const [takedown, cidRes] = await Promise.all([
          modService.getRecordTakedownRef(uri),
          ctx.db
            .getPrimary()
            .db.selectFrom('record')
            .where('uri', '=', uri)
            .select('cid')
            .executeTakeFirst(),
        ])
        if (cidRes && takedown) {
          body = {
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri,
              cid: cidRes.cid,
            },
            takedown,
          }
        }
      } else if (did) {
        const takedown = await modService.getRepoTakedownRef(did)
        if (takedown) {
          body = {
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: did,
            },
            takedown,
          }
        }
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
