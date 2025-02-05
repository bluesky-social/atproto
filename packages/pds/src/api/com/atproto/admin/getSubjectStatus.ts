import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { OutputSchema } from '../../../../lexicon/types/com/atproto/admin/getSubjectStatus'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getSubjectStatus({
    auth: ctx.authVerifier.moderator,
    handler: async ({ params }) => {
      const { did, uri, blob } = params
      let body: OutputSchema | null = null
      if (blob) {
        if (!did) {
          throw new InvalidRequestError(
            'Must provide a did to request blob state',
          )
        }
        const takedown = await ctx.actorStore.read(did, (store) =>
          store.repo.blob.getBlobTakedownStatus(CID.parse(blob)),
        )
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
        const parsedUri = new AtUri(uri)
        const [takedown, cid] = await ctx.actorStore.read(
          parsedUri.hostname,
          (store) =>
            Promise.all([
              store.record.getRecordTakedownStatus(parsedUri),
              store.record.getCurrentRecordCid(parsedUri),
            ]),
        )
        if (cid && takedown) {
          body = {
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: parsedUri.toString(),
              cid: cid.toString(),
            },
            takedown,
          }
        }
      } else if (did) {
        const status = await ctx.accountManager.getAccountAdminStatus(did)
        if (status) {
          body = {
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: did,
            },
            takedown: status.takedown,
            deactivated: status.deactivated,
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
