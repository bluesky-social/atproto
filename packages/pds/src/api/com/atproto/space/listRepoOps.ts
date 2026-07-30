import { l } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceRead, buildSignedCommit } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRepoOps, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo, since, limit, excludeValues } = params

      assertSpaceRead(auth, space)

      const result = await ctx.actorStore.read(repo, async (store) => {
        const oplog = await store.space.getRepoOplog(space, {
          since,
          limit,
          includeValues: !excludeValues,
        })
        // Only once at head: mid-backfill the repo's rev is ahead of the ops we
        // returned, so the commit would describe state the client can't reach yet.
        const commit = oplog.caughtUp
          ? await buildSignedCommit({
              spaceUri: space,
              author: repo,
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
            collection: op.collection as l.NsidString,
            rkey: op.rkey as l.RecordKeyString,
            cid: op.cid ? (op.cid as l.CidString) : null,
            prev: op.prev ? (op.prev as l.CidString) : null,
            value: op.value,
          })),
          // Absent once caught up, so a syncer keeps its last known position.
          cursor: result.oplog.caughtUp
            ? undefined
            : result.oplog.ops.at(-1)?.rev,
          commit: result.commit,
        },
      }
    },
  })
}
