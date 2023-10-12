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
        const state = await ctx.actorStore
          .reader(did)
          .repo.blob.getBlobTakedownState(CID.parse(blob))
        if (state) {
          body = {
            subject: {
              $type: 'com.atproto.admin.defs#repoBlobRef',
              did: did,
              cid: blob,
            },
            state: {
              takedown: state,
            },
          }
        }
      } else if (uri) {
        const parsedUri = new AtUri(uri)
        const store = ctx.actorStore.reader(parsedUri.hostname)
        const [state, cid] = await Promise.all([
          store.record.getRecordTakedownState(parsedUri),
          store.record.getCurrentRecordCid(parsedUri),
        ])
        if (cid && state) {
          body = {
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: parsedUri.toString(),
              cid: cid.toString(),
            },
            state: {
              takedown: state,
            },
          }
        }
      } else if (did) {
        const state = await ctx.services
          .account(ctx.db)
          .getAccountTakedownState(did)
        if (state) {
          body = {
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: did,
            },
            state: {
              takedown: state,
            },
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
