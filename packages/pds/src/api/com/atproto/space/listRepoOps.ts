import { l } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { OplogPosition } from '../../../../actor-store/space/reader.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceRead, buildSignedCommit } from './util.js'

// The cursor is opaque to the caller, so it can grow past (rev, idx) later.
const formatCursor = (op: OplogPosition): string => `${op.rev}/${op.idx}`

const parseCursor = (cursor: string): OplogPosition | undefined => {
  const [rev, idx] = cursor.split('/')
  if (!rev || !/^\d+$/.test(idx ?? '')) return undefined
  return { rev, idx: Number(idx) }
}

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRepoOps, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo, since, cursor, limit, excludeValues } = params

      assertSpaceRead(auth, space, repo)

      const { ops, caughtUp, commit } = await ctx.actorStore.read(
        repo,
        async (store) => {
          // `since` and `cursor` compose: a caller paging through holds `since` at its
          // own sync position and passes back the cursor from each response.
          const res = await store.space.listRepoOps(space, {
            since,
            position: cursor ? parseCursor(cursor) : undefined,
            limit,
            includeValues: !excludeValues,
          })
          // Only sent at head. Mid-backfill the repo's rev is ahead of these ops, so
          // the commit would describe state the caller can't reach yet.
          const commit =
            res.caughtUp &&
            (await buildSignedCommit({
              spaceUri: space,
              author: repo,
              state: res.state,
              keypair: await store.keypair(),
            }))
          return { ...res, commit: commit || undefined }
        },
      )

      const last = ops.at(-1)

      return {
        encoding: 'application/json' as const,
        body: {
          ops: ops.map((op) => ({
            rev: op.rev,
            collection: op.collection as l.NsidString,
            rkey: op.rkey as l.RecordKeyString,
            cid: op.cid as l.CidString | null,
            prev: op.prev as l.CidString | null,
            value: op.value,
          })),
          // Absent once caught up, so a syncer keeps its own position instead.
          cursor: caughtUp || !last ? undefined : formatCursor(last),
          commit: commit && com.atproto.space.defs.signedCommit.build(commit),
        },
      }
    },
  })
}
