import { l } from '@atproto/lex'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRepoOplog, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ params, auth }) => {
      const { space, did, since, limit } = params

      if (auth.credentials.space !== space) {
        throw new InvalidRequestError('Credential space mismatch')
      }

      const result = await ctx.actorStore.read(did, (store) =>
        store.space.getRepoOplog(space, { since, limit }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          ops: result.ops.map((op) => ({
            rev: op.rev,
            idx: op.idx,
            action: op.action as 'create' | 'update' | 'delete' | l.UnknownString,
            collection: op.collection as l.NsidString,
            rkey: op.rkey as l.RecordKeyString,
            cid: op.cid ? (op.cid as l.CidString) : undefined,
            prev: op.prev ? (op.prev as l.CidString) : undefined,
          })),
          setHash: result.setHash ? result.setHash.toString('hex') : undefined,
          rev: result.rev ?? undefined,
        },
      }
    },
  })
}
