import { l } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope, buildSignedCommit } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getMemberOplog, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, since, limit } = params

      if (auth.credentials.type === 'space_credential') {
        if (auth.credentials.space !== space) {
          throw new InvalidRequestError('Credential space mismatch')
        }
      } else {
        assertSpaceScope(auth, space, { action: 'read' })
      }

      const ownerDid = new SpaceUri(space).spaceDid
      const result = await ctx.actorStore.read(ownerDid, async (store) => {
        const oplog = await store.space.getMemberOplog(space, { since, limit })
        // See getRepoOplog: only sign once the batch reaches head.
        const caughtUp = oplog.ops.length < limit
        const commit = caughtUp
          ? await buildSignedCommit({
              spaceUri: space,
              userDid: ownerDid,
              scope: 'members',
              state: { setHash: oplog.setHash, rev: oplog.rev },
              keypair: await store.keypair(),
            })
          : undefined
        return { oplog, commit }
      })

      return {
        encoding: 'application/json' as const,
        body: {
          ops: result.oplog.ops.map((op) => ({
            rev: op.rev,
            idx: op.idx,
            action: op.action as 'add' | 'remove' | l.UnknownString,
            did: op.did as l.DidString,
          })),
          commit: result.commit,
        },
      }
    },
  })
}
