import type { l } from '@atproto/lex'
import { COMMIT_MAC_TYPE } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import {
  assertSpaceRead,
  buildCommit,
  commitMacHeaders,
  getSpaceMacSecret,
  isSpaceSelfRead,
} from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRepoOps, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth, req, res }) => {
      const { space, repo, since, limit, excludeValues } = params

      assertSpaceRead(auth, space, repo)
      await assertRepoAvailability(ctx, repo, isSpaceSelfRead(auth, repo))

      const sharedSecret = await getSpaceMacSecret(ctx, {
        req,
        res,
        auth,
        repo,
        type: COMMIT_MAC_TYPE,
      })

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

        const commit = buildCommit({
          spaceUri: space,
          repo,
          state: await store.space.getRepoState(space),
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
          commit,
        },
        // A page without a commit has nothing to MAC. Its ops are checked once the
        // final page's commit is compared against the syncer's running set hash.
        headers: commit ? commitMacHeaders(sharedSecret, commit) : undefined,
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
