import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/com/atproto/admin/getSubjectStatus'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getSubjectStatus({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const { did, uri, blob } = params
      let body: OutputSchema | null = null
      if (blob) {
        if (!did) {
          throw new InvalidRequestError(
            'Must provide a did to request blob state',
          )
        }
        const takedown = await ctx.actorStore
          .reader(did)
          .repo.blob.getBlobTakedownStatus(CID.parse(blob))
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
        const store = ctx.actorStore.reader(parsedUri.hostname)
        const [takedown, cid] = await Promise.all([
          store.record.getRecordTakedownStatus(parsedUri),
          store.record.getCurrentRecordCid(parsedUri),
        ])
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
        const takedown = await ctx.services
          .account(ctx.db)
          .getAccountTakedownStatus(did)
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
