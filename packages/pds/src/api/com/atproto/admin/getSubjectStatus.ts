import { parseCid } from '@atproto/lex-data'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.getSubjectStatus, {
    auth: ctx.authVerifier.moderator,
    handler: async ({ params }) => {
      const { did, uri, blob } = params
      let body: com.atproto.admin.getSubjectStatus.$OutputBody | null = null
      if (blob) {
        if (!did) {
          throw new InvalidRequestError(
            'Must provide a did to request blob state',
          )
        }
        const takedown = await ctx.actorStore.read(did, (store) =>
          store.repo.blob.getBlobTakedownStatus(parseCid(blob)),
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
        if (parsedUri.isSpace) {
          // @NOTE space records can't be taken down (see updateSubjectStatus)
          const record = parsedUri.authorDid
            ? await ctx.actorStore.read(parsedUri.authorDid, (store) =>
                store.space.getRecord(uri),
              )
            : null
          if (record) {
            body = {
              subject: {
                $type: com.atproto.repo.strongRef.$type,
                uri,
                cid: record.cid,
              },
              takedown: { applied: false },
            }
          }
        } else {
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
        encoding: 'application/json' as const,
        body,
      }
    },
  })
}
