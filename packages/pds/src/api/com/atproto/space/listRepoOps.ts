import { COMMIT_MAC_PROFILE } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import {
  assertSpaceRead,
  buildCommit,
  commitMacHeaders,
  getSpaceMacRequest,
  isSpaceUserOrAdmin,
  toSpaceRef,
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

      assertSpaceRead(auth, toSpaceRef(space), repo)
      await assertRepoAvailability(ctx, repo, isSpaceUserOrAdmin(auth, repo))

      const mac = await getSpaceMacRequest(ctx, {
        req,
        res,
        auth,
        repo,
        profile: COMMIT_MAC_PROFILE,
      })

      const cursor = params.cursor ? parseCursor(params.cursor) : undefined

      const { ops, commit } = await ctx.actorStore.read(
        repo,
        async (store) => ({
          ops: await store.space.listRepoOps(space, {
            since,
            cursor,
            limit,
            excludeValues,
          }),
          commit: buildCommit({
            spaceUri: space,
            repo,
            state: await store.space.getRepoState(space),
          }),
        }),
      )
      if (!commit) {
        throw new InvalidRequestError(
          `Could not find repo for space: ${space}`,
          'RepoNotFound',
        )
      }

      // A full page may not be the last. In the rare event that it happens to end on
      // the last op, it's fine. Just an extra request by the client.
      const last = ops.at(-1)
      const nextCursor =
        last && ops.length === limit
          ? formatCursor(last.rev, last.idx)
          : undefined
      return {
        encoding: 'application/json',
        body: {
          ops: ops.map((op) => ({
            rev: op.rev,
            collection: op.collection,
            rkey: op.rkey,
            cid: op.cid,
            prev: op.prev,
            value: op.value,
          })),
          cursor: nextCursor,
          commit,
        },
        headers: commitMacHeaders(commit, mac),
      }
    },
  })
}

const parseCursor = (cursor: string): { rev: string; idx: number } => {
  const [rev, idxStr] = cursor.split('/')
  const idx = parseInt(idxStr, 10)
  if (isNaN(idx)) {
    throw new InvalidRequestError('Malformed cursor', 'InvalidCursor')
  }
  return { rev, idx }
}

const formatCursor = (rev: string, idx: number): string => {
  return `${rev}/${idx}`
}
