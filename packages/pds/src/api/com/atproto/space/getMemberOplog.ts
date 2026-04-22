import { l } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getMemberOplog, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ params, auth }) => {
      const { space, since, limit } = params

      if (auth.credentials.space !== space) {
        throw new InvalidRequestError('Credential space mismatch')
      }

      const ownerDid = new SpaceUri(space).spaceDid
      const result = await ctx.actorStore.read(ownerDid, (store) =>
        store.space.getMemberOplog(space, { since, limit }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          ops: result.ops.map((op) => ({
            rev: op.rev,
            idx: op.idx,
            action: op.action as 'add' | 'remove' | l.UnknownString,
            did: op.did as l.DidString,
          })),
          setHash: result.setHash ? result.setHash.toString('hex') : undefined,
          rev: result.rev ?? undefined,
        },
      }
    },
  })
}
