import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { OutputSchema } from '../../../../lexicon/types/com/atproto/admin/getSubjectStatus'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getSubjectStatus({
    auth: ctx.authVerifier.roleOrModService,
    handler: async ({ params }) => {
      const { did, uri, blob } = params

      let body: OutputSchema | null = null
      if (blob) {
        if (!did) {
          throw new InvalidRequestError(
            'Must provide a did to request blob state',
          )
        }
        const res = await ctx.dataplane.getBlobTakedown({
          did,
          cid: blob,
        })
        body = {
          subject: {
            $type: 'com.atproto.admin.defs#repoBlobRef',
            did: did,
            cid: blob,
          },
          takedown: {
            applied: res.takenDown,
            ref: res.takedownRef ? 'TAKEDOWN' : undefined,
          },
        }
      } else if (uri) {
        const res = await ctx.hydrator.getRecord(uri, true)
        if (res) {
          body = {
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri,
              cid: res.cid,
            },
            takedown: {
              applied: !!res.takedownRef,
              ref: res.takedownRef || undefined,
            },
          }
        }
      } else if (did) {
        const res = (await ctx.hydrator.actor.getActors([did], true)).get(did)
        if (res) {
          body = {
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: did,
            },
            takedown: {
              applied: !!res.takedownRef,
              ref: res.takedownRef || undefined,
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
