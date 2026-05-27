import { l } from '@atproto/lex'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope, buildSignedCommit } from './util.js'

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

      const result = await ctx.actorStore.read(did, async (store) => {
        const oplog = await store.space.getRepoOplog(space, { since, limit })
        // Only sign a commit when this batch drains the oplog to head —
        // otherwise the rev we'd bind into the commit may be ahead of the
        // ops we returned to the client. They'll get the commit on the
        // final, smaller-than-limit batch.
        const caughtUp = oplog.ops.length < limit
        const commit = caughtUp
          ? await buildSignedCommit({
              spaceUri: space,
              userDid: did,
              scope: 'records',
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
          commit: result.commit,
        },
      }
    },
  })
}
