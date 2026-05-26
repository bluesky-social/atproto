import { l } from '@atproto/lex'
import { LtHash } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRepoOplog, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, did, since, limit } = params

      if (auth.credentials.type === 'space_credential') {
        if (auth.credentials.space !== space) {
          throw new InvalidRequestError('Credential space mismatch')
        }
      } else {
        assertSpaceScope(auth, space, { action: 'read' })
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
            action: op.action as
              | 'create'
              | 'update'
              | 'delete'
              | l.UnknownString,
            collection: op.collection as l.NsidString,
            rkey: op.rkey as l.RecordKeyString,
            cid: op.cid ? (op.cid as l.CidString) : undefined,
            prev: op.prev ? (op.prev as l.CidString) : undefined,
          })),
          setHash: result.setHash
            ? new LtHash(result.setHash).digest().toString('hex')
            : undefined,
          rev: result.rev ?? undefined,
        },
      }
    },
  })
}
