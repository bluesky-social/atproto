import { l } from '@atproto/lex'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
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

      assertSpaceRead(auth, space, repo)

      const cursor = params.cursor ? parseCursor(params.cursor) : undefined

      const { ops, commit } = await ctx.actorStore.read(repo, async (store) => {
        const ops = await store.space.listRepoOps(space, {
          since,
          cursor,
          limit,
          excludeValues,
        })

        // If a full page (ie not done iterating), then return the ops with no commit
        // In the rare event that the page happens to end on the last op, it's fine. Just
        // an extra request by the client
        if (ops.length === limit) return { ops, commit: undefined }

        const commit = await buildSignedCommit({
          spaceUri: space,
          author: repo,
          state: await store.space.getRepoState(space),
          keypair: await store.keypair(),
        })
        return { ops, commit }
      })

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
          cursor:
            commit || !last ? undefined : formatCursor(last.rev, last.idx),
          commit: commit,
        },
      }
    },
  })
}

const parseCursor = (cursor: string): { rev: string; idx: number } => {
  const [rev, idxStr] = cursor.split('/')
  const idx = parseInt(idxStr, 10)
  if (isNaN(idx)) {
    throw new InvalidRequestError('Malformed cursor', 'MalformedCursor')
  }
  return { rev, idx }
}

const formatCursor = (rev: string, idx: number): string => {
  return `${rev}/${idx}`
}
